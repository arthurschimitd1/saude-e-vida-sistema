// src/services/fiscal/inteligencia/regras/notaFiscal/RetornoEmissaoRule.js

import {
  classificarErroRetorno,
} from './classificadores/index.js';

const RetornoEmissaoRule = {
  codigo: 'RETORNO_EMISSAO',

  nome: 'Resultado da emissão da nota fiscal',

  contextosAplicaveis: [
    'NOTA_FISCAL',
  ],

  /**
   * Analisa o retorno de uma emissão fiscal.
   *
   * Para cada erro:
   * - tenta gerar uma inconsistência específica;
   * - caso não reconheça o erro, gera uma inconsistência genérica.
   *
   * @param {Object} contexto
   * @returns {Promise<Array<Object>>}
   */
  async executar(contexto) {
    const retornoEmissao =
      obterRetornoEmissao(contexto);

    if (!retornoEmissao) {
      return [];
    }

    if (!emissaoPossuiErro({
      contexto,
      retornoEmissao,
    })) {
      return [];
    }

    const erros =
      extrairErrosRetorno(retornoEmissao);

    /*
     * A emissão possui erro, mas o provedor não retornou
     * uma lista detalhada de erros.
     *
     * Nesse caso, transformamos o retorno principal em um
     * único erro para que ele também seja classificado.
     */
    if (erros.length === 0) {
      const erroPrincipal =
        criarErroPrincipal({
          contexto,
          retornoEmissao,
        });

      return [
        classificarErroOuCriarGenerico({
          contexto: {
            ...contexto,
            retornoEmissao,
          },
          erro: erroPrincipal,
          indiceErro: 0,
        }),
      ];
    }

    return erros.map((erro, indiceErro) =>
      classificarErroOuCriarGenerico({
        contexto: {
          ...contexto,
          retornoEmissao,
        },
        erro,
        indiceErro,
      }),
    );
  },
};

/**
 * Obtém e interpreta o retorno da emissão.
 *
 * O retorno pode estar:
 * - já preparado em contexto.retornoEmissao;
 * - no campo resposta_provedor da nota;
 * - no campo respostaProvedor da nota;
 * - diretamente no contexto.
 */
function obterRetornoEmissao(contexto) {
  const valor =
    contexto?.retornoEmissao ??
    contexto?.nota?.resposta_provedor ??
    contexto?.nota?.respostaProvedor ??
    contexto?.respostaProvedor ??
    null;

  return interpretarValor(valor);
}

/**
 * Interpreta objetos, arrays ou strings JSON.
 *
 * Caso a string não seja um JSON válido, ela é preservada
 * para que a mensagem também possa gerar inconsistência.
 */
function interpretarValor(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === 'object') {
    return valor;
  }

  if (typeof valor !== 'string') {
    return valor;
  }

  const texto = valor.trim();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return {
      mensagem: texto,
      respostaOriginal: texto,
    };
  }
}

/**
 * Determina se a nota ou o retorno representam uma emissão
 * com erro.
 */
function emissaoPossuiErro({
  contexto,
  retornoEmissao,
}) {
  const statusNota =
    normalizarTexto(contexto?.nota?.status);

  const statusRetorno =
    normalizarTexto(retornoEmissao?.status);

  const codigoRetorno =
    normalizarTexto(
      retornoEmissao?.codigo ??
      retornoEmissao?.status_sefaz ??
      contexto?.nota?.codigo_retorno ??
      contexto?.nota?.status_sefaz,
    );

  const mensagemRetorno =
    normalizarTexto(
      retornoEmissao?.mensagem ??
      retornoEmissao?.mensagem_sefaz ??
      contexto?.nota?.mensagem_retorno ??
      contexto?.nota?.mensagem_sefaz,
    );

  if (possuiErrosDetalhados(retornoEmissao)) {
    return true;
  }

  const statusComErro = [
    'erro',
    'erro_autorizacao',
    'erro_cancelamento',
    'rejeitado',
    'rejeitada',
    'falha',
  ];

  if (
    statusComErro.some(
      (status) =>
        statusNota === status ||
        statusRetorno === status,
    )
  ) {
    return true;
  }

  const statusSemErro = [
    'autorizado',
    'autorizada',
    'cancelado',
    'cancelada',
    'processando_autorizacao',
    'processando',
  ];

  if (
    statusSemErro.includes(statusNota) ||
    statusSemErro.includes(statusRetorno)
  ) {
    return false;
  }

  /*
   * Código 100 representa autorização de uso.
   * Código 101 normalmente representa cancelamento homologado.
   */
  if (
    ['100', '101'].includes(codigoRetorno)
  ) {
    return false;
  }

  const indicadoresErro = [
    'erro',
    'rejeicao',
    'rejeitado',
    'falha',
    'invalido',
    'nao pode',
    'nao informado',
    'ausente',
    'denied',
    'unauthorized',
  ];

  return indicadoresErro.some(
    (indicador) =>
      statusNota.includes(indicador) ||
      statusRetorno.includes(indicador) ||
      codigoRetorno.includes(indicador) ||
      mensagemRetorno.includes(indicador),
  );
}

