// src/services/fiscal/inteligencia/InconsistenciaFiscalService.js

import { Op } from 'sequelize';

import InconsistenciaFiscal from '../../models/inteligencia-fiscal/InconsistenciaFiscal.js';
import AuditoriaFiscalInconsistencia from '../../models/inteligencia-fiscal/AuditoriaFiscalInconsistencia.js';
import InconsistenciaFiscalHistorico from '../../models/inteligencia-fiscal/InconsistenciaFiscalHistorico.js';

function normalizarModel(registro) {
  if (!registro) {
    return null;
  }

  if (typeof registro.toJSON === 'function') {
    return registro.toJSON();
  }

  return registro;
}

class InconsistenciaFiscalService {
  /**
   * Sincroniza as inconsistências encontradas em uma nota.
   */
  async sincronizar({
    auditoria,
    contexto,
    inconsistencias = [],
    transaction = null,
  }) {
    this.validarSincronizacao({
      auditoria,
      contexto,
    });

    const existentes =
      await InconsistenciaFiscal.findAll({
        where: {
          empresa_id: contexto.empresaId,
          nota_fiscal_id: contexto.nota.id,
        },
        transaction,
      });

    const existentesPorChave = new Map(
      existentes.map(registro => [
        registro.chave_inconsistencia,
        registro,
      ]),
    );

    const chavesDetectadas = new Set();

    const resultado = {
      criadas: [],
      atualizadas: [],
      recorrentes: [],
      reabertas: [],
      resolvidas: [],
    };

    for (const dados of inconsistencias) {
      const chave = dados.chave_inconsistencia;

      if (!chave) {
        throw new Error(
          `A regra ${dados.codigo_regra ?? 'desconhecida'} não informou chave_inconsistencia.`,
        );
      }

      chavesDetectadas.add(chave);

      const existente = existentesPorChave.get(chave);

      if (!existente) {
        const criada = await this.criarInconsistencia({
          auditoria,
          contexto,
          dados,
          transaction,
        });

        resultado.criadas.push(
          normalizarModel(criada),
        );

        continue;
      }

      const statusAnterior = existente.status;

      if (statusAnterior === 'RESOLVIDO') {
        const reaberta = await this.reabrirInconsistencia({
          auditoria,
          registro: existente,
          dados,
          transaction,
        });

        resultado.reabertas.push(
          normalizarModel(reaberta),
        );

        continue;
      }

      const houveAlteracao =
        this.possuiAlteracaoRelevante(
          existente,
          dados,
        );

      const atualizada =
        await this.atualizarInconsistenciaDetectada({
          auditoria,
          registro: existente,
          dados,
          tipoResultado: houveAlteracao
            ? 'ATUALIZADA'
            : 'RECORRENTE',
          transaction,
        });

      const destino = houveAlteracao
        ? resultado.atualizadas
        : resultado.recorrentes;

      destino.push(normalizarModel(atualizada));
    }

    const resolvidas =
      await this.resolverNaoDetectadas({
        auditoria,
        existentes,
        chavesDetectadas,
        transaction,
      });

    resultado.resolvidas.push(
      ...resolvidas.map(normalizarModel),
    );

    return {
      totalCriadas: resultado.criadas.length,
      totalAtualizadas: resultado.atualizadas.length,
      totalRecorrentes: resultado.recorrentes.length,
      totalReabertas: resultado.reabertas.length,
      totalResolvidas: resultado.resolvidas.length,
      registros: resultado,
    };
  }

