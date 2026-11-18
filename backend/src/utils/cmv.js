import {
  indexarReceitasPorProduto,
  receitaPossuiRendimentoPendente,
  resolverRendimentoReceita,
} from './receitas.js';

const numero = (valor) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

const arredondar = (valor, casas = 4) => Number(numero(valor).toFixed(casas));

export const saldoMovimentos = (movimentos = []) => movimentos.reduce(
  (saldo, movimento) => saldo + (movimento.tipo === 'entrada' ? numero(movimento.quantidade) : -numero(movimento.quantidade)),
  0,
);

export function reconstruirEstoqueNoPeriodo(produtos = [], movimentos = [], inicio, fimExclusivo) {
  const porProduto = new Map();
  for (const movimento of movimentos) {
    const id = Number(movimento.produto_id);
    if (!porProduto.has(id)) porProduto.set(id, []);
    porProduto.get(id).push(movimento);
  }

  return produtos.map((produto) => {
    const lista = porProduto.get(Number(produto.id)) ?? [];
    const movimentosDepoisInicio = lista.filter((movimento) => new Date(movimento.data) >= inicio);
    const movimentosDepoisFim = lista.filter((movimento) => new Date(movimento.data) >= fimExclusivo);
    return {
      produtoId: Number(produto.id),
      estoqueInicial: arredondar(numero(produto.currentQuantity) - saldoMovimentos(movimentosDepoisInicio), 3),
      estoqueFinal: arredondar(numero(produto.currentQuantity) - saldoMovimentos(movimentosDepoisFim), 3),
    };
  });
}

export function consolidarCompras(importacoes = [], itens = [], produtos = new Map()) {
  const importacoesPorId = new Map(importacoes.map((item) => [Number(item.id), item]));
  const porProduto = new Map();
  const detalhes = [];

  for (const item of itens) {
    const importacao = importacoesPorId.get(Number(item.import_id));
    if (!importacao) continue;
    const produto = produtos.get(Number(item.product_id));
    const quantidade = numero(item.quantity);
    const custoUnitario = numero(item.unit_cost);
    const valorTotal = arredondar(quantidade * custoUnitario, 2);
    const atual = porProduto.get(Number(item.product_id)) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += quantidade;
    atual.valor += valorTotal;
    porProduto.set(Number(item.product_id), atual);
    detalhes.push({
      id: Number(item.id),
      importacaoId: Number(item.import_id),
      produtoId: Number(item.product_id),
      produto: produto?.name ?? item.description,
      categoria: produto?.category ?? 'Sem categoria',
      unidade: produto?.unidade_medida ?? 'UN',
      dataEmissao: importacao.issued_at ?? importacao.imported_at,
      dataOriginalDisponivel: Boolean(importacao.issued_at),
      nota: importacao.invoice_number ?? null,
      chaveAcesso: importacao.access_key ?? null,
      fornecedor: importacao.supplier_name ?? 'Fornecedor não informado',
      quantidade,
      custoUnitario,
      valorTotal,
    });
  }

  for (const compra of porProduto.values()) {
    compra.quantidade = arredondar(compra.quantidade, 3);
    compra.valor = arredondar(compra.valor, 2);
  }
  return { porProduto, detalhes };
}

