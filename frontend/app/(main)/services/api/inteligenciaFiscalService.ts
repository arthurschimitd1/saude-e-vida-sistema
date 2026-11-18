import api from './baseApi';

export type FiltrosInconsistencia = {
  empresaId?: number | null;
  pagina?: number;
  limite?: number;
  status?: string | string[];
  severidade?: string | string[];
  categoria?: string | string[];
  responsavelId?: number;
  notaFiscalId?: number;
  clienteId?: number;
  produtoId?: number;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
};

type ContextoEmpresa = {
  empresaId: number;
};

type ContextoUsuario = {
  empresaId: number;
  userId?: number;
};

const inteligenciaFiscalService = {
  listarInconsistencias(
    filtros: FiltrosInconsistencia | null,
  ) {
    return api.get(
      '/inteligencia-fiscal/inconsistencias',
      {
        params: filtros,
      },
    );
  },

  obterResumo(params: {
    empresaId: number;
    dataInicio?: string;
    dataFim?: string;
  }) {
    return api.get(
      '/inteligencia-fiscal/inconsistencias/resumo',
      {
        params,
      },
    );
  },

  buscarInconsistencia(
    id: number,
    empresaId: number,
  ) {
    return api.get(
      `/inteligencia-fiscal/inconsistencias/${id}`,
      {
        params: {
          empresaId,
        },
      },
    );
  },

  alterarStatus(
    id: number,
    dados: {
      status: string;
      observacao?: string;
    },
    contexto: ContextoUsuario,
  ) {
    return api.patch(
      `/inteligencia-fiscal/inconsistencias/${id}/status`,
      dados,
      {
        params: contexto,
      },
    );
  },

  resolver(
    id: number,
    dados: {
      tipoResolucao:
        | 'CADASTRO_CORRIGIDO'
        | 'DOCUMENTO_CORRIGIDO'
        | 'JUSTIFICADO'
        | 'IGNORADO';
      observacao?: string;
    },
    contexto: ContextoUsuario,
  ) {
    return api.patch(
      `/inteligencia-fiscal/inconsistencias/${id}/resolver`,
      dados,
      {
        params: contexto,
      },
    );
  },

  atribuirResponsavel(
    id: number,
    responsavelId: number | null,
    contexto: ContextoUsuario,
  ) {
    return api.patch(
      `/inteligencia-fiscal/inconsistencias/${id}/responsavel`,
      {
        responsavelId,
      },
      {
        params: contexto,
      },
    );
  },

  definirPrazo(
    id: number,
    prazoResolucao: string | null,
    contexto: ContextoUsuario,
  ) {
    return api.patch(
      `/inteligencia-fiscal/inconsistencias/${id}/prazo`,
      {
        prazoResolucao,
      },
      {
        params: contexto,
      },
    );
  },

  executarAuditoriaPeriodo(dados: {
    periodoInicio: string;
    periodoFim: string;
    tiposDocumento: Array<
      'NFE' | 'NFCE' | 'NFSE'
    >;
    empresaId: number;
    userId: number;
  }) {
    return api.post(
      '/inteligencia-fiscal/auditorias',
      dados,
    );
  },

  executarAuditoriaNota(
    notaFiscalId: number,
    empresaId: number,
    userId: number,
  ) {
    return api.post(
      `/inteligencia-fiscal/auditorias/nota/${notaFiscalId}`,
      {},
      {
        params: {
          empresaId,
          userId,
        },
      },
    );
  },

  listarAuditorias(params: {
    empresaId: number;
    pagina?: number;
    limite?: number;
    status?: string;
    tipoExecucao?: string;
    periodoInicio?: string;
    periodoFim?: string;
  }) {
    return api.get(
      '/inteligencia-fiscal/auditorias',
      {
        params,
      },
    );
  },

  buscarAuditoria(
    id: number,
    empresaId: number,
  ) {
    return api.get(
      `/inteligencia-fiscal/auditorias/${id}`,
      {
        params: {
          empresaId,
        },
      },
    );
  },

  obterDashboard(params: {
    empresaId: number;
    periodoInicio: string;
    periodoFim: string;
  }) {
    return api.get(
      '/inteligencia-fiscal/auditorias/dashboard',
      {
        params,
      },
    );
  },
};

export default inteligenciaFiscalService;