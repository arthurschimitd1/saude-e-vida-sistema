import { Op } from 'sequelize';
import FiscalStockImport from '../models/FiscalStockImport.js';
import FiscalStockImportItem from '../models/FiscalStockImportItem.js';
import Movimento from '../models/Movimento.js';
import Product from '../models/Product.js';
import RawMaterial from '../models/RawMaterial.js';
import Receita from '../models/Receita.js';
import ReceitaItem from '../models/ReceitaItem.js';
import EntradaInsumoSemNota from '../models/EntradaInsumoSemNota.js';
import User from '../models/UserModel.js';
import Venda from '../models/Venda.js';
import VendaItem from '../models/VendaItem.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import { filtroDataInclusivo, limitesPeriodoInclusivo } from '../utils/financeiroPeriodo.js';
import { normalizarTextoRelatorio, resolverPeriodoRelatorio } from '../utils/relatoriosProdutos.js';
import {
  calcularConsumoTeorico,
  calcularCustoRealCompetencia,
  consolidarCompras,
  consolidarCustosHistoricos,
  montarComparativo,
  reconstruirEstoqueNoPeriodo,
} from '../utils/cmv.js';

const numero = (valor) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};
const arredondar = (valor, casas = 2) => Number(numero(valor).toFixed(casas));
const dentroDoPeriodo = (data, inicio, fim) => {
  const valor = new Date(data);
  return Number.isFinite(valor.getTime()) && valor >= inicio && valor < fim;
};

async function escopoVendas(empresaId) {
  const funcionarios = await User.findAll({
    where: { empresa_id: empresaId },
    attributes: ['id'],
    raw: true,
  });
  const ids = funcionarios.map(({ id }) => Number(id)).filter(Number.isInteger);
  return {
    [Op.or]: [
      { empresa_id: empresaId },
      ...(ids.length ? [{ empresa_id: null, funcionario_id: { [Op.in]: ids } }] : []),
    ],
  };
}

class CMVService {
  async relatorio(filtros = {}, usuario) {
    const empresaId = Number(empresaParaGravar(usuario));
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      const erro = new Error('Selecione uma empresa para consultar o CMV');
      erro.statusCode = 400;
      throw erro;
    }

    const periodo = resolverPeriodoRelatorio(filtros.dataInicio, filtros.dataFim);
    const limites = limitesPeriodoInclusivo(periodo.dataInicio, periodo.dataFim);
    const filtroVendas = filtroDataInclusivo(periodo.dataInicio, periodo.dataFim, Op);
    const buscaProduto = normalizarTextoRelatorio(filtros.produto);

    const [produtosModel, movimentosModel, importacoesModel, vendasModel, receitasModel, entradasSemNotaModel] = await Promise.all([
      Product.findAll({
        where: { empresa_id: empresaId },
        attributes: ['id', 'name', 'category', 'unidade_medida', 'currentQuantity', 'preco_compra', 'price', 'raw_material_id'],
        raw: true,
      }),
      Movimento.findAll({
        where: { empresa_id: empresaId, data: { [Op.gte]: limites.inicio } },
        attributes: ['produto_id', 'tipo', 'quantidade', 'data'],
        raw: true,
      }),
      FiscalStockImport.findAll({
        where: { empresa_id: empresaId },
        attributes: ['id', 'access_key', 'invoice_number', 'issued_at', 'supplier_name', 'imported_at'],
        order: [['imported_at', 'ASC']],
        raw: true,
      }),
      Venda.findAll({
        where: { ...(await escopoVendas(empresaId)), data: filtroVendas },
        attributes: ['id', 'data'],
        include: [{
          model: VendaItem,
          as: 'itens',
          attributes: ['produto_id', 'nome_item', 'tipo', 'quantidade'],
          include: [{ model: Product, attributes: ['id', 'name'] }],
        }],
      }),
      Receita.findAll({
        where: { empresa_id: empresaId },
        attributes: ['id', 'nome', 'produto_id', 'rendimento', 'updated_at'],
        include: [{
          model: ReceitaItem,
          as: 'itens',
          attributes: ['id', 'raw_material_id', 'produto_id', 'quantidade'],
          include: [
            { model: Product, as: 'produtoMP', attributes: ['id', 'name', 'unidade_medida', 'preco_compra', 'price'] },
            { model: RawMaterial, as: 'materiaPrima', attributes: ['id', 'name', 'unit', 'price'] },
          ],
        }],
        order: [['updated_at', 'DESC']],
      }),
      EntradaInsumoSemNota.findAll({
        where: { empresa_id: empresaId },
        attributes: ['produto_id', 'quantidade', 'preco_unitario', 'data_entrada'],
        raw: true,
      }),
    ]);

