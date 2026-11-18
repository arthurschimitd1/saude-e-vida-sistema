const centavos = value => Math.round((Number(value) || 0) * 100);

export function calcularResumoTurno(turno, vendas, saidas) {
  const entradas = { DINHEIRO: 0, PIX: 0, CARTAO: 0 };
  const qtd = { DINHEIRO: 0, PIX: 0, CARTAO: 0 };
  const retiradas = { DINHEIRO: 0, PIX: 0, CARTAO: 0 };
  let troco = 0, qtdTrocos = 0, total = 0, semForma = 0;
  for (const venda of vendas) {
    const pagamentos = Array.isArray(venda.pagamentos) && venda.pagamentos.length
      ? venda.pagamentos : [{ forma: venda.forma_pagamento, valor: venda.valor_total }];
    for (const pagamento of pagamentos) {
      const valor = centavos(pagamento.valor);
      total += valor;
      if (Object.hasOwn(entradas, pagamento.forma)) { entradas[pagamento.forma] += valor; qtd[pagamento.forma]++; }
      if (pagamento.forma === 'DINHEIRO') {
        const valorTroco = Math.max(0, centavos(pagamento.valorRecebido) - valor);
        troco += valorTroco;
        if (valorTroco) qtdTrocos++;
      }
    }
  }
  const pagas = saidas.filter(s => s.natureza === 'SAIDA' && s.status === 'pago');
  for (const saida of pagas) {
    if (Object.hasOwn(retiradas, saida.forma_pagamento)) retiradas[saida.forma_pagamento] += centavos(saida.valor);
    else semForma += centavos(saida.valor);
  }
  const totalSaidas = Object.values(retiradas).reduce((a, b) => a + b, semForma);
  // pagamento.valor já é o valor líquido da venda: não descontar troco duas vezes.
  const saldo = centavos(turno.valor_abertura) + entradas.DINHEIRO - retiradas.DINHEIRO;
  const duracaoMs = turno.data_abertura ? new Date(turno.data_fechamento ?? Date.now()) - new Date(turno.data_abertura) : 0;
  const mins = Math.max(0, Math.floor(duracaoMs / 60000));
  return {
    totalVendas: vendas.length, totalGeral: total / 100,
    totalDinheiro: entradas.DINHEIRO / 100, qtdDinheiro: qtd.DINHEIRO,
    totalPix: entradas.PIX / 100, qtdPix: qtd.PIX, totalCartao: entradas.CARTAO / 100, qtdCartao: qtd.CARTAO,
    trocoTotal: troco / 100, qtdTrocos,
    totalSaidas: totalSaidas / 100, qtdSaidas: pagas.length,
    saidasDinheiro: retiradas.DINHEIRO / 100, saidasPix: retiradas.PIX / 100, saidasCartao: retiradas.CARTAO / 100,
    saidasSemForma: semForma / 100,
    liquidoDinheiro: (entradas.DINHEIRO - retiradas.DINHEIRO) / 100,
    liquidoPix: (entradas.PIX - retiradas.PIX) / 100, liquidoCartao: (entradas.CARTAO - retiradas.CARTAO) / 100,
    saldoEsperado: saldo / 100,
    diferenca: turno.valor_fechamento == null ? null : (centavos(turno.valor_fechamento) - saldo) / 100,
    duracaoMs, duracaoTexto: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`,
  };
}
