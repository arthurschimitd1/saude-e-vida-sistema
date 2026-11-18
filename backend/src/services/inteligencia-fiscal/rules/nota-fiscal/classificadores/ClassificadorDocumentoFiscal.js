// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/ClassificadorDocumentoFiscal.js

import {
  codigoEhUmDos,
  contemAlgum,
  obterTextoCompletoErro,
} from './utils.js';

const ClassificadorDocumentoFiscal = {
  nome: 'Classificador de documento fiscal',

  classificar({ contexto, erro }) {
    const classificadores = [
      classificarDataEmissao,
      classificarDuplicidade,
      classificarNumeracao,
      classificarCancelamento,
      classificarFrete,
      classificarTotalNota,
      classificarTipoDocumento,
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

function classificarDataEmissao({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, ['704']) ||
    contemAlgum(texto, [
      'data-hora de emissao atrasada',
      'data hora de emissao atrasada',
      'data de emissao atrasada',
      'data de emissao posterior',
      'data de emissao invalida',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_DATA_EMISSAO_INVALIDA',
    campoAfetado: 'data_emissao',
    valorEncontrado:
      contexto?.nota?.data_emissao ??
      contexto?.payloadEnviado?.data_emissao ??
      null,
    valorEsperado:
      'Data e hora de emissão dentro do limite aceito pela SEFAZ',
    tipoProblema: 'VALOR_INVALIDO',
  });
}

function classificarDuplicidade({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, [
      '539',
      '204',
    ]) ||
    contemAlgum(texto, [
      'duplicidade de nfe',
      'duplicidade de nf-e',
      'duplicidade de nfce',
      'duplicidade de documento fiscal',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_NUMERACAO_DUPLICADA',
    campoAfetado: 'numero',
    valorEncontrado:
      contexto?.nota?.numero ??
      contexto?.payloadEnviado?.numero ??
      null,
    valorEsperado:
      'Número de documento fiscal ainda não utilizado na mesma série',
    tipoProblema: 'DUPLICIDADE',
    severidade: 'CRITICA',
  });
}

function classificarNumeracao({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'numero da nota',
      'numero da nfe',
      'numero da nfce',
      'serie da nota',
      'numeracao',
    ])
  ) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_NUMERACAO_INVALIDA',
    campoAfetado: texto.includes('serie')
      ? 'serie'
      : 'numero',
    valorEncontrado: texto.includes('serie')
      ? contexto?.nota?.serie
      : contexto?.nota?.numero,
    valorEsperado:
      'Número e série válidos e disponíveis para emissão',
    tipoProblema: 'VALOR_INVALIDO',
    severidade: 'CRITICA',
  });
}

function classificarCancelamento({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, [
      '535',
      '501',
      '573',
    ]) ||
    contemAlgum(texto, [
      'prazo de cancelamento',
      'cancelamento fora do prazo',
      'evento de cancelamento',
      'nota ja cancelada',
      'documento ja cancelado',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_CANCELAMENTO_REJEITADO',
    campoAfetado: 'cancelamento',
    valorEncontrado:
      contexto?.nota?.status ??
      null,
    valorEsperado:
      'Cancelamento aceito dentro das regras e prazos da SEFAZ',
    tipoProblema: 'REJEICAO_CANCELAMENTO',
    severidade: 'ALTA',
  });
}

function classificarFrete({ contexto, erro }) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, [
      '745',
    ]) ||
    contemAlgum(texto, [
      'valor do frete',
      'total do frete',
      'frete dos itens',
      'frete divergente',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_VALOR_FRETE_DIVERGENTE',
    campoAfetado: 'valor_frete',
    valorEncontrado:
      contexto?.payloadEnviado?.valor_frete ??
      contexto?.payload_enviado?.valor_frete ??
      null,
    valorEsperado:
      'Soma do frete dos itens igual ao total de frete da nota',
    tipoProblema: 'VALOR_DIVERGENTE',
  });
}

function classificarTotalNota({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'total da nota',
      'valor total da nota',
      'soma dos itens',
      'total dos produtos',
      'total do documento',
    ])
  ) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_VALOR_TOTAL_DIVERGENTE',
    campoAfetado: 'valor_total',
    valorEncontrado:
      contexto?.nota?.valor_total ??
      null,
    valorEsperado:
      'Valor total compatível com itens, descontos, acréscimos e frete',
    tipoProblema: 'VALOR_DIVERGENTE',
  });
}

function classificarTipoDocumento({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'modelo do documento',
      'tipo de documento',
      'modelo 55',
      'modelo 65',
      'nfe',
      'nfce',
    ])
  ) {
    return null;
  }

  if (
    !contemAlgum(texto, [
      'modelo invalido',
      'tipo invalido',
      'nao permitido para',
      'incompativel',
    ])
  ) {
    return null;
  }

  return criarClassificacaoDocumento({
    contexto,
    erro,
    codigoRegra:
      'NOTA_TIPO_DOCUMENTO_INCOMPATIVEL',
    campoAfetado: 'tipo',
    valorEncontrado:
      contexto?.nota?.tipo ??
      null,
    valorEsperado:
      'Tipo de documento compatível com a operação fiscal',
    tipoProblema: 'VALOR_INCOMPATIVEL',
  });
}

function criarClassificacaoDocumento({
  contexto,
  erro,
  codigoRegra,
  campoAfetado,
  valorEncontrado,
  valorEsperado,
  tipoProblema,
  severidade = 'ALTA',
}) {
  return {
    codigoRegra,
    categoria: 'NOTA_FISCAL',
    campoAfetado,
    valorEncontrado,
    valorEsperado,
    severidade,
    itemRelacionado: null,
    produtoRelacionado: null,
    detalhes: {
      tipoProblema,
      notaFiscalId:
        contexto?.nota?.id ??
        null,
      campoProvedor: erro.campo ?? null,
      mensagemProvedor: erro.mensagem ?? null,
      codigoProvedor: erro.codigo ?? null,
    },
  };
}

export default ClassificadorDocumentoFiscal;