  async criarInconsistencia({
    auditoria,
    contexto,
    dados,
    transaction,
  }) {
    const agora = new Date();

    const inconsistencia =
      await InconsistenciaFiscal.create(
        {
          ...this.montarDadosPersistencia({
            contexto,
            dados,
          }),

          status: dados.status ?? 'PENDENTE',
          detectada_em: agora,
          ultima_verificacao_em: agora,

          resolvida_em: null,
          resolvida_por_id: null,
          tipo_resolucao: null,
          resolucao_automatica: false,
          observacao_resolucao: null,
        },
        {
          transaction,
        },
      );

    await this.registrarNaAuditoria({
      auditoria,
      inconsistencia,
      dados,
      tipoResultado: 'CRIADA',
      estavaResolvida: false,
      transaction,
    });

    await this.registrarHistorico({
      auditoriaId: auditoria.id,
      inconsistenciaId: inconsistencia.id,
      origemAcao: 'SISTEMA',
      acao: 'DETECTADA',
      statusAnterior: null,
      statusNovo: inconsistencia.status,
      observacao:
        'Inconsistência identificada durante auditoria fiscal.',
      dadosNovos: this.criarSnapshot(inconsistencia),
      transaction,
    });

    return inconsistencia;
  }

  async atualizarInconsistenciaDetectada({
    auditoria,
    registro,
    dados,
    tipoResultado,
    transaction,
  }) {
    const dadosAnteriores =
      this.criarSnapshot(registro);

    const dadosAtualizacao =
      this.montarAtualizacaoDeteccao({
        registro,
        dados,
      });

    await registro.update(
      dadosAtualizacao,
      {
        transaction,
      },
    );

    await this.registrarNaAuditoria({
      auditoria,
      inconsistencia: registro,
      dados,
      tipoResultado,
      estavaResolvida: false,
      transaction,
    });

    await this.registrarHistorico({
      auditoriaId: auditoria.id,
      inconsistenciaId: registro.id,
      origemAcao: 'SISTEMA',
      acao:
        tipoResultado === 'ATUALIZADA'
          ? 'REVALIDADA'
          : 'DETECTADA_NOVAMENTE',
      statusAnterior: dadosAnteriores.status,
      statusNovo: registro.status,
      observacao:
        tipoResultado === 'ATUALIZADA'
          ? 'A inconsistência foi atualizada com novas evidências.'
          : 'A inconsistência continua presente após nova auditoria.',
      dadosAnteriores,
      dadosNovos: this.criarSnapshot(registro),
      transaction,
    });

    return registro;
  }

  async reabrirInconsistencia({
    auditoria,
    registro,
    dados,
    transaction,
  }) {
    const dadosAnteriores =
      this.criarSnapshot(registro);

    await registro.update(
      {
        ...this.montarAtualizacaoDeteccao({
          registro,
          dados,
        }),

        status: 'PENDENTE',
        resolvida_em: null,
        resolvida_por_id: null,
        tipo_resolucao: null,
        resolucao_automatica: false,
        observacao_resolucao: null,
      },
      {
        transaction,
      },
    );

    await this.registrarNaAuditoria({
      auditoria,
      inconsistencia: registro,
      dados,
      tipoResultado: 'REABERTA',
      estavaResolvida: true,
      transaction,
    });

    await this.registrarHistorico({
      auditoriaId: auditoria.id,
      inconsistenciaId: registro.id,
      origemAcao: 'SISTEMA',
      acao: 'REABERTA',
      statusAnterior: 'RESOLVIDO',
      statusNovo: 'PENDENTE',
      observacao:
        'A inconsistência foi detectada novamente e reaberta.',
      dadosAnteriores,
      dadosNovos: this.criarSnapshot(registro),
      transaction,
    });

    return registro;
  }

