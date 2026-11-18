// src/services/fiscal/inteligencia/regras/index.js

import RetornoEmissaoRule from "./nota-fiscal/RetornoEmissaoRule.js";

const regrasAuditoriaFiscal = [
  RetornoEmissaoRule,
];

export function listarRegras() {
  return [...regrasAuditoriaFiscal];
}

export function obterRegrasPorContexto(tipoContexto) {
  const tipoNormalizado =
    normalizarTipoContexto(tipoContexto);

  return regrasAuditoriaFiscal.filter(regra =>
    regra.contextosAplicaveis.includes(tipoNormalizado),
  );
}

/**
 * Localiza uma regra pelo código interno.
 *
 * Exemplo:
 * obterRegraPorCodigo('PRODUTO_NCM_AUSENTE')
 */
export function obterRegraPorCodigo(codigoRegra) {
  if (!codigoRegra) {
    return null;
  }

  const codigoNormalizado = String(codigoRegra)
    .trim()
    .toUpperCase();

  return regrasAuditoriaFiscal.find(
    regra => regra.codigo === codigoNormalizado,
  ) ?? null;
}

export function regraRegistrada(codigoRegra) {
  return Boolean(
    obterRegraPorCodigo(codigoRegra),
  );
}

function normalizarTipoContexto(tipoContexto) {
  if (!tipoContexto) {
    throw new Error(
      'O tipo de contexto é obrigatório para selecionar as regras.',
    );
  }

  return String(tipoContexto)
    .trim()
    .toUpperCase();
}

/**
 * Valida a estrutura mínima de todas as regras registradas.
 *
 * Essa validação pode ser executada na inicialização
 * da aplicação ou antes de uma auditoria.
 */
export function validarRegrasRegistradas() {
  const codigosEncontrados = new Set();

  for (const regra of regrasAuditoriaFiscal) {
    validarEstruturaRegra(regra);

    if (codigosEncontrados.has(regra.codigo)) {
      throw new Error(
        `Existe mais de uma regra registrada com o código ${regra.codigo}.`,
      );
    }

    codigosEncontrados.add(regra.codigo);
  }

  return true;
}

/**
 * Valida a estrutura individual de uma regra.
 */
function validarEstruturaRegra(regra) {
  if (!regra || typeof regra !== 'object') {
    throw new Error(
      'Todas as regras da auditoria devem ser objetos.',
    );
  }

  if (!regra.codigo) {
    throw new Error(
      'Uma regra da auditoria não possui código.',
    );
  }

  if (!regra.nome) {
    throw new Error(
      `A regra ${regra.codigo} não possui nome.`,
    );
  }

  if (
    !Array.isArray(regra.contextosAplicaveis) ||
    regra.contextosAplicaveis.length === 0
  ) {
    throw new Error(
      `A regra ${regra.codigo} não possui contextos aplicáveis.`,
    );
  }

  if (typeof regra.executar !== 'function') {
    throw new Error(
      `A regra ${regra.codigo} não possui o método executar().`,
    );
  }
}

export default regrasAuditoriaFiscal;