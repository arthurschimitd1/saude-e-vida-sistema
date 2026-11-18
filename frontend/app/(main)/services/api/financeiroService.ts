import api from './baseApi';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LancamentoConsolidado {
    origem: string;
    id: number;
    descricao: string;
    valor: number;
    data: string;
    tipo?: string;
    natureza?: 'ENTRADA' | 'SAIDA';
}

export interface Saida {
    id: number;
    tipo: string;
    natureza: 'ENTRADA' | 'SAIDA';
    descricao: string | null;
    data: string;
    valor: number;
    empresa_id: number | null;
}

export interface DashboardFinanceiro {
    totalEntradas: number;
    totalSaidas: number;
    saldo: number;
    custoFolha: number;
    recorrenciasAtivas: number;
    serie: {
        labels: string[];
        entradas: number[];
        saidas: number[];
    };
}

export interface PeriodoFiltro {
    dataInicio?: string;
    dataFim?: string;
}

export interface NovoLancamentoPayload {
    tipo: string;
    natureza: 'ENTRADA' | 'SAIDA';
    descricao?: string;
    data: string;
    valor: number;
}

export interface ContaReceber {
    id: number;
    empresa_id: number;
    cliente_id: number | null;
    venda_id: number | null;
    nota_fiscal_id: number | null;
    origem: 'MANUAL' | 'VENDA' | 'NF_E' | 'RECORRENCIA';
    descricao: string;
    valor: number;
    valor_pago: number;
    data_emissao: string;
    data_vencimento: string;
    data_pagamento: string | null;
    status: 'ABERTA' | 'PAGA' | 'CANCELADA';
    observacao: string | null;
    cliente_nome?: string | null;
    cliente_telefone?: string | null;
    nota_numero?: string | null;
    nota_serie?: string | null;
    venda_valor?: number | null;
}

export interface NovaContaReceberPayload {
    cliente_id?: number | null;
    venda_id?: number | null;
    nota_fiscal_id?: number | null;
    origem?: ContaReceber['origem'];
    descricao: string;
    valor: number;
    valor_pago?: number;
    data_emissao?: string;
    data_vencimento: string;
    data_pagamento?: string | null;
    status?: ContaReceber['status'];
    observacao?: string | null;
}

// ── Service ────────────────────────────────────────────────────────────────

export const financeiroService = {
    obterDashboard: () => api.get<DashboardFinanceiro>('/financeiro/dashboard'),

    listarEntradas: (params?: PeriodoFiltro) =>
        api.get<LancamentoConsolidado[]>('/financeiro/entradas', { params }),

    listarSaidasConsolidado: (params?: PeriodoFiltro) =>
        api.get<LancamentoConsolidado[]>('/financeiro/saidas-consolidado', { params }),

    listarLancamentosManuais: (params?: PeriodoFiltro & { natureza?: 'ENTRADA' | 'SAIDA' }) =>
        api.get<Saida[]>('/financeiro/saidas', { params }),

    criarLancamento: (data: NovoLancamentoPayload) => api.post<Saida>('/financeiro/saidas', data),

    atualizarLancamento: (id: number, data: Partial<NovoLancamentoPayload>) =>
        api.put<Saida>(`/financeiro/saidas/${id}`, data),

    deletarLancamento: (id: number) => api.delete(`/financeiro/saidas/${id}`),

    listarContasReceber: (params?: { status?: string; busca?: string; dataInicio?: string; dataFim?: string }) =>
        api.get<ContaReceber[]>('/financeiro/contas-receber', { params }),

    criarContaReceber: (data: NovaContaReceberPayload) =>
        api.post<ContaReceber>('/financeiro/contas-receber', data),

    atualizarContaReceber: (id: number, data: Partial<NovaContaReceberPayload>) =>
        api.patch<ContaReceber>(`/financeiro/contas-receber/${id}`, data),
};

export const CATEGORIAS_SAIDA = [
    'Aluguel', 'Energia', 'Água', 'Internet', 'Telefone', 'Marketing',
    'Manutenção', 'Material de Escritório', 'Impostos', 'Outros',
];

export const CATEGORIAS_ENTRADA = [
    'Venda Avulsa', 'Aporte', 'Empréstimo', 'Reembolso', 'Outros',
];
