// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/ClassificadorConfiguracaoFiscal.js

import {
  codigoEhUmDos,
  contemAlgum,
  indicaCampoAusente,
  obterTextoCompletoErro,
} from './utils.js';

const ClassificadorConfiguracaoFiscal = {
  nome: 'Classificador de configuração fiscal',

  classificar({ contexto, erro }) {
    const classificadores = [
      classificarEmitenteNaoCadastrado,
      classificarDocumentoEmitente,
      classificarInscricaoEstadualEmitente,
      classificarCsc,
      classificarRegimeTributario,
      classificarConfiguracaoGeral,
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

function classificarEmitenteNaoCadastrado({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  const corresponde =
    codigoEhUmDos(erro.codigo, ['245']) ||
    contemAlgum(texto, [
      'cnpj emitente nao cadastrado',
      'emitente nao cadastrado',
    ]);

  if (!corresponde) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra:
      'CONFIGURACAO_EMITENTE_NAO_CADASTRADO_SEFAZ',
    campoAfetado: 'cnpj_emitente',
    valorEncontrado:
      contexto?.configuracaoFiscal?.cnpj ??
      contexto?.nota?.emitente_cnpj ??
      null,
    valorEsperado:
      'CNPJ emitente cadastrado e habilitado na SEFAZ',
    tipoProblema: 'EMITENTE_NAO_CADASTRADO',
    severidade: 'CRITICA',
  });
}

function classificarDocumentoEmitente({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'cnpj emitente',
      'cpf emitente',
      'documento emitente',
    ])
  ) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra: indicaCampoAusente(erro)
      ? 'CONFIGURACAO_CNPJ_EMITENTE_AUSENTE'
      : 'CONFIGURACAO_CNPJ_EMITENTE_INVALIDO',
    campoAfetado: 'cnpj_emitente',
    valorEncontrado:
      contexto?.configuracaoFiscal?.cnpj ??
      contexto?.nota?.emitente_cnpj ??
      null,
    valorEsperado:
      'CNPJ válido do estabelecimento emitente',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
    severidade: 'CRITICA',
  });
}

function classificarInscricaoEstadualEmitente({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'inscricao estadual emitente',
      'ie emitente',
      'inscricao estadual do emitente',
    ])
  ) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra: indicaCampoAusente(erro)
      ? 'CONFIGURACAO_IE_EMITENTE_AUSENTE'
      : 'CONFIGURACAO_IE_EMITENTE_INVALIDA',
    campoAfetado: 'inscricao_estadual',
    valorEncontrado:
      contexto?.configuracaoFiscal
        ?.inscricao_estadual ??
      contexto?.configuracaoFiscal
        ?.inscricaoEstadual ??
      null,
    valorEsperado:
      'Inscrição estadual válida do emitente',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
    severidade: 'CRITICA',
  });
}

function classificarCsc({ contexto, erro }) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'csc',
      'codigo de seguranca do contribuinte',
      'token nfce',
      'id token',
      'identificador do csc',
    ])
  ) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra: 'CONFIGURACAO_CSC_INVALIDA',
    campoAfetado: 'csc',
    valorEncontrado: null,
    valorEsperado:
      'CSC e identificador do token configurados corretamente',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
    severidade: 'CRITICA',
  });
}

function classificarRegimeTributario({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'regime tributario',
      'codigo regime tributario',
      'crt',
      'simples nacional',
    ])
  ) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra:
      'CONFIGURACAO_REGIME_TRIBUTARIO_INCOMPATIVEL',
    campoAfetado: 'regime_tributario',
    valorEncontrado:
      contexto?.configuracaoFiscal
        ?.regime_tributario ??
      contexto?.configuracaoFiscal
        ?.regimeTributario ??
      null,
    valorEsperado:
      'Regime tributário compatível com a tributação dos itens',
    tipoProblema: 'VALOR_INCOMPATIVEL',
    severidade: 'CRITICA',
  });
}

function classificarConfiguracaoGeral({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'configuracao fiscal',
      'dados do emitente',
      'endereco do emitente',
      'emitente incompleto',
    ])
  ) {
    return null;
  }

  return criarClassificacaoConfiguracao({
    contexto,
    erro,
    codigoRegra:
      'CONFIGURACAO_FISCAL_INCOMPLETA',
    campoAfetado: erro.campo ?? 'configuracao_fiscal',
    valorEncontrado: null,
    valorEsperado:
      'Configuração fiscal completa e válida',
    tipoProblema: 'CONFIGURACAO_INCOMPLETA',
    severidade: 'CRITICA',
  });
}

function criarClassificacaoConfiguracao({
  contexto,
  erro,
  codigoRegra,
  campoAfetado,
  valorEncontrado,
  valorEsperado,
  tipoProblema,
  severidade,
}) {
  return {
    codigoRegra,
    categoria: 'CONFIGURACAO_FISCAL',
    campoAfetado,
    valorEncontrado,
    valorEsperado,
    severidade,
    itemRelacionado: null,
    produtoRelacionado: null,
    detalhes: {
      tipoProblema,
      configuracaoFiscalId:
        contexto?.configuracaoFiscal?.id ??
        null,
      campoProvedor: erro.campo ?? null,
      mensagemProvedor: erro.mensagem ?? null,
      codigoProvedor: erro.codigo ?? null,
    },
  };
}

export default ClassificadorConfiguracaoFiscal;