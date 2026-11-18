import ManifestoEvento from '../../models/ManifestoEvento.js';

const removerSegredos = (dados) => {
  if (!dados || typeof dados !== 'object') return {};
  const seguro = JSON.parse(JSON.stringify(dados));
  for (const chave of ['token', 'senha', 'certificado', 'xml_enviado', 'xml_autorizado']) {
    if (chave in seguro) seguro[chave] = '[PROTEGIDO]';
  }
  return seguro;
};

class ManifestoAuditService {
  async registrar({
    empresaId,
    usuarioId,
    entidadeTipo,
    entidadeId,
    acao,
    statusAnterior,
    statusPosterior,
    protocolo,
    justificativa,
    resultado = 'SUCESSO',
    codigoRetorno,
    motivoRetorno,
    dados = {},
    ip,
    transaction
  }) {
    return ManifestoEvento.create({
      empresa_id: empresaId,
      usuario_id: usuarioId ?? null,
      entidade_tipo: entidadeTipo,
      entidade_id: String(entidadeId),
      acao,
      status_anterior: statusAnterior ?? null,
      status_posterior: statusPosterior ?? null,
      protocolo: protocolo ?? null,
      justificativa: justificativa ?? null,
      resultado,
      codigo_retorno: codigoRetorno ?? null,
      motivo_retorno: motivoRetorno ?? null,
      dados: removerSegredos(dados),
      ip: ip ?? null
    }, { transaction });
  }
}

export default new ManifestoAuditService();
