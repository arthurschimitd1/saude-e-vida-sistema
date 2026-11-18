// src/services/fiscal/inteligencia/AuditoriaFiscalService.js

import { Op } from 'sequelize';

import sequelize from '../../config/database.js';

import AuditoriaFiscal from '../../models/inteligencia-fiscal/AuditoriaFiscal.js';
import AuditoriaFiscalInconsistencia from '../../models/inteligencia-fiscal/AuditoriaFiscalInconsistencia.js';
import InconsistenciaFiscal from '../../models/inteligencia-fiscal/InconsistenciaFiscal.js';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';

import ContextoAuditoriaFiscalService from './ContextoAuditoriaFiscalService.js';
import InconsistenciaFiscalService from './InconsistenciaFiscalService.js';

import {
  obterRegrasPorContexto,
  validarRegrasRegistradas,
} from './rules/index.js';

function normalizarModel(registro) {
  if (!registro) {
    return null;
  }

  if (typeof registro.toJSON === 'function') {
    return registro.toJSON();
  }

  return registro;
}

class AuditoriaFiscalService {
  /**
   * Audita uma única nota.
   *
   * Ideal para ser chamada automaticamente
   * após emissão, consulta ou atualização da nota.
   */
  async executarNota({
    notaFiscalId,
    empresaId,
    usuarioId = null,
    tipoExecucao = 'AUTOMATICA',
  }) {
    const transaction =
      await sequelize.transaction();

    let auditoria = null;

    try {
      const nota =
        await NotaFiscalEmitida.findOne({
          where: {
            id: Number(notaFiscalId),
            empresa_id: Number(empresaId),
          },
          transaction,
        });

      if (!nota) {
        throw new Error(
          `Nota fiscal ${notaFiscalId} não encontrada.`,
        );
      }

      const dataReferencia =
        nota.data_emissao ??
        nota.created_at ??
        new Date();

      const dataPeriodo =
        this.formatarData(
          dataReferencia,
        );

      auditoria =
        await this.criarAuditoria({
          empresaId,
          usuarioId,
          tipoExecucao,
          periodoInicio: dataPeriodo,
          periodoFim: dataPeriodo,
          tiposDocumento: [nota.tipo],
          totalDocumentos: 1,
          transaction,
        });

      const resultadoNota =
        await this.auditarContexto({
          auditoria,
          tipoContexto: 'NOTA_FISCAL',
          referenciaId: nota.id,
          empresaId,
          transaction,
        });

      const totais =
        this.calcularTotaisAuditoria([
          resultadoNota,
        ]);

      await this.finalizarAuditoria({
        auditoria,
        totais,
        resultados: [resultadoNota],
        transaction,
      });

      await transaction.commit();

      return {
        auditoria:
          normalizarModel(auditoria),
        documentos: [resultadoNota],
      };
    } catch (error) {
      await transaction.rollback();

      if (auditoria?.id) {
        await this.marcarAuditoriaComErro({
          auditoriaId: auditoria.id,
          mensagemErro: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Audita todas as notas de um período.
   *
   * Será utilizada no endpoint manual da tela
   * e também em execuções agendadas.
   */
  async executarPeriodo({
    empresaId,
    periodoInicio,
    periodoFim,
    tiposDocumento = ['NFE', 'NFCE'],
    usuarioId = null,
    tipoExecucao = 'MANUAL',
  }) {
    this.validarPeriodo({
      periodoInicio,
      periodoFim,
    });

    const notas =
      await NotaFiscalEmitida.findAll({
        where: {
          empresa_id: Number(empresaId),

          tipo: {
            [Op.in]: tiposDocumento,
          },

          data_emissao: {
            [Op.between]: [
              new Date(
                `${periodoInicio}T00:00:00`,
              ),
              new Date(
                `${periodoFim}T23:59:59`,
              ),
            ],
          },
        },
        order: [['data_emissao', 'ASC']],
      });

    const auditoria =
      await this.criarAuditoria({
        empresaId,
        usuarioId,
        tipoExecucao,
        periodoInicio,
        periodoFim,
        tiposDocumento,
        totalDocumentos: notas.length,
      });

    const resultados = [];
    const erros = [];

    await auditoria.update({
      status: 'PROCESSANDO',
      iniciada_em: new Date(),
    });

    for (const nota of notas) {
      const transaction =
        await sequelize.transaction();

      try {
        const resultado =
          await this.auditarContexto({
            auditoria,
            tipoContexto: 'NOTA_FISCAL',
            referenciaId: nota.id,
            empresaId,
            transaction,
          });

        resultados.push(resultado);

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();

        erros.push({
          notaFiscalId: nota.id,
          mensagem: error.message,
        });
      }
    }

    const totais =
      this.calcularTotaisAuditoria(
        resultados,
      );

    await this.finalizarAuditoria({
      auditoria,
      totais,
      resultados,
      erros,
    });

    return {
      auditoria:
        normalizarModel(auditoria),
      documentos: resultados,
      erros,
    };
  }

  async auditarContexto({
    auditoria,
    tipoContexto,
    referenciaId,
    empresaId,
    transaction,
  }) {
    validarRegrasRegistradas();

    const contexto =
      await ContextoAuditoriaFiscalService.carregar({
        tipoContexto,
        referenciaId,
        empresaId,
        transaction,
      });
    
    console.log("contexto", tipoContexto);
    const regras =
      obterRegrasPorContexto(
        tipoContexto,
      );

    console.log("regras", regras);

    const execucaoRegras =
      await this.executarRegras({
        contexto,
        regras,
      });
    
    console.log("execução", execucaoRegras);

    const inconsistencias =
      this.consolidarInconsistencias(
        execucaoRegras.inconsistencias,
      );

    const persistencia =
      await InconsistenciaFiscalService.sincronizar({
        auditoria,
        contexto,
        inconsistencias,
        transaction,
      });

    return {
      tipoContexto,
      referenciaId: Number(referenciaId),
      notaFiscalId: contexto.nota.id,
      tipoDocumento: contexto.nota.tipo,
      valorDocumento:
        Number(
          contexto.nota.valor_total ?? 0,
        ),

      totalRegras: regras.length,
      totalRegrasErro:
        execucaoRegras.erros.length,

      totalInconsistencias:
        inconsistencias.length,

      conforme:
        inconsistencias.length === 0,

      regrasExecutadas:
        execucaoRegras.regrasExecutadas,

      errosRegras:
        execucaoRegras.erros,

      inconsistencias,
      persistencia,
    };
  }

  async executarRegras({
    contexto,
    regras,
  }) {
    const inconsistencias = [];
    const regrasExecutadas = [];
    const erros = [];

    for (const regra of regras) {
      try {
        const resultado =
          await regra.executar(contexto);

        const lista =
          this.normalizarResultadoRegra({
            regra,
            resultado,
          });

        inconsistencias.push(...lista);

        regrasExecutadas.push({
          codigo: regra.codigo,
          nome: regra.nome,
          sucesso: true,
          totalInconsistencias:
            lista.length,
        });
      } catch (error) {
        erros.push({
          codigo:
            regra.codigo ??
            'REGRA_SEM_CODIGO',

          nome:
            regra.nome ??
            'Regra sem nome',

          mensagem: error.message,
        });

        regrasExecutadas.push({
          codigo:
            regra.codigo ??
            'REGRA_SEM_CODIGO',

          nome:
            regra.nome ??
            'Regra sem nome',

          sucesso: false,
          totalInconsistencias: 0,
        });
      }
    }

    return {
      inconsistencias,
      regrasExecutadas,
      erros,
    };
  }

  normalizarResultadoRegra({
    regra,
    resultado,
  }) {
    if (
      resultado === null ||
      resultado === undefined
    ) {
      return [];
    }

    const lista = Array.isArray(resultado)
      ? resultado
      : [resultado];

    return lista
      .filter(Boolean)
      .map(inconsistencia => {
        const codigoRegra =
          inconsistencia.codigo_regra ??
          inconsistencia.codigoRegra ??
          regra.codigo;

        const chave =
          inconsistencia
            .chave_inconsistencia ??
          inconsistencia
            .chaveInconsistencia;

        if (!codigoRegra) {
          throw new Error(
            `A regra ${regra.nome} retornou uma inconsistência sem código.`,
          );
        }

        if (!chave) {
          throw new Error(
            `A regra ${codigoRegra} retornou uma inconsistência sem chave.`,
          );
        }

        return {
          ...inconsistencia,
          codigo_regra: codigoRegra,
          chave_inconsistencia: chave,
          severidade:
            inconsistencia.severidade ??
            'MEDIA',
        };
      });
  }

  consolidarInconsistencias(
    inconsistencias,
  ) {
    const mapa = new Map();

    for (const inconsistencia of inconsistencias) {
      const chave =
        inconsistencia.chave_inconsistencia;

      const existente = mapa.get(chave);

      if (!existente) {
        mapa.set(chave, {
          ...inconsistencia,
        });

        continue;
      }

      mapa.set(
        chave,
        this.mesclarInconsistencias(
          existente,
          inconsistencia,
        ),
      );
    }

    return [...mapa.values()];
  }

  mesclarInconsistencias(
    atual,
    nova,
  ) {
    return {
      ...atual,
      ...nova,

      severidade:
        this.obterMaiorSeveridade(
          atual.severidade,
          nova.severidade,
        ),

      produto_id:
        nova.produto_id ??
        atual.produto_id,

      venda_item_id:
        nova.venda_item_id ??
        atual.venda_item_id,

      valor_encontrado:
        nova.valor_encontrado ??
        atual.valor_encontrado,

      valor_esperado:
        nova.valor_esperado ??
        atual.valor_esperado,

      dados_deteccao: {
        ...(
          atual.dados_deteccao ?? {}
        ),
        ...(
          nova.dados_deteccao ?? {}
        ),

        fontes: [
          ...new Set([
            ...this.obterFontes(
              atual.dados_deteccao,
            ),
            ...this.obterFontes(
              nova.dados_deteccao,
            ),
          ]),
        ],
      },
    };
  }

  async criarAuditoria({
    empresaId,
    usuarioId,
    tipoExecucao,
    periodoInicio,
    periodoFim,
    tiposDocumento,
    totalDocumentos,
    transaction = null,
  }) {
    return AuditoriaFiscal.create(
      {
        empresa_id: Number(empresaId),

        executada_por_id:
          usuarioId
            ? Number(usuarioId)
            : null,

        tipo_execucao:
          tipoExecucao,

        status: 'PROCESSANDO',

        periodo_inicio:
          periodoInicio,

        periodo_fim:
          periodoFim,

        tipos_documento:
          tiposDocumento,

        total_documentos:
          totalDocumentos,

        iniciada_em:
          new Date(),
      },
      {
        transaction,
      },
    );
  }

  calcularTotaisAuditoria(
    resultados,
  ) {
    const inconsistencias =
      resultados.flatMap(
        resultado =>
          resultado.inconsistencias,
      );

    const documentosComInconsistencia =
      resultados.filter(
        resultado =>
          resultado.totalInconsistencias > 0,
      ).length;

    const totalNovas = resultados.reduce(
      (total, resultado) =>
        total +
        resultado.persistencia
          .totalCriadas,
      0,
    );

    const totalAtualizadas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.persistencia
            .totalAtualizadas,
        0,
      );

    const totalReabertas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.persistencia
            .totalReabertas,
        0,
      );

    const totalResolvidas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.persistencia
            .totalResolvidas,
        0,
      );

    const valorTotalAfetado =
      inconsistencias.reduce(
        (total, item) =>
          total +
          Number(
            item.valor_afetado ?? 0,
          ),
        0,
      );

    const taxaInconsistencia =
      resultados.length > 0
        ? (
            documentosComInconsistencia /
            resultados.length
          ) * 100
        : 0;

    const scoreFiscal =
      Math.max(
        0,
        100 - taxaInconsistencia,
      );

    return {
      totalDocumentos:
        resultados.length,

      documentosConformes:
        resultados.length -
        documentosComInconsistencia,

      documentosComInconsistencia,

      totalInconsistencias:
        inconsistencias.length,

      inconsistenciasCriticas:
        inconsistencias.filter(
          item =>
            item.severidade === 'CRITICA',
        ).length,

      inconsistenciasAltas:
        inconsistencias.filter(
          item =>
            item.severidade === 'ALTA',
        ).length,

      inconsistenciasMedias:
        inconsistencias.filter(
          item =>
            item.severidade === 'MEDIA',
        ).length,

      totalResolvidas,
      totalNovas,
      totalAtualizadas,
      totalReabertas,

      valorTotalAfetado,
      taxaInconsistencia,
      scoreFiscal,

      classificacao:
        this.classificarScore(
          scoreFiscal,
        ),

      totalRegras:
        resultados.reduce(
          (total, resultado) =>
            total +
            resultado.totalRegras,
          0,
        ),

      totalRegrasErro:
        resultados.reduce(
          (total, resultado) =>
            total +
            resultado.totalRegrasErro,
          0,
        ),
    };
  }

  async finalizarAuditoria({
    auditoria,
    totais,
    resultados,
    erros = [],
    transaction = null,
  }) {
    const possuiErros =
      erros.length > 0 ||
      totais.totalRegrasErro > 0;

    await auditoria.update(
      {
        status: possuiErros
          ? 'CONCLUIDA_COM_ERROS'
          : 'CONCLUIDA',

        finalizada_em:
          new Date(),

        total_documentos:
          totais.totalDocumentos,

        documentos_conformes:
          totais.documentosConformes,

        documentos_com_inconsistencia:
          totais.documentosComInconsistencia,

        total_inconsistencias:
          totais.totalInconsistencias,

        inconsistencias_criticas:
          totais.inconsistenciasCriticas,

        inconsistencias_altas:
          totais.inconsistenciasAltas,

        inconsistencias_medias:
          totais.inconsistenciasMedias,

        total_resolvidas:
          totais.totalResolvidas,

        total_novas:
          totais.totalNovas,

        total_atualizadas:
          totais.totalAtualizadas,

        total_reabertas:
          totais.totalReabertas,

        total_regras:
          totais.totalRegras,

        total_regras_erro:
          totais.totalRegrasErro,

        valor_total_afetado:
          totais.valorTotalAfetado,

        taxa_inconsistencia:
          totais.taxaInconsistencia,

        score_fiscal:
          totais.scoreFiscal,

        classificacao:
          totais.classificacao,

        mensagem_erro:
          possuiErros
            ? 'A auditoria foi concluída com falhas parciais.'
            : null,

        resumo: {
          erros,
          documentos: resultados.map(
            resultado => ({
              notaFiscalId:
                resultado.notaFiscalId,
              tipoDocumento:
                resultado.tipoDocumento,
              conforme:
                resultado.conforme,
              totalInconsistencias:
                resultado
                  .totalInconsistencias,
              errosRegras:
                resultado.errosRegras,
            }),
          ),
        },
      },
      {
        transaction,
      },
    );

    return auditoria;
  }

  async marcarAuditoriaComErro({
    auditoriaId,
    mensagemErro,
  }) {
    await AuditoriaFiscal.update(
      {
        status: 'ERRO',
        finalizada_em: new Date(),
        mensagem_erro:
          mensagemErro,
      },
      {
        where: {
          id: auditoriaId,
        },
      },
    );
  }

  /**
   * Histórico de auditorias para o frontend.
   */
  async listar({
    empresaId,
    pagina = 1,
    limite = 20,
    status,
    tipoExecucao,
    periodoInicio,
    periodoFim,
  }) {
    const where = {
      empresa_id: Number(empresaId),
    };

    if (status) {
      where.status = status;
    }

    if (tipoExecucao) {
      where.tipo_execucao =
        tipoExecucao;
    }

    if (periodoInicio || periodoFim) {
      where.periodo_inicio = {};

      if (periodoInicio) {
        where.periodo_inicio[Op.gte] =
          periodoInicio;
      }

      if (periodoFim) {
        where.periodo_inicio[Op.lte] =
          periodoFim;
      }
    }

    const paginaNumero =
      Math.max(Number(pagina) || 1, 1);

    const limiteNumero =
      Math.min(
        Math.max(Number(limite) || 20, 1),
        100,
      );

    const resultado =
      await AuditoriaFiscal.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: limiteNumero,
        offset:
          (paginaNumero - 1) *
          limiteNumero,
      });

    return {
      dados:
        resultado.rows.map(normalizarModel),

      paginacao: {
        pagina: paginaNumero,
        limite: limiteNumero,
        total: resultado.count,
        totalPaginas: Math.ceil(
          resultado.count /
          limiteNumero,
        ),
      },
    };
  }

