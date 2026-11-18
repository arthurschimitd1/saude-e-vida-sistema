import api from './baseApi';

export interface AgendamentoColunaDTO {
    id: number;
    empresa_id: number;
    usuario_id: number | null;
    usuario_nome: string;
    cor: string;
    ordem: number;
    unidade_id: number | null;
}

export interface AgendamentoDTO {
    id: number;
    empresa_id: number;
    coluna_id: number;
    unidade_id: number | null;
    cliente_id: number | null;
    cliente_nome: string;
    data: string; // YYYY-MM-DD
    horario: string;
    observacao: string | null;
    status: 'pendente' | 'confirmado' | 'cancelado';
    criado_em: string;
    notificacaoWhatsapp?: {
        status: 'enviada' | 'falha' | 'sem_telefone' | 'nao_solicitada';
        mensagem: string;
    };
    cliente?: {
        id: number;
        nomeCompleto: string;
        telefone: string | null;
        whatsappCrm?: {
            estagio: string;
            motivo_clinico: string | null;
            observacoes: string | null;
            responsavel?: { id: number; nomeCompleto: string } | null;
            etiquetas?: {
                id: number;
                status: 'sugerida' | 'aceita' | 'rejeitada';
                etiqueta?: { id: number; nome: string; cor: string; tipo: 'etiqueta' | 'protocolo' };
            }[];
        };
        conversasWhatsapp?: { resumo_ia: string | null }[];
    } | null;
}

function unwrap<T>(res: { data: any }): T {
    return res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;
}

function normalizarColuna(item: any): AgendamentoColunaDTO {
    return {
        id: Number(item.id),
        empresa_id: Number(item.empresa_id ?? 0),
        usuario_id: item.usuarioId == null ? null : Number(item.usuarioId),
        usuario_nome: item.usuarioNome ?? item.usuario_nome ?? '',
        cor: item.cor ?? '#3b82f6',
        ordem: Number(item.ordem ?? 0),
        unidade_id: item.unidadeId == null ? null : Number(item.unidadeId)
    };
}

function normalizarAgendamento(item: any): AgendamentoDTO {
    return {
        ...item,
        id: Number(item.id),
        empresa_id: Number(item.empresa_id ?? 0),
        coluna_id: Number(item.colaboradorId ?? item.coluna_id),
        unidade_id: item.unidadeId == null ? null : Number(item.unidadeId),
        cliente_id: item.clienteId == null ? null : Number(item.clienteId),
        cliente_nome: item.clienteNome ?? item.cliente_nome ?? '',
        observacao: item.observacao ?? null,
        status: item.status === 'aguardando' ? 'pendente' : item.status,
        criado_em: item.criadoEm ?? item.criado_em ?? ''
    };
}

export const agendamentoService = {
    listColunas: () => api.get('/agendamentos/colaboradores').then((res) => unwrap<any[]>(res).map(normalizarColuna)),
    createColuna: (dados: { usuario_id?: number | null; usuario_nome: string; cor?: string }) =>
        api
            .post('/agendamentos/colaboradores', {
                usuarioId: dados.usuario_id,
                usuarioNome: dados.usuario_nome,
                cor: dados.cor
            })
            .then((res) => normalizarColuna(unwrap(res))),
    updateColuna: (id: number, dados: { usuario_id?: number | null; usuario_nome?: string; cor?: string }) =>
        api
            .put(`/agendamentos/colaboradores/${id}`, {
                usuarioId: dados.usuario_id,
                usuarioNome: dados.usuario_nome,
                cor: dados.cor
            })
            .then((res) => normalizarColuna(unwrap(res))),
    deleteColuna: (id: number) => api.delete(`/agendamentos/colaboradores/${id}`).then((res) => unwrap(res)),

    listAgendamentos: () => api.get('/agendamentos').then((res) => unwrap<any[]>(res).map(normalizarAgendamento)),
    createAgendamento: (dados: { coluna_id: number; cliente_id?: number | null; cliente_nome: string; data: string; horario: string; observacao?: string; status?: AgendamentoDTO['status']; notificar_whatsapp?: boolean }) =>
        api
            .post('/agendamentos', {
                colaboradorId: dados.coluna_id,
                clienteId: dados.cliente_id,
                clienteNome: dados.cliente_nome,
                data: dados.data,
                horario: dados.horario,
                observacao: dados.observacao,
                status: dados.status === 'pendente' ? 'aguardando' : dados.status,
                notificarWhatsapp: dados.notificar_whatsapp
            })
            .then((res) => normalizarAgendamento(unwrap(res))),
    updateAgendamento: (
        id: number,
        dados: Partial<{
            coluna_id: number;
            cliente_nome: string;
            data: string;
            horario: string;
            observacao: string;
        }>
    ) =>
        api
            .put(`/agendamentos/${id}`, {
                colaboradorId: dados.coluna_id,
                clienteNome: dados.cliente_nome,
                data: dados.data,
                horario: dados.horario,
                observacao: dados.observacao
            })
            .then((res) => normalizarAgendamento(unwrap(res))),
    updateStatus: (id: number, status: AgendamentoDTO['status']) => api.put(`/agendamentos/${id}`, { status: status === 'pendente' ? 'aguardando' : status }).then((res) => normalizarAgendamento(unwrap(res))),
    deleteAgendamento: (id: number) => api.delete(`/agendamentos/${id}`).then((res) => unwrap(res))
};

export default agendamentoService;
