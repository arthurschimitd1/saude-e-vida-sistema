// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/ClassificadorProduto.js

import {
  contemAlgum,
  erroRelacionadoAoCampo,
  indicaCampoAusente,
  indicaValorInvalido,
  obterReferenciasProduto,
  obterTextoCompletoErro,
} from './utils.js';

const ClassificadorProduto = {
  nome: 'Classificador de erros de produto',

  classificar({ contexto, erro }) {
    const classificadores = [
      classificarNcm,
      classificarCfop,
      classificarPis,
      classificarCofins,
      classificarCsosn,
      classificarCstIcms,
      classificarOrigemMercadoria,
      classificarUnidadeComercial,
      classificarTributacaoProduto,
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

function classificarNcm({ contexto, erro }) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'codigo_ncm',
      'ncm',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload?.codigo_ncm ??
    referencias.itemPayload?.ncm ??
    referencias.produtoRelacionado?.ncm ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_NCM_AUSENTE',
      campoAfetado: 'ncm',
      valorEncontrado,
      valorEsperado:
        'Código NCM preenchido com 8 dígitos',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_NCM_INVALIDO',
    campoAfetado: 'ncm',
    valorEncontrado,
    valorEsperado:
      'Código NCM válido com exatamente 8 dígitos',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarCfop({ contexto, erro }) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'cfop',
      'codigo fiscal de operacao',
      'codigo fiscal da operacao',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload?.cfop ??
    referencias.produtoRelacionado?.cfop ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_CFOP_AUSENTE',
      campoAfetado: 'cfop',
      valorEncontrado,
      valorEsperado:
        'CFOP preenchido com 4 dígitos',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_CFOP_INVALIDO',
    campoAfetado: 'cfop',
    valorEncontrado,
    valorEsperado:
      'CFOP válido e compatível com a operação fiscal',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarPis({ contexto, erro }) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'pis_situacao_tributaria',
      'cst pis',
      'grupo pis',
      'tributacao pis',
      'pis',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload
      ?.pis_situacao_tributaria ??
    referencias.itemPayload?.cst_pis ??
    referencias.produtoRelacionado?.cst_pis ??
    referencias.produtoRelacionado
      ?.pis_situacao_tributaria ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_PIS_AUSENTE',
      campoAfetado: 'cst_pis',
      valorEncontrado,
      valorEsperado:
        'Situação tributária do PIS preenchida',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_PIS_INVALIDO',
    campoAfetado: 'cst_pis',
    valorEncontrado,
    valorEsperado:
      'Situação tributária do PIS válida para a operação',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarCofins({ contexto, erro }) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'cofins_situacao_tributaria',
      'cst cofins',
      'grupo cofins',
      'tributacao cofins',
      'cofins',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload
      ?.cofins_situacao_tributaria ??
    referencias.itemPayload?.cst_cofins ??
    referencias.produtoRelacionado?.cst_cofins ??
    referencias.produtoRelacionado
      ?.cofins_situacao_tributaria ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_COFINS_AUSENTE',
      campoAfetado: 'cst_cofins',
      valorEncontrado,
      valorEsperado:
        'Situação tributária do COFINS preenchida',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_COFINS_INVALIDO',
    campoAfetado: 'cst_cofins',
    valorEncontrado,
    valorEsperado:
      'Situação tributária do COFINS válida para a operação',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarCsosn({ contexto, erro }) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'icms_situacao_tributaria',
      'csosn',
      'codigo de situacao da operacao no simples nacional',
    ])
  ) {
    return null;
  }

  const texto = obterTextoCompletoErro(erro);

  if (
    contemAlgum(texto, [
      'cst',
      'regime normal',
    ]) &&
    !contemAlgum(texto, [
      'csosn',
      'simples nacional',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload
      ?.icms_situacao_tributaria ??
    referencias.itemPayload?.csosn ??
    referencias.produtoRelacionado?.csosn ??
    referencias.produtoRelacionado
      ?.icms_situacao_tributaria ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_CSOSN_AUSENTE',
      campoAfetado: 'csosn',
      valorEncontrado,
      valorEsperado:
        'CSOSN preenchido e compatível com o regime tributário',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_CSOSN_INVALIDO',
    campoAfetado: 'csosn',
    valorEncontrado,
    valorEsperado:
      'CSOSN válido para o regime tributário e para a operação',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarCstIcms({ contexto, erro }) {
  const texto = obterTextoCompletoErro(erro);

  const relacionado =
    contemAlgum(texto, [
      'cst icms',
      'situacao tributaria do icms',
      'icms_situacao_tributaria',
    ]) &&
    !contemAlgum(texto, [
      'csosn',
      'simples nacional',
    ]);

  if (!relacionado) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload
      ?.icms_situacao_tributaria ??
    referencias.itemPayload?.cst_icms ??
    referencias.produtoRelacionado?.cst_icms ??
    null;

  if (indicaCampoAusente(erro)) {
    return criarClassificacaoProduto({
      ...referencias,
      codigoRegra: 'PRODUTO_CST_ICMS_AUSENTE',
      campoAfetado: 'cst_icms',
      valorEncontrado,
      valorEsperado:
        'CST do ICMS preenchido',
      tipoProblema: 'CAMPO_AUSENTE',
      erro,
    });
  }

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: 'PRODUTO_CST_ICMS_INVALIDO',
    campoAfetado: 'cst_icms',
    valorEncontrado,
    valorEsperado:
      'CST do ICMS válido para a operação',
    tipoProblema: 'VALOR_INVALIDO',
    erro,
  });
}

function classificarOrigemMercadoria({
  contexto,
  erro,
}) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'icms_origem',
      'origem da mercadoria',
      'origem mercadoria',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload?.icms_origem ??
    referencias.itemPayload?.origem ??
    referencias.produtoRelacionado?.origem ??
    referencias.produtoRelacionado?.icms_origem ??
    null;

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: indicaCampoAusente(erro)
      ? 'PRODUTO_ORIGEM_MERCADORIA_AUSENTE'
      : 'PRODUTO_ORIGEM_MERCADORIA_INVALIDA',
    campoAfetado: 'origem_mercadoria',
    valorEncontrado,
    valorEsperado:
      'Origem da mercadoria válida entre 0 e 8',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
    erro,
  });
}

