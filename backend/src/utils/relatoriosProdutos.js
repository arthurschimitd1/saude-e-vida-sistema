import { businessDate } from './businessTime.js';

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const normalizarTextoRelatorio = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export function resolverPeriodoRelatorio(dataInicio, dataFim, hoje = new Date()) {
  const hojeEmpresa = businessDate(hoje);
  const inicioPadrao = `${hojeEmpresa.slice(0, 7)}-01`;
  const inicio = dataInicio || inicioPadrao;
  const fim = dataFim || hojeEmpresa;

  if (!DATA_RE.test(String(inicio)) || !DATA_RE.test(String(fim))) {
    const erro = new Error('Informe o período no formato AAAA-MM-DD');
    erro.statusCode = 400;
    throw erro;
  }
  if (String(inicio) > String(fim)) {
    const erro = new Error('A data inicial não pode ser posterior à data final');
    erro.statusCode = 400;
    throw erro;
  }
  return { dataInicio: String(inicio), dataFim: String(fim) };
}

const numero = (valor) => {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
};

const aplicarFiltros = (linhas, { categoria, produto } = {}) => {
  const categoriaBusca = normalizarTextoRelatorio(categoria);
  const produtoBusca = normalizarTextoRelatorio(produto);
  return linhas.filter((linha) => {
    if (categoriaBusca && normalizarTextoRelatorio(linha.categoria) !== categoriaBusca) return false;
    if (produtoBusca && !normalizarTextoRelatorio(`${linha.produto} ${(linha.variacoes ?? []).map((v) => v.nome).join(' ')}`).includes(produtoBusca)) return false;
    return true;
  });
};