  async resolverNaoDetectadas({
    auditoria,
    existentes,
    chavesDetectadas,
    transaction,
  }) {
    const resolvidas = [];

    for (const registro of existentes) {
      if (
        chavesDetectadas.has(
          registro.chave_inconsistencia,
        )
      ) {
        continue;
      }

      if (registro.status === 'RESOLVIDO') {
        await registro.update(
          {
            ultima_verificacao_em: new Date(),
          },
          {
            transaction,
          },
        );

        continue;
      }

      const dadosAnteriores =
        this.criarSnapshot(registro);

      await registro.update(
        {
          status: 'RESOLVIDO',
          resolvida_em: new Date(),
          resolvida_por_id: null,
          tipo_resolucao: 'CADASTRO_CORRIGIDO',
          resolucao_automatica: true,
          observacao_resolucao:
            'Resolvida automaticamente após nova auditoria sem detecção do problema.',
          ultima_verificacao_em: new Date(),
        },
        {
          transaction,
        },
      );

      await this.registrarHistorico({
        auditoriaId: auditoria.id,
        inconsistenciaId: registro.id,
        origemAcao: 'SISTEMA',
        acao: 'RESOLVIDA_AUTOMATICAMENTE',
        statusAnterior: dadosAnteriores.status,
        statusNovo: 'RESOLVIDO',
        observacao:
          'A inconsistência não foi encontrada na auditoria atual.',
        dadosAnteriores,
        dadosNovos: this.criarSnapshot(registro),
        transaction,
      });

      resolvidas.push(registro);
    }

    return resolvidas;
  }

  async registrarNaAuditoria({
    auditoria,
    inconsistencia,
    dados,
    tipoResultado,
    estavaResolvida,
    transaction,
  }) {
    return AuditoriaFiscalInconsistencia.create(
      {
        auditoria_id: auditoria.id,
        inconsistencia_id: inconsistencia.id,

        tipo_resultado: tipoResultado,

        status_no_momento:
          inconsistencia.status,

        severidade_no_momento:
          inconsistencia.severidade,

        estava_resolvida:
          estavaResolvida,

        snapshot: {
          ...this.criarSnapshot(
            inconsistencia,
          ),

          dados_regra:
            dados.dados_deteccao ?? null,
        },
      },
      {
        transaction,
      },
    );
  }

  async registrarHistorico({
    auditoriaId = null,
    inconsistenciaId,
    usuarioId = null,
    origemAcao,
    acao,
    statusAnterior = null,
    statusNovo = null,
    responsavelAnteriorId = null,
    responsavelNovoId = null,
    observacao = null,
    dadosAnteriores = null,
    dadosNovos = null,
    transaction = null,
  }) {
    return InconsistenciaFiscalHistorico.create(
      {
        auditoria_id: auditoriaId,
        inconsistencia_id: inconsistenciaId,
        usuario_id: usuarioId,
        origem_acao: origemAcao,
        acao,
        status_anterior: statusAnterior,
        status_novo: statusNovo,
        responsavel_anterior_id:
          responsavelAnteriorId,
        responsavel_novo_id:
          responsavelNovoId,
        observacao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
      },
      {
        transaction,
      },
    );
  }