function classificarUnidadeComercial({
  contexto,
  erro,
}) {
  if (
    !erroRelacionadoAoCampo(erro, [
      'unidade_comercial',
      'unidade tributavel',
      'unidade_tributavel',
      'unidade de medida',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  const valorEncontrado =
    referencias.itemPayload?.unidade_comercial ??
    referencias.itemPayload?.unidade_tributavel ??
    referencias.produtoRelacionado?.unidade ??
    null;

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra: indicaCampoAusente(erro)
      ? 'PRODUTO_UNIDADE_AUSENTE'
      : 'PRODUTO_UNIDADE_INVALIDA',
    campoAfetado: 'unidade',
    valorEncontrado,
    valorEsperado:
      'Unidade comercial válida e preenchida',
    tipoProblema: indicaCampoAusente(erro)
      ? 'CAMPO_AUSENTE'
      : 'VALOR_INVALIDO',
    erro,
  });
}

function classificarTributacaoProduto({
  contexto,
  erro,
}) {
  const texto = obterTextoCompletoErro(erro);

  if (
    !contemAlgum(texto, [
      'tributacao do produto',
      'tributacao do item',
      'grupo icms',
      'dados fiscais do produto',
      'situacao tributaria',
    ])
  ) {
    return null;
  }

  const referencias =
    obterReferenciasProduto(contexto, erro);

  return criarClassificacaoProduto({
    ...referencias,
    codigoRegra:
      'PRODUTO_TRIBUTACAO_INVALIDA',
    campoAfetado: 'tributacao',
    valorEncontrado: null,
    valorEsperado:
      'Tributação do produto compatível com o regime e com a operação',
    tipoProblema: indicaValorInvalido(erro)
      ? 'VALOR_INVALIDO'
      : 'CONFIGURACAO_INCOMPLETA',
    erro,
  });
}

function criarClassificacaoProduto({
  codigoRegra,
  campoAfetado,
  valorEncontrado,
  valorEsperado,
  tipoProblema,
  erro,
  itemRelacionado,
  produtoRelacionado,
  itemPayload,
}) {
  return {
    codigoRegra,
    categoria: 'PRODUTO',
    campoAfetado,
    valorEncontrado,
    valorEsperado,
    severidade: 'ALTA',
    itemRelacionado,
    produtoRelacionado,
    detalhes: {
      tipoProblema,
      campoProvedor: erro.campo ?? null,
      mensagemProvedor: erro.mensagem ?? null,
      codigoProvedor: erro.codigo ?? null,
      itemPayload,
    },
  };
}

export default ClassificadorProduto;