/**
 * Funções auxiliares utilizadas pelos contextos, regras e serviços
 * da Inteligência Fiscal.
 */

/**
 * Verifica se um valor está vazio.
 *
 * Considera vazio:
 * - null;
 * - undefined;
 * - string sem conteúdo;
 * - string contendo apenas espaços.
 */
export function estaVazio(valor) {
  return (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  );
}

/**
 * Remove caracteres que não sejam números de códigos fiscais.
 *
 * Exemplos:
 * "5102" -> "5102"
 * "51.02" -> "5102"
 * "2202.10.00" -> "22021000"
 */
export function normalizarCodigo(valor) {
  if (estaVazio(valor)) {
    return null;
  }

  return String(valor).replace(/\D/g, '');
}

/**
 * Converte um valor para número.
 *
 * Caso o valor não possa ser convertido, retorna o valor padrão
 * informado no segundo parâmetro.
 */
export function converterParaNumero(
  valor,
  valorPadrao = 0,
) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : valorPadrao;
}

/**
 * Converte uma instância de model do Sequelize em objeto simples.
 *
 * Caso o valor já seja um objeto comum, ele é retornado sem alteração.
 */
export function normalizarModel(model) {
  if (!model) {
    return null;
  }

  if (typeof model.toJSON === 'function') {
    return model.toJSON();
  }

  return model;
}

/**
 * Gera uma chave única para identificar uma inconsistência.
 *
 * A chave evita que a mesma regra crie várias inconsistências
 * para o mesmo objeto durante revalidações.
 */
export function gerarChaveInconsistencia({
  codigoRegra,
  tipoContexto,
  referenciaId,
  produtoId = null,
  itemId = null,
  campoAfetado = null,
}) {
  const partes = [
    codigoRegra,
    tipoContexto,
    referenciaId,
    produtoId ?? 'sem-produto',
    itemId ?? 'sem-item',
    campoAfetado ?? 'sem-campo',
  ];

  return partes.join(':');
}

/**
 * Remove valores duplicados e vazios de uma lista de identificadores.
 */
export function obterIdsUnicos(ids = []) {
  return [
    ...new Set(
      ids
        .filter(id => !estaVazio(id))
        .map(id => Number(id))
        .filter(Number.isFinite),
    ),
  ];
}

/**
 * Agrupa objetos em um Map utilizando uma propriedade como chave.
 *
 * É útil para relacionar os itens da venda aos produtos sem realizar
 * uma busca completa na lista para cada item.
 */
export function criarMapaPorId(
  registros = [],
  campoId = 'id',
) {
  return new Map(
    registros
      .filter(registro => registro?.[campoId] !== undefined)
      .map(registro => [
        Number(registro[campoId]),
        registro,
      ]),
  );
}

/**
 * Garante que o retorno de uma regra seja sempre uma lista.
 *
 * Isso evita erros caso uma regra não encontre problemas ou retorne
 * apenas uma inconsistência.
 */
export function normalizarResultadoRegra(resultado) {
  if (!resultado) {
    return [];
  }

  return Array.isArray(resultado)
    ? resultado
    : [resultado];
}