export async function prepararSaidaPagamento(body, anterior, empresaId, buscarTurno) {
  const forma = body.forma_pagamento === undefined ? anterior?.forma_pagamento ?? null : body.forma_pagamento;
  if (forma !== null && !['DINHEIRO', 'PIX', 'CARTAO'].includes(forma)) throw new Error('Forma de pagamento da saída inválida');
  const rawTurno = body.turno_id === undefined ? anterior?.turno_id ?? null : body.turno_id;
  const turnoId = rawTurno == null ? null : Number(rawTurno);
  if (turnoId !== null && (!Number.isSafeInteger(turnoId) || turnoId <= 0)) throw new Error('Turno da saída inválido');
  if (anterior?.turno_id != null && turnoId !== Number(anterior.turno_id)) throw new Error('Não é permitido transferir ou desvincular uma saída de seu turno');
  const campos = { forma_pagamento: forma, turno_id: turnoId };
  if (turnoId !== null) {
    if (!empresaId) throw new Error('Selecione a empresa da saída');
    const turno = await buscarTurno({ where: { id: turnoId, empresa_id: empresaId } });
    if (!turno) throw new Error('Turno não encontrado nesta empresa');
    if (turno.status !== 'aberto' && Number(anterior?.turno_id) !== turnoId) throw new Error('Abra ou selecione um turno aberto para registrar a saída');
    if (!forma) throw new Error('Informe a forma de pagamento da saída');
    if ((body.natureza ?? anterior?.natureza ?? 'SAIDA') !== 'SAIDA') throw new Error('O lançamento do caixa deve ser uma saída');
    if (body.status != null && body.status !== 'pago') throw new Error('Saída de turno representa um pagamento realizado');
    const valor = Number(body.valor ?? anterior?.valor);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero');
    campos.status = 'pago';
  }
  return campos;
}