    const importacoes = importacoesModel.filter((item) => dentroDoPeriodo(item.issued_at ?? item.imported_at, limites.inicio, limites.fimExclusivo));
    const importacaoIds = importacoes.map((item) => Number(item.id));
    const itensCompra = importacaoIds.length
      ? await FiscalStockImportItem.findAll({ where: { import_id: { [Op.in]: importacaoIds } }, raw: true })
      : [];
    const importacoesAteFim = importacoesModel.filter((item) => {
      const data = new Date(item.issued_at ?? item.imported_at);
      return Number.isFinite(data.getTime()) && data < limites.fimExclusivo;
    });
    const importacaoIdsHistorico = importacoesAteFim.map((item) => Number(item.id));
    const itensCompraHistorico = importacaoIdsHistorico.length
      ? await FiscalStockImportItem.findAll({ where: { import_id: { [Op.in]: importacaoIdsHistorico } }, raw: true })
      : [];

    const produtos = produtosModel;
    const produtoPorId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
    const produtoPorRawMaterial = new Map(
      produtos.filter((produto) => produto.raw_material_id)
        .map((produto) => [Number(produto.raw_material_id), produto]),
    );
    const compras = consolidarCompras(importacoes, itensCompra, produtoPorId);
    const teorico = calcularConsumoTeorico(vendasModel, receitasModel, produtoPorRawMaterial);
    const custosHistoricos = consolidarCustosHistoricos(importacoesAteFim, itensCompraHistorico, entradasSemNotaModel);
    const vendasCompetencia = calcularCustoRealCompetencia({
      vendas: vendasModel,
      produtos,
      receitas: receitasModel,
      produtoPorRawMaterial,
      custosHistoricos,
    });
    const teoricoPorProdutoVendido = new Map();
    for (const detalhe of teorico.detalhes) {
      const id = Number(detalhe.produtoId);
      teoricoPorProdutoVendido.set(id, numero(teoricoPorProdutoVendido.get(id)) + numero(detalhe.valorTeorico));
    }
    const vendasCompetenciaComTeorico = vendasCompetencia.map((linha) => {
      const valorTeoricoVenda = arredondar(teoricoPorProdutoVendido.get(linha.produtoId) ?? 0);
      return {
        ...linha,
        valorTeorico: valorTeoricoVenda,
        diferencaValor: arredondar(linha.valorRealCompetencia - valorTeoricoVenda),
      };
    });
    const posicoes = reconstruirEstoqueNoPeriodo(produtos, movimentosModel, limites.inicio, limites.fimExclusivo);
    const intermediarios = new Set(teorico.produtosIntermediarios ?? []);
    const produtosComparativo = produtos.filter((produto) => (
      !intermediarios.has(Number(produto.id)) || compras.porProduto.has(Number(produto.id))
    ));
    let comparativo = montarComparativo({
      produtos: produtosComparativo,
      posicoes,
      comprasPorProduto: compras.porProduto,
      teoricoPorProduto: teorico.porIngrediente,
    });