/**
 * Verifica se a resposta contém uma lista de erros.
 */
function possuiErrosDetalhados(retornoEmissao) {
  return [
    retornoEmissao?.erros,
    retornoEmissao?.errosValidacao,
    retornoEmissao?.erros_validacao,
    retornoEmissao?.errors,
  ].some(
    (erros) =>
      Array.isArray(erros) &&
      erros.length > 0,
  );
}

/**
 * Extrai os erros dos diferentes formatos de retorno
 * utilizados pela Focus ou pela aplicação.
 */
function extrairErrosRetorno(retornoEmissao) {
  const listasPossiveis = [
    retornoEmissao?.erros,
    retornoEmissao?.errosValidacao,
    retornoEmissao?.erros_validacao,
    retornoEmissao?.errors,
  ];

  const listaErros =
    listasPossiveis.find(
      (lista) =>
        Array.isArray(lista) &&
        lista.length > 0,
    ) ?? [];

  return listaErros.map((erro) =>
    normalizarErroRetorno({
      erro,
      retornoEmissao,
    }),
  );
}

/**
 * Padroniza cada erro para o formato esperado
 * pelos classificadores.
 */
function normalizarErroRetorno({
  erro,
  retornoEmissao,
}) {
  if (
    erro === null ||
    erro === undefined
  ) {
    return {
      codigo:
        obterCodigoPrincipal(retornoEmissao),

      campo: null,

      mensagem:
        obterMensagemPrincipal(
          retornoEmissao,
        ),

      origem:
        identificarOrigemRetorno(
          retornoEmissao,
        ),

      dadosOriginais: erro,
    };
  }

  if (typeof erro === 'string') {
    return {
      codigo:
        obterCodigoPrincipal(retornoEmissao),

      campo: null,

      mensagem: erro,

      origem:
        identificarOrigemRetorno(
          retornoEmissao,
        ),

      dadosOriginais: erro,
    };
  }

  return {
    codigo:
      erro.codigo ??
      erro.code ??
      erro.status_sefaz ??
      obterCodigoPrincipal(retornoEmissao),

    campo:
      erro.campo ??
      erro.field ??
      erro.path ??
      erro.propriedade ??
      erro.property ??
      null,

    mensagem:
      erro.mensagem ??
      erro.message ??
      erro.descricao ??
      erro.description ??
      obterMensagemPrincipal(
        retornoEmissao,
      ),

    origem:
      erro.origem ??
      identificarOrigemRetorno(
        retornoEmissao,
      ),

    detalhes:
      erro.detalhes ??
      erro.detail ??
      null,

    dadosOriginais: erro,
  };
}

/**
 * Cria um erro a partir dos campos principais do retorno.
 *
 * Utilizado quando a resposta não possui erros[].
 */
function criarErroPrincipal({
  contexto,
  retornoEmissao,
}) {
  return {
    codigo:
      obterCodigoPrincipal(
        retornoEmissao,
        contexto,
      ),

    campo: null,

    mensagem:
      obterMensagemPrincipal(
        retornoEmissao,
        contexto,
      ),

    origem:
      identificarOrigemRetorno(
        retornoEmissao,
      ),

    dadosOriginais: retornoEmissao,
  };
}

function obterCodigoPrincipal(
  retornoEmissao,
  contexto = {},
) {
  return (
    retornoEmissao?.status_sefaz ??
    retornoEmissao?.codigo ??
    retornoEmissao?.code ??
    contexto?.nota?.status_sefaz ??
    contexto?.nota?.codigo_retorno ??
    null
  );
}

function obterMensagemPrincipal(
  retornoEmissao,
  contexto = {},
) {
  return (
    retornoEmissao?.mensagem_sefaz ??
    retornoEmissao?.mensagem ??
    retornoEmissao?.message ??
    contexto?.nota?.mensagem_sefaz ??
    contexto?.nota?.mensagem_retorno ??
    'A emissão fiscal apresentou um erro não detalhado.'
  );
}