  /**
   * Consulta utilizada pela tabela principal do frontend.
   */
  async listar({
  empresaId,
  pagina = 1,
  limite = 20,
  status,
  severidade,
  categoria,
  tipo,
  responsavelId,
  notaFiscalId,
  clienteId,
  produtoId,
  busca,
  dataInicio,
  dataFim,
}) {
  const where = {
    empresa_id: Number(empresaId),
  };

  if (status) {
    where.status = this.normalizarLista(status);
  }

  if (severidade) {
    where.severidade =
      this.normalizarLista(severidade);
  }

  if (categoria) {
    where.categoria =
      this.normalizarLista(categoria);
  }

  if (tipo) {
    where.tipo = {
      [Op.iLike]: `%${tipo}%`,
    };
  }

  if (responsavelId) {
    where.responsavel_id =
      Number(responsavelId);
  }

  if (notaFiscalId) {
    where.nota_fiscal_id =
      Number(notaFiscalId);
  }

  if (clienteId) {
    where.cliente_id =
      Number(clienteId);
  }

  if (produtoId) {
    where.produto_id =
      Number(produtoId);
  }

  if (dataInicio || dataFim) {
    where.detectada_em = {};

    if (dataInicio) {
      where.detectada_em[Op.gte] =
        new Date(`${dataInicio}T00:00:00`);
    }

    if (dataFim) {
      where.detectada_em[Op.lte] =
        new Date(`${dataFim}T23:59:59`);
    }
  }

  if (busca) {
    where[Op.or] = [
      {
        titulo: {
          [Op.iLike]: `%${busca}%`,
        },
      },
      {
        descricao: {
          [Op.iLike]: `%${busca}%`,
        },
      },
      {
        codigo_regra: {
          [Op.iLike]: `%${busca}%`,
        },
      },
      {
        campo_afetado: {
          [Op.iLike]: `%${busca}%`,
        },
      },
    ];
  }

  const paginaNumero =
    Math.max(Number(pagina) || 1, 1);

  const limiteNumero =
    Math.min(
      Math.max(Number(limite) || 20, 1),
      100,
    );

  console.log(
    '🔎 [InconsistenciaFiscalService.listar] Parâmetros recebidos:',
    {
      empresaId,
      pagina,
      limite,
      status,
      severidade,
      categoria,
      tipo,
      responsavelId,
      notaFiscalId,
      clienteId,
      produtoId,
      busca,
      dataInicio,
      dataFim,
    },
  );

  console.log(
    '🔎 [InconsistenciaFiscalService.listar] Paginação:',
    {
      paginaNumero,
      limiteNumero,
      offset:
        (paginaNumero - 1) *
        limiteNumero,
    },
  );

  console.dir(
    {
      mensagem:
        '🔎 [InconsistenciaFiscalService.listar] Where montado',
      where,
    },
    {
      depth: null,
    },
  );

  try {
    const resultado =
      await InconsistenciaFiscal.findAndCountAll({
        where,
        limit: limiteNumero,
        offset:
          (paginaNumero - 1) *
          limiteNumero,
        order: [
          [
            this.criarOrdenacaoSeveridade(),
            'ASC',
          ],
          ['detectada_em', 'DESC'],
        ],

        // Temporário, para exibir o SQL gerado.
        logging: (sql) => {
          console.log(
            '🧾 [InconsistenciaFiscalService.listar] SQL:',
            sql,
          );
        },
      });

    console.log(
      '✅ [InconsistenciaFiscalService.listar] Consulta concluída:',
      {
        total: resultado.count,
        registrosRetornados:
          resultado.rows.length,
      },
    );

    return {
      dados:
        resultado.rows.map(normalizarModel),
      paginacao: {
        pagina: paginaNumero,
        limite: limiteNumero,
        total: resultado.count,
        totalPaginas: Math.ceil(
          resultado.count / limiteNumero,
        ),
      },
    };
  } catch (error) {
    console.error(
      '❌ [InconsistenciaFiscalService.listar] Erro na consulta:',
      {
        name: error?.name,
        message: error?.message,
        code:
          error?.original?.code ??
          error?.parent?.code,
        detail:
          error?.original?.detail ??
          error?.parent?.detail,
        hint:
          error?.original?.hint ??
          error?.parent?.hint,
        table:
          error?.original?.table ??
          error?.parent?.table,
        column:
          error?.original?.column ??
          error?.parent?.column,
        constraint:
          error?.original?.constraint ??
          error?.parent?.constraint,
        sql: error?.sql,
        parameters:
          error?.parameters,
      },
    );

    console.error(
      '❌ Erro original do PostgreSQL:',
      error?.original,
    );

    throw error;
  }
}

