const arredondarMoeda = (valor) => Number(Number(valor || 0).toFixed(2));

const ajustarPagamentos = (pagamentos, valorTotal) => {
  let restante = arredondarMoeda(valorTotal);
  const originais = Array.isArray(pagamentos) ? pagamentos : [];
  const ajustados = [];

  for (const pagamento of originais) {
    if (restante <= 0) break;
    const valorOriginal = Number(pagamento?.valor || 0);
    if (valorOriginal <= 0) continue;

    const valor = arredondarMoeda(Math.min(valorOriginal, restante));
    ajustados.push({ ...pagamento, valor });
    restante = arredondarMoeda(restante - valor);
  }

  if (restante > 0) {
    ajustados.push({
      forma: originais[0]?.forma || 'DINHEIRO',
      valor: restante
    });
  }

  return ajustados;
};

export const selecionarItensFiscais = (venda, itemIds) => {
  const todosItens = Array.isArray(venda?.itens) ? venda.itens : [];

  if (itemIds === undefined) {
    return { itens: todosItens, vendaFiscal: venda, emissaoParcial: false };
  }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error('Selecione pelo menos um produto para emitir a nota fiscal.');
  }

  const idsRecebidos = itemIds.map(Number);
  if (idsRecebidos.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('A seleção de produtos da nota fiscal é inválida.');
  }

  const ids = [...new Set(idsRecebidos)];
  const itens = todosItens.filter(item => ids.includes(Number(item.id)));

  if (itens.length !== ids.length) {
    throw new Error('Um ou mais produtos selecionados não pertencem a esta venda.');
  }

  const emissaoParcial = itens.length < todosItens.length;
  if (!emissaoParcial) {
    return { itens: todosItens, vendaFiscal: venda, emissaoParcial: false };
  }

  const subtotalVenda = todosItens.reduce(
    (total, item) => total + Number(item.valor_total || 0),
    0
  );
  const subtotalFiscal = itens.reduce(
    (total, item) => total + Number(item.valor_total || 0),
    0
  );

  const descontoVenda = Number(venda.desconto || 0);
  const descontoFiscal = venda.tipo_desconto === 'percent'
    ? subtotalFiscal * (descontoVenda / 100)
    : (subtotalVenda > 0 ? descontoVenda * (subtotalFiscal / subtotalVenda) : 0);
  const descontoLimitado = arredondarMoeda(
    Math.min(Math.max(descontoFiscal, 0), subtotalFiscal)
  );
  const valorTotalFiscal = arredondarMoeda(subtotalFiscal - descontoLimitado);

  const vendaFiscal = {
    ...venda.toJSON(),
    itens,
    desconto: descontoLimitado,
    tipo_desconto: 'valor',
    taxa_entrega: 0,
    valor_total: valorTotalFiscal,
    pagamentos: ajustarPagamentos(venda.pagamentos, valorTotalFiscal)
  };

  return { itens, vendaFiscal, emissaoParcial: true };
};