  /**
   * Detalhes da auditoria completa.
   */
  async buscarDetalhes({
    empresaId,
    auditoriaId,
  }) {
    const auditoria =
      await AuditoriaFiscal.findOne({
        where: {
          id: Number(auditoriaId),
          empresa_id: Number(empresaId),
        },
      });

    if (!auditoria) {
      throw new Error(
        `Auditoria fiscal ${auditoriaId} não encontrada.`,
      );
    }

    const resultados =
      await AuditoriaFiscalInconsistencia.findAll({
        where: {
          auditoria_id:
            auditoria.id,
        },
        order: [['created_at', 'DESC']],
      });

    const idsInconsistencias =
      resultados.map(
        item => item.inconsistencia_id,
      );

    const inconsistencias =
      idsInconsistencias.length > 0
        ? await InconsistenciaFiscal.findAll({
            where: {
              id: {
                [Op.in]:
                  idsInconsistencias,
              },
              empresa_id:
                Number(empresaId),
            },
          })
        : [];

    return {
      auditoria:
        normalizarModel(auditoria),

      resultados:
        resultados.map(normalizarModel),

      inconsistencias:
        inconsistencias.map(
          normalizarModel,
        ),
    };
  }

  /**
   * Dados para a tela de Auditoria Completa.
   */
  async obterDashboard({
    empresaId,
    periodoInicio,
    periodoFim,
  }) {
    const auditorias =
      await AuditoriaFiscal.findAll({
        where: {
          empresa_id: Number(empresaId),

          status: {
            [Op.in]: [
              'CONCLUIDA',
              'CONCLUIDA_COM_ERROS',
            ],
          },

          periodo_inicio: {
            [Op.gte]: periodoInicio,
          },

          periodo_fim: {
            [Op.lte]: periodoFim,
          },
        },

        order: [['finalizada_em', 'ASC']],
      });

    const ultimaAuditoria =
      auditorias[
        auditorias.length - 1
      ] ?? null;

    return {
      scoreFiscal:
        ultimaAuditoria?.score_fiscal ??
        null,

      classificacao:
        ultimaAuditoria?.classificacao ??
        null,

      taxaInconsistencia:
        ultimaAuditoria
          ?.taxa_inconsistencia ??
        null,

      totalAuditorias:
        auditorias.length,

      evolucao: auditorias.map(
        auditoria => ({
          auditoriaId: auditoria.id,
          periodoInicio:
            auditoria.periodo_inicio,
          periodoFim:
            auditoria.periodo_fim,
          scoreFiscal:
            auditoria.score_fiscal,
          taxaInconsistencia:
            auditoria
              .taxa_inconsistencia,
          totalInconsistencias:
            auditoria
              .total_inconsistencias,
        }),
      ),
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

    return peso[nova] > peso[atual]
      ? nova
      : atual;
  }

  obterFontes(dados) {
    if (!dados) {
      return [];
    }

    const fontes = [];

    if (dados.origem) {
      fontes.push(dados.origem);
    }

    if (Array.isArray(dados.fontes)) {
      fontes.push(...dados.fontes);
    }

    return fontes.filter(Boolean);
  }

  classificarScore(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
  }

  formatarData(valor) {
    return new Date(valor)
      .toISOString()
      .slice(0, 10);
  }

  validarPeriodo({
    periodoInicio,
    periodoFim,
  }) {
    if (!periodoInicio || !periodoFim) {
      throw new Error(
        'O período inicial e final são obrigatórios.',
      );
    }

    if (
      new Date(periodoInicio) >
      new Date(periodoFim)
    ) {
      throw new Error(
        'O período inicial não pode ser maior que o período final.',
      );
    }
  }
}

export default new AuditoriaFiscalService();