  /**
   * Cards da tela principal.
   */
  async obterResumo({
    empresaId,
    dataInicio,
    dataFim,
  }) {
    const where = {
      empresa_id: Number(empresaId),
    };

    if (dataInicio || dataFim) {
      where.detectada_em = {};

      if (dataInicio) {
        where.detectada_em[Op.gte] =
          new Date(`${dataInicio}T00:00:00`);
      }

      if (dataFim) {
        where.detectada_em[Op.lte] =
          new Date(`${dataFim}T23:59:59`);
      }
    }

    const registros =
      await InconsistenciaFiscal.findAll({
        where,
        attributes: [
          'status',
          'severidade',
          'categoria',
          'valor_afetado',
        ],
        raw: true,
      });

    const resumo = {
      total: registros.length,
      pendentes: 0,
      analisando: 0,
      urgentes: 0,
      resolvidas: 0,
      criticas: 0,
      altas: 0,
      medias: 0,
      valorTotalAfetado: 0,
      porCategoria: {},
    };

    for (const item of registros) {
      if (item.status === 'PENDENTE') {
        resumo.pendentes += 1;
      }

      if (item.status === 'ANALISANDO') {
        resumo.analisando += 1;
      }

      if (item.status === 'URGENTE') {
        resumo.urgentes += 1;
      }

      if (item.status === 'RESOLVIDO') {
        resumo.resolvidas += 1;
      }

      if (item.severidade === 'CRITICA') {
        resumo.criticas += 1;
      }

      if (item.severidade === 'ALTA') {
        resumo.altas += 1;
      }

      if (item.severidade === 'MEDIA') {
        resumo.medias += 1;
      }

      resumo.valorTotalAfetado +=
        Number(item.valor_afetado ?? 0);

      resumo.porCategoria[item.categoria] =
        (
          resumo.porCategoria[
            item.categoria
          ] ?? 0
        ) + 1;
    }

    return resumo;
  }

  /**
   * Sidebar/modal de detalhes.
   */
  async buscarDetalhes({
    empresaId,
    inconsistenciaId,
  }) {
    const inconsistencia =
      await this.buscarPorIdEmpresa({
        empresaId,
        inconsistenciaId,
      });

    const historico =
      await InconsistenciaFiscalHistorico.findAll({
        where: {
          inconsistencia_id:
            inconsistencia.id,
        },
        order: [['created_at', 'DESC']],
      });

    const auditorias =
      await AuditoriaFiscalInconsistencia.findAll({
        where: {
          inconsistencia_id:
            inconsistencia.id,
        },
        order: [['created_at', 'DESC']],
      });

    return {
      inconsistencia:
        normalizarModel(inconsistencia),

      historico:
        historico.map(normalizarModel),

      auditorias:
        auditorias.map(normalizarModel),
    };
  }

  async alterarStatus({
    empresaId,
    inconsistenciaId,
    status,
    usuarioId,
    observacao = null,
    transaction = null,
  }) {
    const statusPermitidos = [
      'PENDENTE',
      'ANALISANDO',
      'URGENTE',
      'RESOLVIDO',
    ];

    const statusNovo =
      String(status).toUpperCase();

    if (!statusPermitidos.includes(statusNovo)) {
      throw new Error(
        `Status inválido: ${statusNovo}.`,
      );
    }

    const registro =
      await this.buscarPorIdEmpresa({
        empresaId,
        inconsistenciaId,
        transaction,
      });

    const statusAnterior =
      registro.status;

    const dadosAnteriores =
      this.criarSnapshot(registro);

    const atualizacao = {
      status: statusNovo,
    };

    if (statusNovo === 'RESOLVIDO') {
      atualizacao.resolvida_em =
        new Date();

      atualizacao.resolvida_por_id =
        usuarioId ?? null;

      atualizacao.resolucao_automatica =
        false;
    } else if (
      statusAnterior === 'RESOLVIDO'
    ) {
      atualizacao.resolvida_em = null;
      atualizacao.resolvida_por_id = null;
      atualizacao.tipo_resolucao = null;
      atualizacao.resolucao_automatica =
        false;
      atualizacao.observacao_resolucao =
        null;
    }

    await registro.update(
      atualizacao,
      {
        transaction,
      },
    );

    await this.registrarHistorico({
      inconsistenciaId: registro.id,
      usuarioId,
      origemAcao: 'USUARIO',
      acao:
        statusAnterior === 'RESOLVIDO'
          ? 'REABERTA'
          : statusNovo === 'RESOLVIDO'
            ? 'RESOLVIDA'
            : 'STATUS_ALTERADO',
      statusAnterior,
      statusNovo,
      observacao,
      dadosAnteriores,
      dadosNovos:
        this.criarSnapshot(registro),
      transaction,
    });

    return normalizarModel(registro);
  }

