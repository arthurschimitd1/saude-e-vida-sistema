import { Op } from 'sequelize';
import Venda from '../models/Venda.js';
import VendaItem from '../models/VendaItem.js';
import Product from '../models/Product.js';
import User from '../models/UserModel.js';
import Movimento from '../models/Movimento.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';
import Receita from '../models/Receita.js';
import ReceitaItem from '../models/ReceitaItem.js';
import RawMaterial from '../models/RawMaterial.js';
import { filtroDataInclusivo } from '../utils/financeiroPeriodo.js';
import { criarCalculadoraCustosReceitas } from '../utils/receitas.js';
import {
  agruparProducaoPorProduto,
  agruparVendasPorProduto,
  resolverPeriodoRelatorio,
} from '../utils/relatoriosProdutos.js';

const empresaSelecionada = (usuario) => usuario?.empresa_id_override ?? usuario?.empresa_id ?? null;

async function escopoVendas(usuario) {
  const empresaId = empresaSelecionada(usuario);
  if (usuario?.tipo === 'MASTER' && !usuario?.empresa_id_override) return {};
  if (!empresaId) return { empresa_id: -1 };

  const funcionarios = await User.findAll({
    where: { empresa_id: Number(empresaId) },
    attributes: ['id'],
    raw: true,
  });
  const funcionarioIds = funcionarios.map(({ id }) => Number(id)).filter(Number.isInteger);
  return {
    [Op.or]: [
      { empresa_id: Number(empresaId) },
      ...(funcionarioIds.length ? [{ empresa_id: null, funcionario_id: { [Op.in]: funcionarioIds } }] : []),
    ],
  };
}

async function mapasRoupas(vendas, usuario) {
  const itens = vendas.flatMap((venda) => venda?.itens ?? []);
  const roupaIds = [...new Set(itens.map((item) => Number(item?.roupa_id)).filter(Number.isInteger))];
  const variacaoIds = [...new Set(itens.map((item) => Number(item?.variacao_id)).filter(Number.isInteger))];
  const empresaId = empresaSelecionada(usuario);
  const whereRoupas = roupaIds.length ? { id: { [Op.in]: roupaIds } } : { id: -1 };
  if (!(usuario?.tipo === 'MASTER' && !usuario?.empresa_id_override) && empresaId) whereRoupas.empresa_id = Number(empresaId);

  const [roupas, variacoes] = await Promise.all([
    EstoqueRoupa.findAll({ where: whereRoupas, raw: true }),
    variacaoIds.length
      ? EstoqueRoupaVariacao.findAll({ where: { id: { [Op.in]: variacaoIds } }, raw: true })
      : [],
  ]);
  return {
    roupas: new Map(roupas.map((roupa) => [Number(roupa.id), roupa])),
    variacoes: new Map(variacoes.map((variacao) => [Number(variacao.id), variacao])),
  };
}

async function custosUnitariosPorFicha(usuario) {
  const empresaId = empresaSelecionada(usuario);
  if (!empresaId) return new Map();
  const receitas = await Receita.findAll({
    where: { empresa_id: Number(empresaId), produto_id: { [Op.not]: null } },
    attributes: ['id', 'produto_id', 'rendimento', 'updated_at'],
    include: [{
      model: ReceitaItem,
      as: 'itens',
      attributes: ['quantidade'],
      include: [
        { model: RawMaterial, as: 'materiaPrima', attributes: ['id', 'name', 'unit', 'price'] },
        { model: Product, as: 'produtoMP', attributes: ['id', 'name', 'unidade_medida', 'preco_compra', 'price'] },
      ],
    }],
    order: [['updated_at', 'DESC']],
  });

  const receitasPlain = receitas.map((receitaModel) => receitaModel.get({ plain: true }));
  const calculadora = criarCalculadoraCustosReceitas(receitasPlain);
  const custos = new Map();
  for (const receita of receitasPlain) {
    const produtoId = Number(receita.produto_id);
    if (!Number.isInteger(produtoId) || custos.has(produtoId)) continue;
    const custo = calculadora.custoDaReceita(receita);
    if (custo.pendente) continue;
    custos.set(produtoId, {
      custoUnitario: custo.custoUnitario,
      receitaId: receita.id,
      rendimento: custo.rendimento.valor,
      rendimentoInferido: custo.rendimento.inferido,
    });
  }
  return custos;
}

class RelatorioProdutosService {
  async vendas(filtros = {}, usuario) {
    const periodo = resolverPeriodoRelatorio(filtros.dataInicio, filtros.dataFim);
    const where = {
      ...(await escopoVendas(usuario)),
      data: filtroDataInclusivo(periodo.dataInicio, periodo.dataFim, Op),
    };
    const vendas = await Venda.findAll({
      where,
      attributes: ['id', 'empresa_id', 'funcionario_id', 'data', 'desconto', 'tipo_desconto'],
      include: [{
        model: VendaItem,
        as: 'itens',
        attributes: ['id', 'produto_id', 'nome_item', 'tipo', 'roupa_id', 'variacao_id', 'quantidade', 'valor_total'],
        include: [{ model: Product, attributes: ['id', 'name', 'category', 'unidade_medida', 'preco_compra', 'price'] }],
      }],
      order: [['data', 'ASC'], ['id', 'ASC']],
    });
    const [mapas, custosReceita] = await Promise.all([
      mapasRoupas(vendas, usuario),
      custosUnitariosPorFicha(usuario),
    ]);
    return {
      periodo,
      ...agruparVendasPorProduto(vendas, mapas.roupas, mapas.variacoes, filtros, custosReceita),
      avisos: ['Os custos refletem a ficha técnica ou o custo atualmente cadastrado no produto.'],
    };
  }

  async vendasFinanceiras(filtros = {}, usuario) {
    const relatorio = await this.vendas({ ...filtros, considerarDesconto: true }, usuario);
    return {
      ...relatorio,
      avisos: [
        'O preço de venda considera o desconto da venda rateado entre os itens; a taxa de entrega não entra no valor dos produtos.',
        'Os custos refletem a ficha técnica ou o custo atualmente cadastrado no produto.',
      ],
    };
  }

  async producao(filtros = {}, usuario) {
    const periodo = resolverPeriodoRelatorio(filtros.dataInicio, filtros.dataFim);
    const where = {
      tipo: 'entrada',
      origem_tipo: 'producao',
      data: filtroDataInclusivo(periodo.dataInicio, periodo.dataFim, Op),
    };
    const empresaId = empresaSelecionada(usuario);
    if (!(usuario?.tipo === 'MASTER' && !usuario?.empresa_id_override)) where.empresa_id = empresaId ?? -1;

    const movimentos = await Movimento.findAll({
      where,
      attributes: ['id', 'produto_id', 'quantidade', 'motivo', 'origem_id', 'data'],
      include: [{ model: Product, as: 'produto', attributes: ['id', 'name', 'category', 'unidade_medida'] }],
      order: [['data', 'ASC'], ['id', 'ASC']],
    });
    return {
      periodo,
      ...agruparProducaoPorProduto(movimentos, filtros),
    };
  }
}

export default new RelatorioProdutosService();
