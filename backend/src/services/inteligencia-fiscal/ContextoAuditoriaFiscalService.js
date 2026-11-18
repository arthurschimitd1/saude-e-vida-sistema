// src/services/fiscal/inteligencia/ContextoAuditoriaFiscalService.js

import ContextoNotaFiscal from './contexts/ContextoNotaFiscal.js';

/**
 * Registro dos contextos atualmente suportados.
 *
 * Para adicionar um novo contexto futuramente:
 * 1. criar o arquivo responsável pelo carregamento;
 * 2. importar o novo contexto aqui;
 * 3. registrar a chave correspondente neste objeto.
 */
const contextosDisponiveis = {
  NOTA_FISCAL: ContextoNotaFiscal,
};

class ContextoAuditoriaFiscalService {
  /**
   * Carrega os dados necessários para a execução de uma auditoria.
   *
   * @param {Object} parametros
   * @param {string} parametros.tipoContexto
   * @param {number|string} parametros.referenciaId
   * @param {number|string} parametros.empresaId
   * @param {Object|null} parametros.transaction
   */
  async carregar({
    tipoContexto,
    referenciaId,
    empresaId,
    transaction = null,
  }) {
    this.validarParametros({
      tipoContexto,
      referenciaId,
      empresaId,
    });

    const tipoNormalizado =
      this.normalizarTipoContexto(tipoContexto);

    const contexto = contextosDisponiveis[tipoNormalizado];

    if (!contexto) {
      throw new Error(
        `Contexto de auditoria não suportado: ${tipoNormalizado}.`,
      );
    }

    return contexto.carregar({
      referenciaId: Number(referenciaId),
      empresaId: Number(empresaId),
      transaction,
    });
  }

  /**
   * Verifica se um determinado contexto está disponível.
   */
  contextoSuportado(tipoContexto) {
    if (!tipoContexto) {
      return false;
    }

    const tipoNormalizado =
      this.normalizarTipoContexto(tipoContexto);

    return Boolean(
      contextosDisponiveis[tipoNormalizado],
    );
  }

  /**
   * Retorna a lista de contextos registrados.
   *
   * Pode ser útil futuramente para validações,
   * documentação ou retorno de endpoints.
   */
  listarContextosSuportados() {
    return Object.keys(contextosDisponiveis);
  }

  /**
   * Padroniza o valor recebido.
   *
   * Exemplos:
   * "nota_fiscal" -> "NOTA_FISCAL"
   * " Nota_Fiscal " -> "NOTA_FISCAL"
   */
  normalizarTipoContexto(tipoContexto) {
    return String(tipoContexto)
      .trim()
      .toUpperCase();
  }

  /**
   * Valida os parâmetros mínimos necessários
   * para carregar qualquer contexto.
   */
  validarParametros({
    tipoContexto,
    referenciaId,
    empresaId,
  }) {
    if (!tipoContexto) {
      throw new Error(
        'O tipo de contexto da auditoria é obrigatório.',
      );
    }

    if (
      referenciaId === null ||
      referenciaId === undefined ||
      referenciaId === ''
    ) {
      throw new Error(
        'A referência do contexto da auditoria é obrigatória.',
      );
    }

    if (
      empresaId === null ||
      empresaId === undefined ||
      empresaId === ''
    ) {
      throw new Error(
        'A empresa da auditoria é obrigatória.',
      );
    }

    if (!Number.isInteger(Number(referenciaId))) {
      throw new Error(
        'A referência do contexto da auditoria deve ser um número inteiro.',
      );
    }

    if (!Number.isInteger(Number(empresaId))) {
      throw new Error(
        'A empresa da auditoria deve ser um número inteiro.',
      );
    }
  }
}

export default new ContextoAuditoriaFiscalService();