  async resolver({
    empresaId,
    inconsistenciaId,
    usuarioId,
    tipoResolucao,
    observacao = null,
    transaction = null,
  }) {
    const tiposPermitidos = [
      'CADASTRO_CORRIGIDO',
      'DOCUMENTO_CORRIGIDO',
      'JUSTIFICADO',
      'IGNORADO',
    ];

    const tipoNormalizado =
      String(tipoResolucao).toUpperCase();

    if (
      !tiposPermitidos.includes(
        tipoNormalizado,
      )
    ) {
      throw new Error(
        `Tipo de resolução inválido: ${tipoNormalizado}.`,
      );
    }

    const registro =
      await this.buscarPorIdEmpresa({
        empresaId,
        inconsistenciaId,
        transaction,
      });

    const dadosAnteriores =
      this.criarSnapshot(registro);

    await registro.update(
      {
        status: 'RESOLVIDO',
        resolvida_em: new Date(),
        resolvida_por_id: usuarioId,
        tipo_resolucao:
          tipoNormalizado,
        resolucao_automatica: false,
        observacao_resolucao:
          observacao,
      },
      {
        transaction,
      },
    );

    const acao =
      tipoNormalizado === 'IGNORADO'
        ? 'IGNORADA'
        : tipoNormalizado === 'JUSTIFICADO'
          ? 'JUSTIFICADA'
          : tipoNormalizado;

    await this.registrarHistorico({
      inconsistenciaId: registro.id,
      usuarioId,
      origemAcao: 'USUARIO',
      acao,
      statusAnterior:
        dadosAnteriores.status,
      statusNovo: 'RESOLVIDO',
      observacao,
      dadosAnteriores,
      dadosNovos:
        this.criarSnapshot(registro),
      transaction,
    });

    return normalizarModel(registro);
  }

  async atribuirResponsavel({
    empresaId,
    inconsistenciaId,
    responsavelId,
    usuarioId,
    observacao = null,
    transaction = null,
  }) {
    const registro =
      await this.buscarPorIdEmpresa({
        empresaId,
        inconsistenciaId,
        transaction,
      });

    const responsavelAnteriorId =
      registro.responsavel_id;

    await registro.update(
      {
        responsavel_id:
          responsavelId
            ? Number(responsavelId)
            : null,
      },
      {
        transaction,
      },
    );

    await this.registrarHistorico({
      inconsistenciaId: registro.id,
      usuarioId,
      origemAcao: 'USUARIO',
      acao: responsavelId
        ? 'RESPONSAVEL_ATRIBUIDO'
        : 'RESPONSAVEL_REMOVIDO',
      statusAnterior: registro.status,
      statusNovo: registro.status,
      responsavelAnteriorId,
      responsavelNovoId:
        registro.responsavel_id,
      observacao,
      transaction,
    });

    return normalizarModel(registro);
  }

