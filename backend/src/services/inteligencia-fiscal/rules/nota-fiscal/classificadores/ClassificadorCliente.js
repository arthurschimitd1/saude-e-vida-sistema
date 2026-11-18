// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/ClassificadorCliente.js

import {
  codigoEhUmDos,
  contemAlgum,
  indicaCampoAusente,
  obterTextoCompletoErro,
} from './utils.js';

const ClassificadorCliente = {
  nome: 'Classificador de erros do destinatário',

  classificar({ contexto, erro }) {
    const classificadores = [
      classificarDestinatarioAusente,
      classificarDocumentoDestinatario,
      classificarInscricaoEstadual,
      classificarEnderecoDestinatario,
      classificarDestinatarioContribuinte,
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

function classificarDestinatarioAusente({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, ['719']) ||
    contemAlgum(texto, [
      'sem a identificacao do destinatario',
      'destinatario nao informado',
      'destinatario ausente',
      'identificacao do destinatario',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoCliente({
    contexto,
    erro,
    codigoRegra: 'CLIENTE_DESTINATARIO_AUSENTE',
    campoAfetado: 'destinatario',
    valorEncontrado: null,
    valorEsperado:
      'Destinatário identificado para a emissão da NF-e',
    tipoProblema: 'CAMPO_AUSENTE',
  });
}

function classificarDocumentoDestinatario({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde = contemAlgum(texto, [
    'cpf destinatario',
    'cnpj destinatario',
    'documento destinatario',
    'cpf/cnpj destinatario',
    'cpf do destinatario',
    'cnpj do destinatario',
  ]);

  if (!corresponde) {
    return null;
  }

  const documento =
    contexto?.cliente?.cpf ??
    contexto?.cliente?.cnpj ??
    contexto?.cliente?.documento ??
    contexto?.nota?.destinatario_documento ??
    null;

  return criarClassificacaoCliente({
    contexto,
    erro,
    codigoRegra: indicaCampoAusente(erro)
      ? 'CLIENTE_DOCUMENTO_AUSENTE'
      : 'CLIENTE_DOCUMENTO_INVALIDO',
    campoAfetado: 'documento',
    valorEncontrado: documento,
    valorEsperado:
      'CPF ou CNPJ válido do destinatário',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
  });
}

function classificarInscricaoEstadual({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'inscricao estadual destinatario',
      'ie destinatario',
      'inscricao estadual do destinatario',
    ])
  ) {
    return null;
  }

  return criarClassificacaoCliente({
    contexto,
    erro,
    codigoRegra: indicaCampoAusente(erro)
      ? 'CLIENTE_INSCRICAO_ESTADUAL_AUSENTE'
      : 'CLIENTE_INSCRICAO_ESTADUAL_INVALIDA',
    campoAfetado: 'inscricao_estadual',
    valorEncontrado:
      contexto?.cliente?.inscricao_estadual ??
      contexto?.cliente?.inscricaoEstadual ??
      null,
    valorEsperado:
      'Inscrição estadual válida ou indicador de não contribuinte',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
  });
}

function classificarEnderecoDestinatario({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'endereco do destinatario',
      'endereco destinatario',
      'logradouro destinatario',
      'cep destinatario',
      'municipio destinatario',
      'bairro destinatario',
    ])
  ) {
    return null;
  }

  return criarClassificacaoCliente({
    contexto,
    erro,
    codigoRegra:
      'CLIENTE_ENDERECO_FISCAL_INCOMPLETO',
    campoAfetado: identificarCampoEndereco(texto),
    valorEncontrado: null,
    valorEsperado:
      'Endereço fiscal completo do destinatário',
    tipoProblema: 'CONFIGURACAO_INCOMPLETA',
  });
}

function classificarDestinatarioContribuinte({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, ['789']) ||
    contemAlgum(texto, [
      'destinatario contribuinte do icms',
      'destinatario contribuinte icms',
      'indicador da ie do destinatario',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoCliente({
    contexto,
    erro,
    codigoRegra:
      'CLIENTE_INDICADOR_CONTRIBUINTE_INCOMPATIVEL',
    campoAfetado: 'indicador_contribuinte',
    valorEncontrado:
      contexto?.cliente?.indicador_contribuinte ??
      contexto?.cliente?.contribuinte_icms ??
      null,
    valorEsperado:
      'Indicador de contribuinte compatível com a inscrição estadual',
    tipoProblema: 'VALOR_INCOMPATIVEL',
  });
}

function identificarCampoEndereco(texto) {
  if (texto.includes('cep')) {
    return 'cep';
  }

  if (texto.includes('logradouro')) {
    return 'logradouro';
  }

  if (texto.includes('municipio')) {
    return 'municipio';
  }

  if (texto.includes('bairro')) {
    return 'bairro';
  }

  return 'endereco';
}

function criarClassificacaoCliente({
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
    categoria: 'CLIENTE',
    campoAfetado,
    valorEncontrado,
    valorEsperado,
    severidade: 'ALTA',
    itemRelacionado: null,
    produtoRelacionado: null,
    detalhes: {
      tipoProblema,
      clienteId:
        contexto?.cliente?.id ??
        contexto?.venda?.cliente_id ??
        null,
      campoProvedor: erro.campo ?? null,
      mensagemProvedor: erro.mensagem ?? null,
      codigoProvedor: erro.codigo ?? null,
    },
  };
}

export default ClassificadorCliente;