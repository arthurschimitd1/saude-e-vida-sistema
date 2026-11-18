const TIPOS_MANIFESTACAO = new Map([
  ['CIENCIA', 'ciencia'],
  ['ciencia', 'ciencia'],
  ['CONFIRMACAO', 'confirmacao'],
  ['confirmacao', 'confirmacao'],
  ['DESCONHECIMENTO', 'desconhecimento'],
  ['desconhecimento', 'desconhecimento'],
  ['OPERACAO_NAO_REALIZADA', 'nao_realizada'],
  ['NAO_REALIZADA', 'nao_realizada'],
  ['nao_realizada', 'nao_realizada']
]);

export function montarManifestacaoFocus(tipo, justificativa) {
  const tipoNormalizado = TIPOS_MANIFESTACAO.get(tipo);

  if (!tipoNormalizado) {
    throw new Error('Tipo de manifestação inválido');
  }

  const payload = { tipo: tipoNormalizado };

  if (tipoNormalizado === 'nao_realizada') {
    const texto = String(justificativa ?? '').trim();
    if (texto.length < 15 || texto.length > 255) {
      throw new Error('A justificativa deve ter entre 15 e 255 caracteres');
    }
    payload.justificativa = texto;
  }

  return payload;
}