  async definirPrazo({
    empresaId,
    inconsistenciaId,
    prazoResolucao,
    usuarioId,
    observacao = null,
    transaction = null,
  }) {
    const registro =
      await this.buscarPorIdEmpresa({
        empresaId,
        inconsistenciaId,
        transaction,
      });

    const dadosAnteriores =
      this.criarSnapshot(registro);

    await registro.update(
      {
        prazo_resolucao:
          prazoResolucao ?? null,
      },
      {
        transaction,
      },
    );

    await this.registrarHistorico({
      inconsistenciaId: registro.id,
      usuarioId,
      origemAcao: 'USUARIO',
      acao: 'REVALIDADA',
      statusAnterior: registro.status,
      statusNovo: registro.status,
      observacao:
        observacao ??
        'Prazo de resolução atualizado.',
      dadosAnteriores,
      dadosNovos:
        this.criarSnapshot(registro),
      transaction,
    });

    return normalizarModel(registro);
  }

  async buscarPorIdEmpresa({
    empresaId,
    inconsistenciaId,
    transaction = null,
  }) {
    const registro =
      await InconsistenciaFiscal.findOne({
        where: {
          id: Number(inconsistenciaId),
          empresa_id: Number(empresaId),
        },
        transaction,
      });

    if (!registro) {
      throw new Error(
        `Inconsistência fiscal ${inconsistenciaId} não encontrada.`,
      );
    }

    return registro;
  }

  montarDadosPersistencia({
    contexto,
    dados,
  }) {
    const itemRelacionado =
      dados.itemRelacionado ??
      dados.item_relacionado ??
      null;

    const produtoRelacionado =
      dados.produtoRelacionado ??
      dados.produto_relacionado ??
      null;

    return {
      empresa_id:
        Number(contexto.empresaId),

      nota_fiscal_id:
        Number(contexto.nota.id),

      venda_id:
        dados.venda_id ??
        contexto.venda?.id ??
        null,

      venda_item_id:
        dados.venda_item_id ??
        itemRelacionado?.id ??
        null,

      produto_id:
        dados.produto_id ??
        produtoRelacionado?.id ??
        itemRelacionado?.produto_id ??
        null,

      cliente_id:
        dados.cliente_id ??
        contexto.cliente?.id ??
        null,

      codigo_regra:
        dados.codigo_regra,

      chave_inconsistencia:
        dados.chave_inconsistencia,

      tipo:
        dados.tipo ??
        dados.codigo_regra,

      categoria:
        dados.categoria,

      titulo:
        dados.titulo ??
        'Inconsistência fiscal identificada',

      descricao:
        dados.descricao ??
        'Foi identificada uma inconsistência durante a auditoria fiscal.',

      campo_afetado:
        dados.campo_afetado ??
        null,

      valor_encontrado:
        this.normalizarTextoBanco(
          dados.valor_encontrado,
        ),

      valor_esperado:
        this.normalizarTextoBanco(
          dados.valor_esperado,
        ),

      valor_afetado:
        dados.valor_afetado ??
        this.obterValorAfetado({
          contexto,
          itemRelacionado,
        }),

      severidade:
        dados.severidade ??
        'MEDIA',

      dados_deteccao:
        dados.dados_deteccao ??
        dados.detalhes ??
        null,
    };
  }

  montarAtualizacaoDeteccao({
    registro,
    dados,
  }) {
    return {
      tipo: dados.tipo ?? registro.tipo,

      categoria:
        dados.categoria ??
        registro.categoria,

      titulo:
        dados.titulo ??
        registro.titulo,

      descricao:
        dados.descricao ??
        registro.descricao,

      campo_afetado:
        dados.campo_afetado ??
        registro.campo_afetado,

      valor_encontrado:
        this.normalizarTextoBanco(
          dados.valor_encontrado,
        ),

      valor_esperado:
        this.normalizarTextoBanco(
          dados.valor_esperado,
        ),

      valor_afetado:
        dados.valor_afetado ??
        registro.valor_afetado,

      severidade:
        this.obterMaiorSeveridade(
          registro.severidade,
          dados.severidade,
        ),

      dados_deteccao:
        this.mesclarDadosDeteccao(
          registro.dados_deteccao,
          dados.dados_deteccao ??
            dados.detalhes,
        ),

      ultima_verificacao_em:
        new Date(),
    };
  }

