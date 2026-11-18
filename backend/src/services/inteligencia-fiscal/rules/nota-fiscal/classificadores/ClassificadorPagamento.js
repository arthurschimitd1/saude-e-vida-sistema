// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/ClassificadorPagamento.js

import {
  codigoEhUmDos,
  contemAlgum,
  obterTextoCompletoErro,
} from './utils.js';

const ClassificadorPagamento = {
  nome: 'Classificador de erros de pagamento',

  classificar({ contexto, erro }) {
    const classificadores = [
      classificarTotalPagamento,
      classificarTroco,
      classificarFormaPagamento,
    ];

    for (const classificador of classificadores) {
      const resultado = classificador({
        contexto,
        erro,
      });

      if (resultado) {
        return resultado;
      }
    }

    return null;
  },
};

function classificarTotalPagamento({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, [
      '865',
      '866',
    ]) ||
    contemAlgum(texto, [
      'total dos pagamentos',
      'valor dos pagamentos',
      'pagamento menor que o total',
      'pagamento superior ao total',
      'soma dos pagamentos',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoPagamento({
    contexto,
    erro,
    codigoRegra:
      'PAGAMENTO_TOTAL_DIVERGENTE',
    campoAfetado: 'formas_pagamento',
    valorEncontrado:
      calcularTotalPagamentos(contexto),
    valorEsperado:
      contexto?.nota?.valor_total ??
      contexto?.venda?.valor_total ??
      null,
    tipoProblema: 'VALOR_DIVERGENTE',
  });
}

function classificarTroco({ contexto, erro }) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, [
      '866',
    ]) ||
    contemAlgum(texto, [
      'valor do troco',
      'troco nao informado',
      'troco',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoPagamento({
    contexto,
    erro,
    codigoRegra:
      'PAGAMENTO_TROCO_INCONSISTENTE',
    campoAfetado: 'troco',
    valorEncontrado:
      contexto?.payloadEnviado?.troco ??
      contexto?.payload_enviado?.troco ??
      null,
    valorEsperado:
      'Troco compatível com o total pago e o valor da nota',
    tipoProblema: 'VALOR_DIVERGENTE',
  });
}

function classificarFormaPagamento({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'forma de pagamento',
      'meio de pagamento',
      'tipo de pagamento',
      'formas_pagamento',
    ])
  ) {
    return null;
  }

  return criarClassificacaoPagamento({
    contexto,
    erro,
    codigoRegra:
      'PAGAMENTO_FORMA_INVALIDA',
    campoAfetado: 'forma_pagamento',
    valorEncontrado:
      obterFormasPagamento(contexto),
    valorEsperado:
      'Forma de pagamento aceita pela NF-e/NFC-e',
    tipoProblema: 'VALOR_INVALIDO',
  });
}

function obterFormasPagamento(contexto) {
  return (
    contexto?.payloadEnviado?.formas_pagamento ??
    contexto?.payload_enviado?.formas_pagamento ??
    contexto?.venda?.pagamentos ??
    null
  );
}

function calcularTotalPagamentos(contexto) {
  const formas = obterFormasPagamento(contexto);

  if (!Array.isArray(formas)) {
    return null;
  }

  return formas.reduce((total, forma) => {
    const valor = Number(
      forma.valor_pagamento ??
      forma.valor ??
      0,
    );

    return total + (Number.isFinite(valor) ? valor : 0);
  }, 0);
}

function criarClassificacaoPagamento({
  contexto,
  erro,
  codigoRegra,
  campoAfetado,
  valorEncontrado,
  valorEsperado,
  tipoProblema,
}) {
  return {
    codigoRegra,
    categoria: 'PAGAMENTO',
    campoAfetado,
    valorEncontrado,
    valorEsperado,
    severidade: 'ALTA',
    itemRelacionado: null,
    produtoRelacionado: null,
    detalhes: {
      tipoProblema,
      vendaId:
        contexto?.venda?.id ??
        contexto?.nota?.venda_id ??
        null,
      campoProvedor: erro.campo ?? null,
      mensagemProvedor: erro.mensagem ?? null,
      codigoProvedor: erro.codigo ?? null,
    },
  };
}

export default ClassificadorPagamento;