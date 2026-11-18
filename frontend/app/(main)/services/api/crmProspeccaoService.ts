import api from './baseApi';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Campanha {
    id: number;
    name: string;
    segment: string | null;
    description: string | null;
    states: string[];
    cities: string[];
    neighborhoods: string[];
    radius: number;
    created_by: number | null;
    empresa_id: number | null;
    created_at: string;
    updated_at: string;
}

export interface Prospect {
    id: number;
    campaign_id: number | null;
    empresa_id: number | null;
    company_name: string;
    responsible_name: string | null;
    phone: string | null;
    landline: string | null;
    email: string | null;
    instagram: string | null;
    linkedin: string | null;
    youtube: string | null;
    tiktok: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    google_place_id: string | null;
    google_rating: number | null;
    google_reviews: number;
    lead_score: number;
    status: string;
    observations: string | null;
    created_at: string;
    updated_at: string;
}

export interface Interacao {
    id: number;
    prospect_id: number;
    user_id: number | null;
    empresa_id: number | null;
    interaction_type: string | null;
    content: string | null;
    created_at: string;
}

export interface Script {
    id: number;
    campaign_id: number | null;
    empresa_id: number | null;
    title: string;
    content: string | null;
    script_type: string;
    created_at: string;
    updated_at: string;
}

export interface DashboardData {
    campanhas: number;
    leads_total: number;
    leads_quentes: number;
    reunioes_marcadas: number;
    propostas_enviadas: number;
    fechados: number;
    perdidos: number;
    taxa_conversao: number;
    leads_por_cidade: { label: string; value: number }[];
    leads_por_segmento: { label: string; value: number }[];
}

export interface BuscarEmpresasPayload {
    segment?: string;
    city: string;
    state?: string;
    radius?: number;
    pagetoken?: string;
    limit?: number;
}

export interface GerarScriptPayload {
    segment: string;
    product: string;
    objective: string;
    script_type?: string;
    variacoes?: number;
    campaign_id?: number;
    salvar?: boolean;
}

// ── Campanhas ──────────────────────────────────────────────────────────────

export const campanhaService = {
    listar: () => api.get<Campanha[]>('/crm/campanhas'),

    buscarPorId: (id: number) => api.get<Campanha>(`/crm/campanhas/${id}`),

    criar: (data: Partial<Campanha>) => api.post<Campanha>('/crm/campanhas', data),

    atualizar: (id: number, data: Partial<Campanha>) =>
        api.put<Campanha>(`/crm/campanhas/${id}`, data),

    deletar: (id: number) => api.delete(`/crm/campanhas/${id}`),

    buscarEmpresas: (id: number, payload: BuscarEmpresasPayload) =>
        api.post(`/crm/campanhas/${id}/buscar-empresas`, payload),

    importarPlanilha: (id: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/crm/campanhas/${id}/importar-planilha`, formData);
    },
};

// ── Prospects ──────────────────────────────────────────────────────────────

export const prospectService = {
    listar: (params?: { campaign_id?: number; status?: string; search?: string }) =>
        api.get<Prospect[]>('/crm/prospects', { params }),

    buscarPorId: (id: number) => api.get<Prospect>(`/crm/prospects/${id}`),

    criar: (data: Partial<Prospect>) => api.post<Prospect>('/crm/prospects', data),

    atualizar: (id: number, data: Partial<Prospect>) =>
        api.put<Prospect>(`/crm/prospects/${id}`, data),

    atualizarStatus: (id: number, status: string) =>
        api.patch(`/crm/prospects/${id}/status`, { status }),

    deletar: (id: number) => api.delete(`/crm/prospects/${id}`),

    enriquecer: (id: number) => api.post(`/crm/prospects/${id}/enriquecer`, {}),
};

// ── Interações ─────────────────────────────────────────────────────────────

export const interacaoService = {
    listarPorProspect: (prospect_id: number) =>
        api.get<Interacao[]>('/crm/interacoes', { params: { prospect_id } }),

    criar: (data: { prospect_id: number; interaction_type: string; content: string }) =>
        api.post<Interacao>('/crm/interacoes', data),

    deletar: (id: number) => api.delete(`/crm/interacoes/${id}`),
};

// ── Scripts ────────────────────────────────────────────────────────────────

export const scriptService = {
    listar: (params?: { campaign_id?: number; script_type?: string }) =>
        api.get<Script[]>('/crm/scripts', { params }),

    criar: (data: Partial<Script>) => api.post<Script>('/crm/scripts', data),

    atualizar: (id: number, data: Partial<Script>) =>
        api.put<Script>(`/crm/scripts/${id}`, data),

    deletar: (id: number) => api.delete(`/crm/scripts/${id}`),

    gerar: (payload: GerarScriptPayload) =>
        api.post('/crm/scripts/gerar', payload),
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardCrmService = {
    obterIndicadores: () => api.get<DashboardData>('/crm/dashboard'),
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const LEAD_STATUS_OPTIONS = [
    'Novo', 'Contatado', 'Sem Resposta', 'Interessado',
    'Reunião Marcada', 'Proposta Enviada', 'Negociação', 'Fechado', 'Perdido'
] as const;

export type LeadStatus = typeof LEAD_STATUS_OPTIONS[number];

export const SCRIPT_TYPE_OPTIONS = [
    { label: 'Primeiro Contato',    value: 'primeiro_contato' },
    { label: 'Follow-up',           value: 'followup' },
    { label: 'Reativação',          value: 'reativacao' },
    { label: 'Convite para Reunião', value: 'convite_reuniao' },
    { label: 'Proposta Comercial',  value: 'proposta_comercial' },
    { label: 'Recuperação de Lead', value: 'recuperacao_lead' },
];

export const SEGMENTOS = [
    'Restaurante', 'Clínica', 'Escola', 'Academia', 'Loja de Roupa',
    'Loja de Celular', 'Escritório', 'Farmácia', 'Pet Shop', 'Salão de Beleza',
    'Supermercado', 'Padaria', 'Oficina Mecânica', 'Imobiliária', 'Hotel',
];

export function getLeadScoreColor(score: number): string {
    if (score >= 81) return '#ef4444';
    if (score >= 61) return '#f97316';
    if (score >= 31) return '#f59e0b';
    return '#3b82f6';
}

export function getLeadScoreLabel(score: number): string {
    if (score >= 81) return 'Muito Quente';
    if (score >= 61) return 'Quente';
    if (score >= 31) return 'Morno';
    return 'Frio';
}

export function getStatusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
        'Novo':              'info',
        'Contatado':         'info',
        'Sem Resposta':      'secondary',
        'Interessado':       'warning',
        'Reunião Marcada':   'warning',
        'Proposta Enviada':  'warning',
        'Negociação':        'warning',
        'Fechado':           'success',
        'Perdido':           'danger',
    };
    return map[status] ?? 'secondary';
}