/**
 * Tenta classificar o erro.
 *
 * Quando nenhum classificador reconhecer o retorno,
 * cria a inconsistência genérica.
 */
function classificarErroOuCriarGenerico({
  contexto,
  erro,
  indiceErro,
}) {
  const classificacao =
    classificarErroRetorno({
      contexto,
      erro,
      indiceErro,
    });

  if (classificacao) {
    return criarInconsistenciaBase({
      contexto,
      erro,
      indiceErro,
      ...classificacao,
    });
  }

  return criarInconsistenciaGenerica({
    contexto,
    erro,
    indiceErro,
  });
}

/**
 * Cria a inconsistência de fallback.
 *
 * Essa inconsistência só é criada quando nenhum classificador
 * específico reconheceu o erro.
 */
function criarInconsistenciaGenerica({
  contexto,
  erro,
  indiceErro,
}) {
  return criarInconsistenciaBase({
    contexto,
    erro,
    indiceErro,

    codigoRegra:
      'RESULTADO_EMISSAO_COM_ERRO',

    categoria:
      'NOTA_FISCAL',

    campoAfetado:
      erro.campo ?? null,

    valorEncontrado:
      erro.mensagem ?? null,

    valorEsperado:
      'Emissão processada sem rejeições ou erros de validação',

    severidade:
      determinarSeveridadeGenerica(
        erro,
      ),

    itemRelacionado: null,

    produtoRelacionado: null,

    detalhes: {
      tipoProblema:
        'ERRO_NAO_CLASSIFICADO',

      campoProvedor:
        erro.campo ?? null,

      codigoProvedor:
        erro.codigo ?? null,

      mensagemProvedor:
        erro.mensagem ?? null,

      respostaOriginal:
        erro.dadosOriginais ?? null,
    },
  });
}

/**
 * Monta o objeto final da inconsistência.
 *
 * Este método pode ser ajustado posteriormente conforme
 * os nomes definitivos das colunas do model.
 */
function criarInconsistenciaBase({
  contexto,
  erro,
  indiceErro,
  codigoRegra,
  categoria,
  campoAfetado,
  valorEncontrado,
  valorEsperado,
  severidade,
  itemRelacionado = null,
  produtoRelacionado = null,
  detalhes = {},
}) {
  const nota = contexto.nota;

  if (!nota?.id) {
    throw new Error(
      'RetornoEmissaoRule: a nota fiscal não foi informada no contexto.',
    );
  }

  const produtoId =
    produtoRelacionado?.id ??
    itemRelacionado?.produto_id ??
    itemRelacionado?.product_id ??
    null;

  const chaveInconsistencia =
    gerarChaveInconsistencia({
      notaFiscalId: nota.id,
      codigoRegra,
      produtoId,
      campoAfetado,
      indiceErro,
    });

  return {
    empresa_id:
      contexto.empresaId ??
      contexto.empresa_id ??
      nota.empresa_id ??
      null,

    nota_fiscal_id:
      nota.id,

    venda_id:
      contexto.venda?.id ??
      nota.venda_id ??
      null,

    produto_id:
      produtoId,

    cliente_id:
      contexto.cliente?.id ??
      contexto.venda?.cliente_id ??
      null,

    codigo_regra:
      codigoRegra,

    chave_inconsistencia:
      chaveInconsistencia,

    categoria,

    campo_afetado:
      campoAfetado ?? null,

    valor_encontrado:
      normalizarValorPersistencia(
        valorEncontrado,
      ),

    valor_esperado:
      normalizarValorPersistencia(
        valorEsperado,
      ),

    valor_afetado:
      obterValorAfetado({
        contexto,
        itemRelacionado,
      }),

    status:
      'PENDENTE',

    severidade,

    dados_deteccao: {
      origem:
        erro.origem ??
        identificarOrigemRetorno(
          contexto.retornoEmissao,
        ),

      indice_erro:
        indiceErro,

      retorno: {
        status:
          contexto.retornoEmissao?.status ??
          nota.status ??
          null,

        codigo:
          erro.codigo ??
          obterCodigoPrincipal(
            contexto.retornoEmissao,
            contexto,
          ),

        campo:
          erro.campo ??
          null,

        mensagem:
          erro.mensagem ??
          obterMensagemPrincipal(
            contexto.retornoEmissao,
            contexto,
          ),
      },

      nota_fiscal: {
        id:
          nota.id,

        tipo:
          nota.tipo ?? null,

        status:
          nota.status ?? null,

        numero:
          nota.numero ?? null,

        serie:
          nota.serie ?? null,

        chave_acesso:
          nota.chave_acesso ?? null,

        provedor:
          nota.provedor ?? null,

        ambiente:
          nota.ambiente ?? null,

        valor_total:
          nota.valor_total ?? null,
      },

      item:
        montarDadosItem(
          itemRelacionado,
        ),

      produto:
        montarDadosProduto(
          produtoRelacionado,
        ),

      payload_enviado:
        contexto.payloadEnviado ??
        contexto.payload_enviado ??
        nota.payload_enviado ??
        null,

      detalhes,
    },
  };
}