export function agruparVendasPorProduto(vendas = [], roupas = new Map(), variacoes = new Map(), filtros = {}, custosReceita = new Map()) {
  const grupos = new Map();
  const vendasComProdutos = new Set();

  for (const vendaOriginal of vendas) {
    const venda = typeof vendaOriginal?.get === 'function' ? vendaOriginal.get({ plain: true }) : vendaOriginal;
    const itensVenda = (venda?.itens ?? []).map((itemOriginal) => (
      typeof itemOriginal?.get === 'function' ? itemOriginal.get({ plain: true }) : itemOriginal
    ));
    const subtotalVenda = itensVenda.reduce((total, item) => total + Math.max(0, numero(item?.valor_total)), 0);
    const descontoInformado = Math.max(0, numero(venda?.desconto));
    const descontoTotal = normalizarTextoRelatorio(venda?.tipo_desconto) === 'percent'
      ? subtotalVenda * (descontoInformado / 100)
      : descontoInformado;
    for (const item of itensVenda) {
      const tipo = normalizarTextoRelatorio(item?.tipo);
      if (tipo === 'servico' || tipo === 'materia_prima') continue;

      const produtoModel = item?.Product ?? item?.produto ?? null;
      const roupa = item?.roupa_id ? roupas.get(Number(item.roupa_id)) : null;
      const variacao = item?.variacao_id ? variacoes.get(Number(item.variacao_id)) : null;
      const ehRoupa = tipo === 'roupa' || Boolean(item?.roupa_id);
      if (!produtoModel && !ehRoupa && !item?.nome_item) continue;

      const produto = ehRoupa
        ? (roupa?.nome ?? item?.nome_item ?? 'Peça de roupa')
        : (produtoModel?.name ?? item?.nome_item ?? 'Produto removido');
      const categoria = ehRoupa
        ? (roupa?.tipo ?? 'Roupas')
        : (produtoModel?.category ?? 'Sem categoria');
      const unidade = ehRoupa ? 'UN' : (produtoModel?.unidade_medida ?? 'UN');
      const chave = ehRoupa
        ? `roupa:${item?.roupa_id ?? normalizarTextoRelatorio(produto)}`
        : `produto:${item?.produto_id ?? normalizarTextoRelatorio(produto)}`;
      const custoReceita = !ehRoupa && item?.produto_id ? custosReceita.get(Number(item.produto_id)) : null;
      const custoUnitario = numero(custoReceita?.custoUnitario ?? (ehRoupa ? roupa?.preco_compra : produtoModel?.preco_compra));
      const fonteCusto = custoReceita?.custoUnitario > 0 ? 'ficha_tecnica' : 'cadastro_produto';

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: chave,
          produto,
          categoria,
          unidade,
          quantidade: 0,
          valorVendido: 0,
          custoTotal: 0,
          custoUnitario,
          fonteCusto,
          vendaIds: new Set(),
          variacoesMap: new Map(),
        });
      }

      const grupo = grupos.get(chave);
      const valorBruto = numero(item?.valor_total);
      const descontoRateado = filtros.considerarDesconto && subtotalVenda > 0
        ? Math.min(valorBruto, descontoTotal * (valorBruto / subtotalVenda))
        : 0;
      grupo.quantidade += numero(item?.quantidade);
      grupo.valorVendido += Math.max(0, valorBruto - descontoRateado);
      grupo.custoTotal += numero(item?.quantidade) * custoUnitario;
      if (venda?.id != null) {
        grupo.vendaIds.add(venda.id);
        vendasComProdutos.add(venda.id);
      }

      if (ehRoupa && variacao) {
        const nomeVariacao = [variacao.cor, variacao.tamanho].filter(Boolean).join(' · ') || 'Variação';
        grupo.variacoesMap.set(nomeVariacao, numero(grupo.variacoesMap.get(nomeVariacao)) + numero(item?.quantidade));
      }
    }
  }

  const todasLinhas = [...grupos.values()].map((grupo) => ({
    id: grupo.id,
    produto: grupo.produto,
    categoria: grupo.categoria,
    unidade: grupo.unidade,
    quantidade: grupo.quantidade,
    valorVendido: grupo.valorVendido,
    precoVendaMedio: grupo.quantidade > 0 ? grupo.valorVendido / grupo.quantidade : 0,
    custoUnitario: grupo.custoUnitario,
    custoTotal: grupo.custoTotal,
    lucroBruto: grupo.valorVendido - grupo.custoTotal,
    fonteCusto: grupo.fonteCusto,
    vendas: grupo.vendaIds.size,
    variacoes: [...grupo.variacoesMap.entries()].map(([nome, quantidade]) => ({ nome, quantidade })),
  }));
  const categorias = [...new Set(todasLinhas.map((linha) => linha.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const linhas = aplicarFiltros(todasLinhas, filtros)
    .sort((a, b) => b.quantidade - a.quantidade || b.valorVendido - a.valorVendido || a.produto.localeCompare(b.produto, 'pt-BR'));

  return {
    linhas,
    categorias,
    totais: {
      quantidade: linhas.reduce((soma, linha) => soma + linha.quantidade, 0),
      valorVendido: linhas.reduce((soma, linha) => soma + linha.valorVendido, 0),
      custoTotal: linhas.reduce((soma, linha) => soma + linha.custoTotal, 0),
      lucroBruto: linhas.reduce((soma, linha) => soma + linha.lucroBruto, 0),
      produtosSemCusto: linhas.filter((linha) => linha.custoUnitario <= 0).length,
      produtos: linhas.length,
      vendas: new Set(linhas.flatMap((linha) => {
        const grupo = grupos.get(linha.id);
        return grupo ? [...grupo.vendaIds] : [];
      })).size,
    },
  };
}

export function agruparProducaoPorProduto(movimentos = [], filtros = {}) {
  const grupos = new Map();

  for (const movimentoOriginal of movimentos) {
    const movimento = typeof movimentoOriginal?.get === 'function' ? movimentoOriginal.get({ plain: true }) : movimentoOriginal;
    const produtoModel = movimento?.produto ?? movimento?.Product ?? null;
    const nomeMotivo = String(movimento?.motivo ?? '').replace(/^Produção\s*[—-]\s*/i, '').trim();
    const produto = produtoModel?.name ?? nomeMotivo ?? 'Produto removido';
    const chave = `produto:${movimento?.produto_id ?? normalizarTextoRelatorio(produto)}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        id: chave,
        produto,
        categoria: produtoModel?.category ?? 'Produção',
        unidade: produtoModel?.unidade_medida ?? 'UN',
        quantidade: 0,
        ordemIds: new Set(),
      });
    }
    const grupo = grupos.get(chave);
    grupo.quantidade += numero(movimento?.quantidade);
    if (movimento?.origem_id != null) grupo.ordemIds.add(movimento.origem_id);
  }

  const todasLinhas = [...grupos.values()].map((grupo) => ({
    id: grupo.id,
    produto: grupo.produto,
    categoria: grupo.categoria,
    unidade: grupo.unidade,
    quantidade: grupo.quantidade,
    ordens: grupo.ordemIds.size,
  }));
  const categorias = [...new Set(todasLinhas.map((linha) => linha.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const linhas = aplicarFiltros(todasLinhas, filtros)
    .sort((a, b) => b.quantidade - a.quantidade || b.ordens - a.ordens || a.produto.localeCompare(b.produto, 'pt-BR'));

  return {
    linhas,
    categorias,
    totais: {
      quantidade: linhas.reduce((soma, linha) => soma + linha.quantidade, 0),
      produtos: linhas.length,
      ordens: new Set(linhas.flatMap((linha) => {
        const grupo = grupos.get(linha.id);
        return grupo ? [...grupo.ordemIds] : [];
      })).size,
    },
  };
}
