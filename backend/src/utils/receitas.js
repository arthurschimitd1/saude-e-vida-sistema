const numero = (valor) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

const UNIDADES_DISCRETAS = new Set(['UN', 'UND', 'UNIDADE', 'PC', 'PCT', 'CT', 'CX', 'DZ']);
const PADRAO_EMBALAGEM = /(^|\s)(saq(?:uinho)?|saco|embalagem|pote|copo|tampa|garrafa|frasco)(\.|\s|$)/i;

const ingredienteDoItem = (item, produtoPorRawMaterial = new Map()) => (
  item?.produtoMP
  ?? produtoPorRawMaterial.get(Number(item?.raw_material_id))
  ?? item?.materiaPrima
  ?? null
);

const unidadeIngrediente = (ingrediente) => String(
  ingrediente?.unidade_medida ?? ingrediente?.unit ?? '',
).trim().toUpperCase();

/**
 * Receitas antigas permitiam rendimento vazio. Para não transformar o custo de
 * um lote em custo unitário, infere-se somente quando existe um item de
 * embalagem discreto (por exemplo, 15 saquinhos = 15 unidades produzidas).
 * Fora desse caso conservador, o fallback continua sendo 1 e é sinalizado.
 */
export function resolverRendimentoReceita(receita, produtoPorRawMaterial = new Map()) {
  const informado = numero(receita?.rendimento);
  if (informado > 0) {
    return { valor: informado, origem: 'informado', inferido: false, pendente: false };
  }

  const candidatos = (receita?.itens ?? [])
    .map((item) => {
      const ingrediente = ingredienteDoItem(item, produtoPorRawMaterial);
      return {
        quantidade: numero(item?.quantidade),
        nome: String(ingrediente?.name ?? ''),
        unidade: unidadeIngrediente(ingrediente),
      };
    })
    .filter((item) => (
      item.quantidade > 1
      && UNIDADES_DISCRETAS.has(item.unidade)
      && PADRAO_EMBALAGEM.test(item.nome)
    ));

  if (candidatos.length) {
    const valor = Math.max(...candidatos.map((item) => item.quantidade));
    return { valor, origem: 'inferido_embalagem', inferido: true, pendente: false };
  }

  return { valor: 1, origem: 'padrao', inferido: true, pendente: true };
}

export function indexarReceitasPorProduto(receitas = []) {
  const mapa = new Map();
  for (const receita of receitas) {
    const produtoId = Number(receita?.produto_id);
    if (Number.isInteger(produtoId) && produtoId > 0 && !mapa.has(produtoId)) {
      mapa.set(produtoId, receita);
    }
  }
  return mapa;
}

export function receitaPossuiRendimentoPendente(
  receita,
  receitaPorProduto,
  produtoPorRawMaterial = new Map(),
  trilha = new Set(),
) {
  if (!receita) return false;
  const produtoId = Number(receita.produto_id);
  if (trilha.has(produtoId)) return true;
  if (resolverRendimentoReceita(receita, produtoPorRawMaterial).pendente) return true;
  const proximaTrilha = new Set(trilha);
  proximaTrilha.add(produtoId);
  return (receita.itens ?? []).some((item) => {
    const subReceita = item?.produtoMP
      ? receitaPorProduto.get(Number(item.produtoMP.id))
      : null;
    return subReceita
      ? receitaPossuiRendimentoPendente(subReceita, receitaPorProduto, produtoPorRawMaterial, proximaTrilha)
      : false;
  });
}

export function criarCalculadoraCustosReceitas(receitas = [], produtoPorRawMaterial = new Map()) {
  const receitaPorProduto = indexarReceitasPorProduto(receitas);
  const custoUnitarioCache = new Map();
  const avisos = new Set();

  const custoCadastrado = (produto) => numero(produto?.preco_compra ?? produto?.price);

  const custoUnitarioProduto = (produto, trilha = new Set()) => {
    const produtoId = Number(produto?.id);
    const receita = receitaPorProduto.get(produtoId);
    if (!receita) return custoCadastrado(produto);
    if (custoUnitarioCache.has(produtoId)) return custoUnitarioCache.get(produtoId);
    if (trilha.has(produtoId)) {
      avisos.add(`Ciclo entre fichas detectado no produto ${produto?.name ?? `#${produtoId}`}.`);
      return custoCadastrado(produto);
    }

    const proximaTrilha = new Set(trilha);
    proximaTrilha.add(produtoId);
    const custoLote = (receita.itens ?? []).reduce((total, item) => {
      if (item?.produtoMP) {
        return total + numero(item.quantidade) * custoUnitarioProduto(item.produtoMP, proximaTrilha);
      }
      const materia = item?.materiaPrima
        ?? produtoPorRawMaterial.get(Number(item?.raw_material_id));
      return total + numero(item?.quantidade) * custoCadastrado(materia);
    }, 0);
    const rendimento = resolverRendimentoReceita(receita, produtoPorRawMaterial);
    if (rendimento.inferido) {
      avisos.add(
        rendimento.pendente
          ? `A ficha “${receita.nome}” está sem rendimento e não possui embalagem que permita inferi-lo.`
          : `O rendimento ${rendimento.valor} da ficha “${receita.nome}” foi inferido pela quantidade de embalagens.`,
      );
    }
    const custoUnitario = custoLote / rendimento.valor;
    custoUnitarioCache.set(produtoId, custoUnitario);
    return custoUnitario;
  };

  const custoDaReceita = (receita) => {
    const custoLote = (receita?.itens ?? []).reduce((total, item) => {
      if (item?.produtoMP) {
        return total + numero(item.quantidade) * custoUnitarioProduto(item.produtoMP, new Set());
      }
      const materia = item?.materiaPrima
        ?? produtoPorRawMaterial.get(Number(item?.raw_material_id));
      return total + numero(item?.quantidade) * custoCadastrado(materia);
    }, 0);
    const rendimento = resolverRendimentoReceita(receita, produtoPorRawMaterial);
    return {
      custoLote,
      custoUnitario: custoLote / rendimento.valor,
      rendimento,
      pendente: receitaPossuiRendimentoPendente(receita, receitaPorProduto, produtoPorRawMaterial),
    };
  };

  return {
    avisos,
    custoDaReceita,
    custoUnitarioProduto,
    receitaPorProduto,
  };
}