/**
 * Gera uma chave determinística para evitar duplicidades.
 *
 * Para inconsistências específicas, a chave não utiliza
 * o índice do erro. Assim, uma regra preventiva e o retorno
 * da emissão podem atualizar a mesma inconsistência.
 *
 * Para o erro genérico, o índice é incluído porque podem existir
 * vários erros não reconhecidos na mesma emissão.
 */
function gerarChaveInconsistencia({
  notaFiscalId,
  codigoRegra,
  produtoId,
  campoAfetado,
  indiceErro,
}) {
  const partes = [
    'nota',
    notaFiscalId,
    'regra',
    codigoRegra,
    'produto',
    produtoId ?? 'sem-produto',
    'campo',
    normalizarChave(
      campoAfetado ?? 'sem-campo',
    ),
  ];

  if (
    codigoRegra ===
    'RESULTADO_EMISSAO_COM_ERRO'
  ) {
    partes.push(
      'erro',
      indiceErro,
    );
  }

  return partes.join(':');
}

/**
 * Define a severidade de um erro não classificado.
 */
function determinarSeveridadeGenerica(
  erro,
) {
  const origem =
    normalizarTexto(erro.origem);

  const codigo =
    String(erro.codigo ?? '');

  if (
    origem === 'sefaz' ||
    /^\d+$/.test(codigo)
  ) {
    return 'CRITICA';
  }

  return 'ALTA';
}

/**
 * Diferencia respostas da Focus e da SEFAZ.
 *
 * Quando existe status_sefaz ou código numérico,
 * consideramos que a rejeição foi retornada pela SEFAZ.
 */
function identificarOrigemRetorno(
  retornoEmissao,
) {
  if (!retornoEmissao) {
    return 'FOCUS';
  }

  if (
    retornoEmissao.status_sefaz !==
      null &&
    retornoEmissao.status_sefaz !==
      undefined
  ) {
    return 'SEFAZ';
  }

  const codigo =
    String(
      retornoEmissao.codigo ??
      retornoEmissao.code ??
      '',
    ).trim();

  if (/^\d+$/.test(codigo)) {
    return 'SEFAZ';
  }

  return 'FOCUS';
}

function obterValorAfetado({
  contexto,
  itemRelacionado,
}) {
  return (
    itemRelacionado?.valor_total ??
    itemRelacionado?.valorTotal ??
    contexto.nota?.valor_total ??
    contexto.venda?.valor_total ??
    contexto.venda?.total ??
    null
  );
}

function montarDadosItem(item) {
  if (!item) {
    return null;
  }

  return {
    id:
      item.id ?? null,

    produto_id:
      item.produto_id ??
      item.product_id ??
      null,

    descricao:
      item.descricao ??
      item.nome_item ??
      item.nome ??
      null,

    quantidade:
      item.quantidade ??
      null,

    valor_unitario:
      item.valor_unitario ??
      item.preco_unitario ??
      null,

    valor_total:
      item.valor_total ??
      item.total ??
      null,
  };
}

function montarDadosProduto(produto) {
  if (!produto) {
    return null;
  }

  return {
    id:
      produto.id ?? null,

    nome:
      produto.nome ??
      produto.name ??
      produto.descricao ??
      null,

    ncm:
      produto.ncm ??
      null,

    cfop:
      produto.cfop ??
      null,

    csosn:
      produto.csosn ??
      produto.icms_situacao_tributaria ??
      null,

    cst_pis:
      produto.cst_pis ??
      produto.pis_situacao_tributaria ??
      null,

    cst_cofins:
      produto.cst_cofins ??
      produto.cofins_situacao_tributaria ??
      null,
  };
}

function normalizarValorPersistencia(
  valor,
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }

  return String(valor);
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarChave(valor) {
  return normalizarTexto(valor)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default RetornoEmissaoRule;