export function calcularConsumoTeorico(vendas = [], receitas = [], produtoPorRawMaterial = new Map()) {
  const receitaPorProduto = indexarReceitasPorProduto(receitas);

  const porIngrediente = new Map();
  const detalhes = [];
  let unidadesVendidas = 0;
  let unidadesComFicha = 0;
  const semFicha = new Map();
  const avisos = new Set();
  const produtosIntermediarios = new Set();

  const adicionarConsumo = (produto, quantidade, acumulador, custoInformado = null) => {
    if (!produto) return;
    const id = Number(produto.id);
    if (!Number.isInteger(id) || id <= 0) return;
    const custoUnitario = custoInformado == null
      ? numero(produto.preco_compra ?? produto.price)
      : numero(custoInformado);
    const valor = quantidade * custoUnitario;
    const atual = porIngrediente.get(id) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += quantidade;
    atual.valor += valor;
    porIngrediente.set(id, atual);
    const detalhe = acumulador.get(id) ?? {
      produtoId: id,
      produto: produto.name,
      quantidade: 0,
      unidade: produto.unidade_medida ?? produto.unit ?? 'UN',
      valor: 0,
    };
    detalhe.quantidade += quantidade;
    detalhe.valor += valor;
    acumulador.set(id, detalhe);
  };

  const expandirReceita = (receita, quantidadeProduto, acumulador, trilha = new Set()) => {
    const produtoId = Number(receita?.produto_id);
    if (trilha.has(produtoId)) {
      avisos.add(`Ciclo entre fichas detectado na receita “${receita?.nome ?? produtoId}”.`);
      return;
    }
    const rendimento = resolverRendimentoReceita(receita, produtoPorRawMaterial);
    if (rendimento.inferido) {
      avisos.add(
        rendimento.pendente
          ? `A ficha “${receita.nome}” está sem rendimento e não possui embalagem que permita inferi-lo.`
          : `O rendimento ${rendimento.valor} da ficha “${receita.nome}” foi inferido pela quantidade de embalagens.`,
      );
    }
    const fator = quantidadeProduto / rendimento.valor;
    const proximaTrilha = new Set(trilha);
    proximaTrilha.add(produtoId);

    for (const ingrediente of receita.itens ?? []) {
      const quantidadeTeorica = numero(ingrediente.quantidade) * fator;
      if (ingrediente.produtoMP) {
        const subReceita = receitaPorProduto.get(Number(ingrediente.produtoMP.id));
        if (subReceita && !proximaTrilha.has(Number(ingrediente.produtoMP.id))) {
          produtosIntermediarios.add(Number(ingrediente.produtoMP.id));
          expandirReceita(subReceita, quantidadeTeorica, acumulador, proximaTrilha);
        } else {
          if (subReceita) avisos.add(`Ciclo entre fichas detectado no produto “${ingrediente.produtoMP.name}”.`);
          adicionarConsumo(ingrediente.produtoMP, quantidadeTeorica, acumulador);
        }
        continue;
      }
      const produtoIngrediente = produtoPorRawMaterial.get(Number(ingrediente.raw_material_id));
      if (!produtoIngrediente) {
        avisos.add(`O insumo “${ingrediente.materiaPrima?.name ?? ingrediente.raw_material_id}” não está vinculado a um produto de estoque.`);
        continue;
      }
      adicionarConsumo(
        produtoIngrediente,
        quantidadeTeorica,
        acumulador,
        ingrediente.materiaPrima?.price,
      );
    }
  };

  for (const venda of vendas) {
    for (const item of venda.itens ?? []) {
      if (String(item.tipo ?? '').toLowerCase() !== 'produto' || !item.produto_id) continue;
      const quantidadeVendida = numero(item.quantidade);
      unidadesVendidas += quantidadeVendida;
      const receita = receitaPorProduto.get(Number(item.produto_id));
      const nomeProduto = item.Product?.name ?? item.nome_item ?? `Produto #${item.produto_id}`;
      if (!receita?.itens?.length) {
        const atual = semFicha.get(Number(item.produto_id)) ?? { produtoId: Number(item.produto_id), produto: nomeProduto, quantidadeVendida: 0 };
        atual.quantidadeVendida += quantidadeVendida;
        semFicha.set(Number(item.produto_id), atual);
        continue;
      }

      if (receitaPossuiRendimentoPendente(receita, receitaPorProduto, produtoPorRawMaterial)) {
        const atual = semFicha.get(Number(item.produto_id)) ?? {
          produtoId: Number(item.produto_id),
          produto: nomeProduto,
          quantidadeVendida: 0,
          motivo: 'rendimento_pendente',
        };
        atual.quantidadeVendida += quantidadeVendida;
        semFicha.set(Number(item.produto_id), atual);
        avisos.add(`A ficha “${receita.nome}” ou uma de suas fichas intermediárias precisa ter o rendimento confirmado.`);
        continue;
      }

      unidadesComFicha += quantidadeVendida;
      const rendimentoResolvido = resolverRendimentoReceita(receita, produtoPorRawMaterial);
      const ingredientesAgrupados = new Map();
      expandirReceita(receita, quantidadeVendida, ingredientesAgrupados);
      const ingredientes = [...ingredientesAgrupados.values()].map((ingrediente) => ({
        ...ingrediente,
        quantidade: arredondar(ingrediente.quantidade, 3),
        valor: arredondar(ingrediente.valor, 2),
      }));
      const custoTeoricoProduto = ingredientes.reduce((total, ingrediente) => total + ingrediente.valor, 0);
      detalhes.push({
        produtoId: Number(item.produto_id),
        produto: nomeProduto,
        quantidadeVendida,
        rendimento: rendimentoResolvido.valor,
        rendimentoInferido: rendimentoResolvido.inferido,
        receita: receita.nome,
        ingredientes,
        valorTeorico: arredondar(custoTeoricoProduto, 2),
      });
    }
  }

  for (const consumo of porIngrediente.values()) {
    consumo.quantidade = arredondar(consumo.quantidade, 3);
    consumo.valor = arredondar(consumo.valor, 2);
  }
  return {
    porIngrediente,
    detalhes,
    semFicha: [...semFicha.values()].map((item) => ({ ...item, quantidadeVendida: arredondar(item.quantidadeVendida, 3) })),
    unidadesVendidas: arredondar(unidadesVendidas, 3),
    unidadesComFicha: arredondar(unidadesComFicha, 3),
    coberturaPercentual: unidadesVendidas > 0 ? arredondar((unidadesComFicha / unidadesVendidas) * 100, 1) : 100,
    avisos: [...avisos],
    produtosIntermediarios: [...produtosIntermediarios],
  };
}