  possuiAlteracaoRelevante(
    registro,
    dados,
  ) {
    return (
      (
        dados.severidade &&
        dados.severidade !==
          registro.severidade
      ) ||
      (
        dados.valor_encontrado !==
          undefined &&
        this.normalizarTextoBanco(
          dados.valor_encontrado,
        ) !== registro.valor_encontrado
      ) ||
      (
        dados.valor_esperado !==
          undefined &&
        this.normalizarTextoBanco(
          dados.valor_esperado,
        ) !== registro.valor_esperado
      )
    );
  }

  criarSnapshot(registro) {
    const dados = normalizarModel(registro);

    return {
      id: dados.id,
      codigo_regra: dados.codigo_regra,
      chave_inconsistencia:
        dados.chave_inconsistencia,
      tipo: dados.tipo,
      categoria: dados.categoria,
      titulo: dados.titulo,
      descricao: dados.descricao,
      campo_afetado:
        dados.campo_afetado,
      valor_encontrado:
        dados.valor_encontrado,
      valor_esperado:
        dados.valor_esperado,
      valor_afetado:
        dados.valor_afetado,
      severidade: dados.severidade,
      status: dados.status,
      responsavel_id:
        dados.responsavel_id,
      dados_deteccao:
        dados.dados_deteccao,
    };
  }

  mesclarDadosDeteccao(
    anterior,
    novo,
  ) {
    if (!anterior) {
      return novo ?? null;
    }

    if (!novo) {
      return anterior;
    }

    return {
      ...anterior,
      ...novo,
      deteccoes: [
        ...(
          Array.isArray(
            anterior.deteccoes,
          )
            ? anterior.deteccoes
            : [anterior]
        ),
        ...(
          Array.isArray(novo.deteccoes)
            ? novo.deteccoes
            : [novo]
        ),
      ],
    };
  }

  obterMaiorSeveridade(
    atual,
    nova,
  ) {
    const peso = {
      MEDIA: 1,
      ALTA: 2,
      CRITICA: 3,
    };

    if (!nova) {
      return atual;
    }

    return peso[nova] > peso[atual]
      ? nova
      : atual;
  }

  obterValorAfetado({
    contexto,
    itemRelacionado,
  }) {
    if (itemRelacionado) {
      return (
        itemRelacionado.valor_total ??
        itemRelacionado.valorTotal ??
        itemRelacionado.subtotal ??
        null
      );
    }

    return contexto.nota.valor_total ?? null;
  }

  normalizarTextoBanco(valor) {
    if (
      valor === null ||
      valor === undefined
    ) {
      return null;
    }

    if (typeof valor === 'object') {
      return JSON.stringify(valor);
    }

    return String(valor);
  }

  normalizarLista(valor) {
    const valores = Array.isArray(valor)
      ? valor
      : String(valor).split(',');

    const normalizados = valores
      .map(item =>
        String(item).trim().toUpperCase(),
      )
      .filter(Boolean);

    return normalizados.length === 1
      ? normalizados[0]
      : {
          [Op.in]: normalizados,
        };
  }

  criarOrdenacaoSeveridade() {
    return InconsistenciaFiscal.sequelize.literal(`
      CASE
        WHEN "severidade" = 'CRITICA' THEN 1
        WHEN "severidade" = 'ALTA' THEN 2
        ELSE 3
      END
    `);
  }

  validarSincronizacao({
    auditoria,
    contexto,
  }) {
    if (!auditoria?.id) {
      throw new Error(
        'A auditoria é obrigatória para sincronizar inconsistências.',
      );
    }

    if (!contexto?.empresaId) {
      throw new Error(
        'A empresa não foi informada no contexto.',
      );
    }

    if (!contexto?.nota?.id) {
      throw new Error(
        'A nota fiscal não foi informada no contexto.',
      );
    }
  }
}

export default new InconsistenciaFiscalService();