    if (buscaProduto) {
      comparativo = comparativo.filter((linha) => normalizarTextoRelatorio(`${linha.produto} ${linha.categoria}`).includes(buscaProduto));
    }
    const vendasCompetenciaVisiveis = vendasCompetenciaComTeorico.filter((linha) => (
      !buscaProduto || normalizarTextoRelatorio(`${linha.produto} ${linha.categoria}`).includes(buscaProduto)
    ));
    const idsVisiveis = new Set(comparativo.map((linha) => linha.produtoId));
    const comprasDetalhes = compras.detalhes
      .filter((item) => !buscaProduto || idsVisiveis.has(item.produtoId))
      .sort((a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime());

    const valorFinanceiro = comparativo.reduce((soma, linha) => soma + linha.valorFinanceiro, 0);
    const estoqueInicial = comparativo.reduce((soma, linha) => soma + linha.estoqueInicial * linha.custoReferencia, 0);
    const estoqueFinal = comparativo.reduce((soma, linha) => soma + linha.estoqueFinal * linha.custoReferencia, 0);
    const valorReal = comparativo.reduce((soma, linha) => soma + linha.valorReal, 0);
    const valorTeorico = comparativo.reduce((soma, linha) => soma + linha.valorTeorico, 0);
    const divergencia = valorReal - valorTeorico;
    const valorRealCompetencia = vendasCompetenciaVisiveis.reduce((soma, linha) => soma + linha.valorRealCompetencia, 0);
    const valorTeoricoCompetencia = vendasCompetenciaVisiveis.reduce((soma, linha) => soma + linha.valorTeorico, 0);
    const divergenciaCompetencia = valorRealCompetencia - valorTeoricoCompetencia;
    const avisosTeorico = teorico.avisos ?? [];
    const rendimentosInferidos = avisosTeorico.filter((aviso) => aviso.includes('foi inferido pela quantidade de embalagens'));
    const avisosTeoricoCriticos = avisosTeorico.filter((aviso) => !aviso.includes('foi inferido pela quantidade de embalagens'));
    const notasVisiveis = new Set(comprasDetalhes.map((item) => item.importacaoId));
    const fornecedoresVisiveis = new Set(comprasDetalhes.map((item) => item.fornecedor));
    const notasSemDataOriginal = new Set(comprasDetalhes.filter((item) => !item.dataOriginalDisponivel).map((item) => item.importacaoId)).size;

    return {
      periodo,
      resumo: {
        financeiro: {
          valor: arredondar(valorFinanceiro),
          notas: notasVisiveis.size,
          fornecedores: fornecedoresVisiveis.size,
          itens: comprasDetalhes.length,
        },
        real: {
          valor: arredondar(valorReal),
          estoqueInicial: arredondar(estoqueInicial),
          compras: arredondar(valorFinanceiro),
          estoqueFinal: arredondar(estoqueFinal),
        },
        realCompetencia: {
          valor: arredondar(valorRealCompetencia),
          produtos: vendasCompetenciaVisiveis.length,
          unidadesVendidas: arredondar(vendasCompetenciaVisiveis.reduce((soma, linha) => soma + linha.quantidadeVendida, 0), 3),
        },
        teorico: {
          valor: arredondar(valorTeorico),
          coberturaPercentual: teorico.coberturaPercentual,
          unidadesVendidas: teorico.unidadesVendidas,
          unidadesComFicha: teorico.unidadesComFicha,
          produtosSemFicha: teorico.semFicha.length,
        },
        teoricoCompetencia: {
          valor: arredondar(valorTeoricoCompetencia),
        },
        divergencia: {
          valor: arredondar(divergencia),
          percentual: valorTeorico !== 0 ? arredondar((divergencia / valorTeorico) * 100, 1) : null,
        },
        divergenciaCompetencia: {
          valor: arredondar(divergenciaCompetencia),
          percentual: valorTeoricoCompetencia !== 0 ? arredondar((divergenciaCompetencia / valorTeoricoCompetencia) * 100, 1) : null,
        },
      },
      comparativo,
      vendas: vendasCompetenciaVisiveis,
      compras: comprasDetalhes,
      fichas: teorico.detalhes,
      semFicha: teorico.semFicha,
      avisos: [
        ...(notasSemDataOriginal ? [`${notasSemDataOriginal} nota(s) antiga(s) usam a data de importação porque a data de emissão ainda não era armazenada.`] : []),
        ...(teorico.semFicha.length ? [`${teorico.semFicha.length} produto(s) vendido(s) não possuem ficha técnica válida e não entram no CMV Teórico.`] : []),
        ...(rendimentosInferidos.length ? [`${rendimentosInferidos.length} ficha(s) antiga(s) sem rendimento tiveram o rendimento inferido pela quantidade de embalagens. Confirme esses valores na tela de Produção.`] : []),
        ...avisosTeoricoCriticos,
        ...(intermediarios.size ? [`${intermediarios.size} produto(s) intermediário(s) foram decompostos até os insumos reais para evitar dupla contagem.`] : []),
        'O CMV real da competência considera somente os produtos vendidos no período e o custo médio histórico das entradas anteriores à venda. O CMV real por estoque permanece disponível para controle de estoque.',
        'A valorização do estoque usa o custo médio das compras do período; sem compra no período, usa o custo atual cadastrado no produto.',
      ],
    };
  }
}

export default new CMVService();