/**
 * Consolida os custos de entrada conhecidos para permitir a valorização de
 * uma venda pela data em que ela aconteceu. O relatório não possui lotes
 * vinculados às vendas, portanto a política adotada aqui é custo médio das
 * entradas anteriores (NF-e e entradas sem nota), sem usar compras futuras.
 */
export function consolidarCustosHistoricos(importacoes = [], itens = [], entradasSemNota = []) {
  const importacoesPorId = new Map(importacoes.map((item) => [Number(item.id), item]));
  const porProduto = new Map();

  const adicionar = (produtoId, data, quantidade, custoUnitario) => {
    const id = Number(produtoId);
    const qtd = numero(quantidade);
    if (custoUnitario === null || custoUnitario === undefined || custoUnitario === '') return;
    const custo = numero(custoUnitario);
    const dataEntrada = new Date(data);
    if (!Number.isInteger(id) || id <= 0 || qtd <= 0 || !Number.isFinite(dataEntrada.getTime())) return;
    if (!porProduto.has(id)) porProduto.set(id, []);
    porProduto.get(id).push({ data: dataEntrada, quantidade: qtd, custoUnitario: custo });
  };

  for (const item of itens) {
    const importacao = importacoesPorId.get(Number(item.import_id));
    if (!importacao || String(item.action ?? '').toLowerCase() === 'skip') continue;
    adicionar(
      item.product_id,
      importacao.issued_at ?? importacao.imported_at,
      item.quantity,
      item.unit_cost,
    );
  }
  for (const entrada of entradasSemNota) {
    adicionar(entrada.produto_id, entrada.data_entrada, entrada.quantidade, entrada.preco_unitario);
  }

  for (const entradas of porProduto.values()) {
    entradas.sort((a, b) => a.data.getTime() - b.data.getTime());
  }
  return porProduto;
}

function custoMedioAteData(eventos = [], data) {
  const limite = new Date(data);
  if (!Number.isFinite(limite.getTime())) return null;
  let quantidade = 0;
  let valor = 0;
  for (const evento of eventos) {
    if (evento.data > limite) break;
    quantidade += numero(evento.quantidade);
    valor += numero(evento.quantidade) * numero(evento.custoUnitario);
  }
  return quantidade > 0 ? valor / quantidade : null;
}

function custoBaseProduto(produto) {
  if (!produto) return 0;
  return produto.preco_compra != null
    ? numero(produto.preco_compra)
    : numero(produto.price);
}

/**
 * Calcula o custo real dos produtos vendidos na competência. Para produtos
 * fabricados, abre a ficha e valoriza seus ingredientes pelo custo médio
 * histórico na data da venda; para produtos comprados, usa as entradas
 * anteriores à venda. Assim, uma compra/produção de agosto continua
 * compondo o custo de uma venda realizada em setembro.
 */
