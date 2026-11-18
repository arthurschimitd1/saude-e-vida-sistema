// frontend/app/(main)/services/api/recorrenciaService.ts
import api from './baseApi';

// ============================================================
// INTERFACES
// ============================================================

export interface RecorrenciaData {
    id?: number;
    nomeCliente: string;
    cliente_id?: number | null;
    produto: string;
    tipoTransacao: 'ENTRADA' | 'SAIDA';
    tempoRecorrencia: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PERSONALIZADO';
    subtipoRecorrencia?: 'SEMANAL' | 'QUINZENAL' | 'DIARIO' | null;
    valorMes: number;
    formaPagamento: 'DINHEIRO' | 'PIX' | 'BOLETO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'TRANSFERENCIA';
    bancoRecebimento?: string;
    bancoNome?: string;
    bancoAgencia?: string;
    bancoConta?: string;
    bancoPix?: string;
    dataInicio: string | Date;
    dataFim?: string | Date | null;
    ativo: boolean;
    ultimoPagamento?: string | Date | null;
    proximoVencimento?: string | Date | null;
    observacoes?: string | null;
    servicosInclusos?: ServicoIncluso[] | null;
    empresa_id?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ServicoIncluso {
    servico_id: string | null;
    servico_nome: string;
    quantidade: number;
}

export interface RecorrenciaFilters {
    nomeCliente?: string;
    produto?: string;
    tipoTransacao?: 'ENTRADA' | 'SAIDA';
    tempoRecorrencia?: string;
    ativo?: boolean | string;
    bancoRecebimento?: string;
    formaPagamento?: string;
    dataInicioDe?: string;
    dataInicioAte?: string;
}

export interface ConfirmarPagamentoData {
    dataPagamento: string | Date;
    valor?: number;
    referenciaId?: number;
}

// Interface simplificada para cliente (sem array de recorrências).
export interface ClienteResumo {
    id: number;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    email?: string;
    totalRecorrencias: number;
    valorTotal: number;
    recorrenciasAtivas: number;
}

// Mantida para compatibilidade
export interface ClienteComRecorrencias {
    id: number | null;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    tipo?: 'cliente' | 'empresa' | 'solto';
    empresa_id?: number | null;
    totalRecorrencias: number;
    valorTotal: number;
    recorrenciasAtivas: number;
    recorrencias: RecorrenciaItem[];
}

// Tipagem do cliente melhorada
export interface RecorrenciaItem {
    id: number;
    nomeCliente: string;
    cliente_id: number | null;
    produto: string;
    tipoTransacao: string;
    tempoRecorrencia: string;
    subtipoRecorrencia: string | null;
    valorMes: number;
    formaPagamento: string;
    bancoRecebimento: string | null;
    dataInicio: string;
    dataFim: string | null;
    ativo: boolean;
    proximoVencimento: string | null;
    quantidadeRestante: number | null;
    ultimoPagamento: string | null;
    observacoes: string | null;
    servicosInclusos?: ServicoIncluso[] | null;
    empresa_id?: number | null;
    cliente?: ClienteAutocomplete | null;
    asaasCustomerId?: string | null;
    asaasSubscriptionId?: string | null;
    asaasPaymentLinkId?: string | null;
    asaasPaymentLinkUrl?: string | null;
    asaasStatus?: string | null;
    asaasLastSyncedAt?: string | null;
    statusRecorrencia?: 'ATIVA' | 'PAUSADA' | 'CANCELADA' | string | null;
    asaasSubscriptionStatus?: string | null;
    asaasSyncStatus?: 'SINCRONIZADO' | 'SINCRONIZANDO' | 'ERRO' | 'NAO_CONFIGURADO' | string | null;
    asaasSyncError?: string | null;
    asaasCheckout?: {
        checkout_url?: string | null;
        checkout_status: string;
        asaas_subscription_id?: string | null;
    } | null;
}

export interface ClienteRecorrenciaFilters {
    nome?: string;
    cpf?: string;
    telefone?: string;
    tipoRecorrencia?: string;
    page?: number;
    limit?: number;
}

export interface DashboardFaturamento {
    faturamentoMesAtual: number;
    valorPrevisto: number;
    totalRecorrenciasAtivas: number;
    porTipo: {
        tipo: string;
        quantidade: number;
        total: number;
    }[];
    porFormaPagamento: {
        forma: string;
        quantidade: number;
    }[];
    mesReferencia: string;
}

export interface RecorrenciaDashboard {
    receitaRecorrenteMensal: number;
    receitaRecebidaMes: number;
    receitaAguardandoPagamento: number;
    totalVencido: number;
    recorrenciasAtivas: number;
    recorrenciasPausadas: number;
    recorrenciasCanceladas: number;
    pagamentosVencidos: number;
    pagamentosEstornados: number;
    taxaInadimplencia: number;
    ticketMedioRecorrente: number;
    novasRecorrenciasMes: number;
    cancelamentosMes: number;
    receitaRecuperada: number;
    mrr: number;
    arr: number;
    recebidoXPrevisto: { recebido: number; previsto: number };
    proximosRecebimentos: any[];
    mesReferencia: string;
}

export interface RecorrenciaConfiguracao {
    empresa_id: number;
    formaPagamentoPadrao: string;
    bancoRecebimento?: string | null;
    bancoNome?: string | null;
    bancoAgencia?: string | null;
    bancoConta?: string | null;
    bancoPix?: string | null;
    juros: number;
    multa: number;
    desconto: number;
    diasAntecedencia: number;
    reciboNomeEmpresa?: string | null;
    reciboDocumento?: string | null;
    reciboEndereco?: string | null;
    reciboTelefone?: string | null;
    reciboRodape?: string | null;
}

export interface RecorrenciaPlano {
    id: number;
    nome: string;
    descricao?: string | null;
    valor: number;
    periodicidade: string;
    ativo: boolean;
}

export interface ClienteAutocomplete {
    id: number;
    nomeCompleto: string;
    cpf: string | null;
    telefone: string;
    empresa_id?: number | null;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================================
// SERVICES
// ============================================================

export const recorrenciaService = {
    async create(recorrenciaData: Omit<RecorrenciaData, 'id' | 'created_at' | 'updated_at'>): Promise<RecorrenciaData> {
        const response = await api.post('/recorrencias', recorrenciaData);
        return response.data.data;
    },

    async getAll(filters: RecorrenciaFilters = {}): Promise<RecorrenciaData[]> {
        const response = await api.get('/recorrencias', { params: filters });
        return response.data.data;
    },

    async getById(id: number): Promise<RecorrenciaData> {
        const response = await api.get(`/recorrencias/${id}`);
        return response.data.data;
    },

    async update(id: number, recorrenciaData: Partial<RecorrenciaData>): Promise<RecorrenciaData> {
        const response = await api.put(`/recorrencias/${id}`, recorrenciaData);
        return response.data.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/recorrencias/${id}`);
    },

    async toggleStatus(id: number): Promise<RecorrenciaData> {
        const response = await api.patch(`/recorrencias/${id}/toggle-status`);
        return response.data.data;
    },

    async confirmarPagamento(id: number, data: ConfirmarPagamentoData): Promise<RecorrenciaData> {
        const response = await api.post(`/recorrencias/${id}/confirmar-pagamento`, data);
        return response.data.data;
    },

    async getHistoricoPagamentos(recorrenciaId: number): Promise<any> {
        const response = await api.get(`/historico-pagamentos/recorrencia/${recorrenciaId}`);
        return response.data.data;
    },

    async getDashboardGestao(): Promise<RecorrenciaDashboard> {
        const response = await api.get('/recorrencias/gestao/dashboard');
        return response.data.data;
    },

    async getPagamentos(filters: Record<string, string | number | undefined> = {}): Promise<any[]> {
        const response = await api.get('/recorrencias/gestao/pagamentos', { params: filters });
        return response.data.data || [];
    },

    async getConfiguracao(): Promise<RecorrenciaConfiguracao> {
        const response = await api.get('/recorrencias/gestao/configuracao');
        return response.data.data;
    },

    async salvarConfiguracao(data: Partial<RecorrenciaConfiguracao>): Promise<RecorrenciaConfiguracao> {
        const response = await api.put('/recorrencias/gestao/configuracao', data);
        return response.data.data;
    },

    async pausar(id: number, motivo?: string): Promise<RecorrenciaData> {
        const response = await api.post(`/recorrencias/gestao/${id}/pausar`, { motivo });
        return response.data.data;
    },

    async reativar(id: number, motivo?: string): Promise<RecorrenciaData> {
        const response = await api.post(`/recorrencias/gestao/${id}/reativar`, { motivo });
        return response.data.data;
    },

    async cancelar(id: number, motivo: string): Promise<RecorrenciaData> {
        const response = await api.post(`/recorrencias/gestao/${id}/cancelar`, { motivo });
        return response.data.data;
    },

    async solicitarEstorno(pagamentoId: number, data: { value?: number; reason: string }): Promise<any> {
        const response = await api.post(`/recorrencias/gestao/pagamentos/${pagamentoId}/estorno`, data);
        return response.data.data;
    },

    async getEventos(id: number): Promise<any[]> {
        const response = await api.get(`/recorrencias/gestao/${id}/eventos`);
        return response.data.data || [];
    },

    async getRecibo(pagamentoId: number): Promise<any> {
        const response = await api.get(`/recorrencias/gestao/pagamentos/${pagamentoId}/recibo`);
        return response.data.data;
    }
};

export const recorrenciaGestaoService = {
    async listarPlanos(): Promise<RecorrenciaPlano[]> {
        const response = await api.get('/recorrencias/gestao/planos');
        return response.data.data || [];
    },
    async criarPlano(data: Omit<RecorrenciaPlano, 'id' | 'ativo'> & { ativo?: boolean }): Promise<RecorrenciaPlano> {
        const response = await api.post('/recorrencias/gestao/planos', data);
        return response.data.data;
    },
    async atualizarPlano(id: number, data: Partial<RecorrenciaPlano>): Promise<RecorrenciaPlano> {
        const response = await api.put(`/recorrencias/gestao/planos/${id}`, data);
        return response.data.data;
    },
    async excluirPlano(id: number): Promise<void> {
        await api.delete(`/recorrencias/gestao/planos/${id}`);
    }
};

export const clienteRecorrenciaService = {
    //Retorna ClienteResumo[] (sem array de recorrências)
    async getClientesComRecorrencias(filters: ClienteRecorrenciaFilters = {}): Promise<ClienteResumo[]> {
        const response = await api.get('/cliente-recorrencias/clientes-recorrencias', { params: filters });
        return response.data.data;
    },

    // Buscar recorrências de um cliente específico
    async getRecorrenciasPorCliente(clienteId: number, filters: { ativo?: string; tipoTransacao?: string; tempoRecorrencia?: string } = {}): Promise<RecorrenciaItem[]> {
        const response = await api.get(`/cliente-recorrencias/cliente/${clienteId}/recorrencias`, { params: filters });
        return response.data.data;
    },

    async getDashboardFaturamento(): Promise<DashboardFaturamento> {
        const response = await api.get('/cliente-recorrencias/dashboard-faturamento');
        return response.data.data;
    },

    async buscarCliente(termo: string): Promise<ClienteAutocomplete[]> {
        const response = await api.get('/cliente-recorrencias/buscar-cliente', { 
            params: { termo } 
        });
        return response.data.data;
    }
};
