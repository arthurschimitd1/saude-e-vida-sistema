// src/services/inteligencia-fiscal/rules/nota-fiscal/classificadores/index.js

import ClassificadorProduto
  from './ClassificadorProduto.js';

import ClassificadorCliente
  from './ClassificadorCliente.js';

import ClassificadorConfiguracaoFiscal
  from './ClassificadorConfiguracaoFiscal.js';

import ClassificadorPagamento
  from './ClassificadorPagamento.js';

import ClassificadorDocumentoFiscal
  from './ClassificadorDocumentoFiscal.js';

const classificadoresRetorno = [
  ClassificadorProduto,
  ClassificadorCliente,
  ClassificadorConfiguracaoFiscal,
  ClassificadorPagamento,
  ClassificadorDocumentoFiscal,
];

/**
 * Envia o erro para os classificadores registrados.
 *
 * O primeiro classificador que reconhecer o erro
 * determina sua classificação.
 *
 * @returns {Object|null}
 */
export function classificarErroRetorno({
  contexto,
  erro,
  indiceErro,
}) {
  for (const classificador of classificadoresRetorno) {
    const classificacao = classificador.classificar({
      contexto,
      erro,
      indiceErro,
    });

    if (classificacao) {
      return {
        ...classificacao,

        detalhes: {
          ...(classificacao.detalhes ?? {}),

          classificador:
            classificador.nome,

          indiceErro,
        },
      };
    }
  }

  return null;
}

export function listarClassificadoresRetorno() {
  return [...classificadoresRetorno];
}

export function validarClassificadoresRetorno() {
  const erros = [];

  for (const classificador of classificadoresRetorno) {
    if (!classificador.nome) {
      erros.push(
        'Existe um classificador sem nome.',
      );
    }

    if (
      typeof classificador.classificar !==
      'function'
    ) {
      erros.push(
        `O classificador ${
          classificador.nome ?? 'desconhecido'
        } não possui o método classificar().`,
      );
    }
  }

  if (erros.length > 0) {
    throw new Error(
      [
        'Classificadores fiscais inválidos:',
        ...erros.map((erro) => `- ${erro}`),
      ].join('\n'),
    );
  }

  return true;
}