export function calcularCustoRealCompetencia({
  vendas = [],
  produtos = [],
  receitas = [],
  produtoPorRawMaterial = new Map(),
  custosHistoricos = new Map(),
} = {}) {
  const produtoPorId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
  const receitaPorProduto = indexarReceitasPorProduto(receitas);
  const custoCache = new Map();

  const custoUnitarioProduto = (produto, data, trilha = new Set()) => {
    if (!produto) return 0;
    const produtoId = Number(produto.id);
    const chave = `${produtoId}|${new Date(data).getTime()}`;
    if (custoCache.has(chave)) return custoCache.get(chave);
    if (trilha.has(produtoId)) return custoBaseProduto(produto);

    const receita = receitaPorProduto.get(produtoId);
    if (!receita?.itens?.length) {
      const custoHistorico = custoMedioAteData(custosHistoricos.get(produtoId), data);
      const custo = custoHistorico == null ? custoBaseProduto(produto) : custoHistorico;
      custoCache.set(chave, custo);
      return custo;
    }

    const proximaTrilha = new Set(trilha);
    proximaTrilha.add(produtoId);
    const custoLote = receita.itens.reduce((total, ingrediente) => {
      const quantidade = numero(ingrediente.quantidade);
      if (ingrediente.produtoMP) {
        return total + quantidade * custoUnitarioProduto(ingrediente.produtoMP, data, proximaTrilha);
      }
      const produtoIngrediente = produtoPorRawMaterial.get(Number(ingrediente.raw_material_id));
      const custoIngrediente = produtoIngrediente
        ? custoUnitarioProduto(produtoIngrediente, data, proximaTrilha)
        : numero(ingrediente.materiaPrima?.price);
      return total + quantidade * custoIngrediente;
    }, 0);
    const rendimento = resolverRendimentoReceita(receita, produtoPorRawMaterial).valor;
    const custo = rendimento > 0 ? custoLote / rendimento : 0;
    custoCache.set(chave, custo);
    return custo;
  };

  const porProduto = new Map();
  for (const venda of vendas) {
    const dataVenda = venda.data ?? venda.createdAt;
    for (const item of venda.itens ?? []) {
      if (String(item.tipo ?? '').toLowerCase() !== 'produto' || !item.produto_id) continue;
      const produtoId = Number(item.produto_id);
      const produto = produtoPorId.get(produtoId) ?? item.Product;
      if (!produto) continue;
      const quantidadeVendida = numero(item.quantidade);
      const custoUnitario = custoUnitarioProduto(produto, dataVenda);
      const atual = porProduto.get(produtoId) ?? {
        produtoId,
        produto: produto.name ?? item.nome_item ?? `Produto #${produtoId}`,
        categoria: produto.category ?? 'Sem categoria',
        unidade: produto.unidade_medida ?? 'UN',
        quantidadeVendida: 0,
        valorRealCompetencia: 0,
        custoUnitarioReal: 0,
        fonteCusto: receitaPorProduto.has(produtoId) ? 'ficha_tecnica_custo_historico' : 'entradas_historicas',
      };
      atual.quantidadeVendida += quantidadeVendida;
      atual.valorRealCompetencia += quantidadeVendida * custoUnitario;
      porProduto.set(produtoId, atual);
    }
  }

  return [...porProduto.values()]
    .map((linha) => {
      const custoUnitarioReal = linha.quantidadeVendida > 0
        ? linha.valorRealCompetencia / linha.quantidadeVendida
        : 0;
      return {
        ...linha,
        quantidadeVendida: arredondar(linha.quantidadeVendida, 3),
        custoUnitarioReal: arredondar(custoUnitarioReal, 4),
        valorRealCompetencia: arredondar(linha.valorRealCompetencia, 2),
      };
    })
    .sort((a, b) => Math.abs(b.valorRealCompetencia) - Math.abs(a.valorRealCompetencia) || a.produto.localeCompare(b.produto, 'pt-BR'));
}

export function montarComparativo({ produtos = [], posicoes = [], comprasPorProduto = new Map(), teoricoPorProduto = new Map() }) {
  const posicaoPorProduto = new Map(posicoes.map((item) => [Number(item.produtoId), item]));
  return produtos.map((produto) => {
    const id = Number(produto.id);
    const posicao = posicaoPorProduto.get(id) ?? { estoqueInicial: 0, estoqueFinal: 0 };
    const compra = comprasPorProduto.get(id) ?? { quantidade: 0, valor: 0 };
    const teorico = teoricoPorProduto.get(id) ?? { quantidade: 0, valor: 0 };
    const custoReferencia = compra.quantidade > 0
      ? compra.valor / compra.quantidade
      : numero(produto.preco_compra ?? produto.price);
    const consumoReal = numero(posicao.estoqueInicial) + numero(compra.quantidade) - numero(posicao.estoqueFinal);
    const valorReal = consumoReal * custoReferencia;
    const diferencaQuantidade = consumoReal - numero(teorico.quantidade);
    const diferencaValor = valorReal - numero(teorico.valor);
    return {
      produtoId: id,
      produto: produto.name,
      categoria: produto.category ?? 'Sem categoria',
      unidade: produto.unidade_medida ?? 'UN',
      estoqueInicial: arredondar(posicao.estoqueInicial, 3),
      compras: arredondar(compra.quantidade, 3),
      estoqueFinal: arredondar(posicao.estoqueFinal, 3),
      consumoReal: arredondar(consumoReal, 3),
      consumoTeorico: arredondar(teorico.quantidade, 3),
      custoReferencia: arredondar(custoReferencia, 4),
      valorFinanceiro: arredondar(compra.valor, 2),
      valorReal: arredondar(valorReal, 2),
      valorTeorico: arredondar(teorico.valor, 2),
      diferencaQuantidade: arredondar(diferencaQuantidade, 3),
      diferencaValor: arredondar(diferencaValor, 2),
    };
  }).filter((linha) => linha.estoqueInicial || linha.compras || linha.estoqueFinal || linha.consumoTeorico)
    .sort((a, b) => Math.abs(b.diferencaValor) - Math.abs(a.diferencaValor) || a.produto.localeCompare(b.produto, 'pt-BR'));
}
