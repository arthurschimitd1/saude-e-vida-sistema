import api from './baseApi';

export type ContadorStatus = 'online' | 'offline' | 'ausente';

export interface ContadorContato {
    id: number;
    nome: string;
    email: string;
    avatarUrl?: string | null;
    status: ContadorStatus;
    telefone?: string | null;
    whatsapp?: string | null;
    horarioAtendimento?: string | null;
    ultimoAcesso?: string | null;
}

export interface PortalContadorContexto {
    empresaId: number | null;
    usuarioMaster: boolean;
    empresaPossuiPacoteContador: boolean;
    podeGerenciarPortal: boolean;
    possuiContadorVinculado: boolean;
    contador: ContadorContato | null;
}

export interface DashboardClienteContador {
    empresaId: number;
    nomeEmpresa: string;
    cnpj?: string | null;
    statusVinculo: 'pendente' | 'ativo' | 'erro';
    chaveContador?: string | null;
    integrationKey?: string | null;
    ultimoEnvio?: string | null;
    contadorEmpresaId: number;
    contadorEmpresaNome: string;
    scoreFiscal: number;
    inconsistenciasFiscais: number;
    documentosPendentesDownload: number;
    solicitacoesPendentes: number;
    obrigacoesProximasVencimento: number;
    totalPendencias: number;
}

export interface DashboardClientesResponse {
    filtros: {
        nome: string | null;
        status: string | null;
        ordenarPor: string;
    };
    resumo: {
        totalEmpresas: number;
        empresasComPendencias: number;
        documentosPendentesDownload: number;
        solicitacoesPendentes: number;
        obrigacoesProximasVencimento: number;
        inconsistenciasFiscais: number;
    };
    clientes: DashboardClienteContador[];
}

export interface DashboardClientesFilters {
    nome?: string;
    status?: string;
    ordenarPor?: 'nome' | 'scoreFiscal' | 'pendencias';
}

export interface PerfilContadorData {
    status: ContadorStatus;
    telefoneProfissional?: string | null;
    whatsappProfissional?: string | null;
    horarioAtendimento?: string | null;
}

export interface EmpresaDisponivelPortal {
    id: number;
    nome: string;
    cnpj?: string | null;
}

export interface VincularClienteData {
    empresaClienteId: number;
    chaveContador: string;
    status: 'pendente' | 'ativo' | 'erro';
}

export interface PortalContadorDocumento {
    id: number;
    contadorEmpresaId?: number | null;
    empresaClienteId: number;
    empresaClienteNome?: string | null;
    nome: string;
    tipo: string;
    competencia?: string | null;
    descricao?: string | null;
    arquivoUrl: string;
    arquivoNomeOriginal: string;
    arquivoMimeType?: string | null;
    arquivoTamanho: number;
    statusLeitura: 'novo' | 'baixado';
    baixadoEm?: string | null;
    baixadoPor?: number | null;
    baixadoPorNome?: string | null;
    baixadoPorTipo?: string | null;
    criadoEm: string;
    atualizadoEm?: string;
}

export interface DocumentoFilters {
    empresaClienteId?: number;
    tipo?: string;
    competencia?: string;
    statusLeitura?: 'novo' | 'baixado';
}

export interface DocumentoUploadData {
    empresaClienteId?: number;
    nome: string;
    tipo: string;
    competencia?: string;
    descricao?: string;
    arquivo: File;
}

export type DocumentoSolicitacaoStatus = 'aberta' | 'em_andamento' | 'atendida' | 'cancelada';
export type DocumentoPrioridade = 'baixa' | 'normal' | 'alta';
export type ObrigacaoStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type ObrigacaoAlertaStatus = 'em_dia' | 'alerta' | 'atrasada' | 'concluida' | 'cancelada';
export type ReuniaoStatus = 'solicitada' | 'agendada' | 'realizada' | 'cancelada';
export type ReuniaoCanal = 'whatsapp' | 'google_meet' | 'teams' | 'presencial' | 'telefone' | 'outro';

export interface PortalContadorDocumentoSolicitacao {
    id: number;
    contadorEmpresaId?: number | null;
    empresaClienteId: number;
    empresaClienteNome?: string | null;
    titulo: string;
    tipo: string;
    competencia?: string | null;
    descricao?: string | null;
    prioridade: DocumentoPrioridade;
    status: DocumentoSolicitacaoStatus;
    solicitadoPor?: number | null;
    solicitadoPorNome?: string | null;
    solicitadoPorTipo: 'empresa' | 'contador';
    atendidoEm?: string | null;
    historico: any[];
    criadoEm: string;
    atualizadoEm?: string;
}

export interface DocumentoSolicitacaoFilters {
    empresaClienteId?: number;
    status?: DocumentoSolicitacaoStatus;
}

export interface DocumentoSolicitacaoData {
    empresaClienteId?: number;
    titulo: string;
    tipo: string;
    competencia?: string;
    descricao?: string;
    prioridade: DocumentoPrioridade;
}

export interface PortalContadorObrigacao {
    id: number;
    contadorEmpresaId?: number | null;
    empresaClienteId: number;
    empresaClienteNome?: string | null;
    titulo: string;
    tipo: string;
    competencia?: string | null;
    descricao?: string | null;
    dataEntrega: string;
    status: ObrigacaoStatus;
    statusAlerta: ObrigacaoAlertaStatus;
    diasAlertaAntecedencia: number;
    responsavelContadorId?: number | null;
    responsavelContadorNome?: string | null;
    concluidoEm?: string | null;
    criadoEm: string;
    atualizadoEm?: string;
}

export interface ObrigacaoFilters {
    empresaClienteId?: number;
    status?: ObrigacaoStatus;
    tipo?: string;
    competencia?: string;
    dataInicio?: string;
    dataFim?: string;
}

export interface ObrigacaoData {
    empresaClienteId?: number;
    titulo: string;
    tipo: string;
    competencia?: string;
    descricao?: string;
    dataEntrega: string;
    status?: ObrigacaoStatus;
    diasAlertaAntecedencia: number;
    responsavelContadorId?: number | null;
}

export interface PortalContadorReuniao {
    id: number;
    contadorEmpresaId?: number | null;
    empresaClienteId: number;
    empresaClienteNome?: string | null;
    obrigacaoId?: number | null;
    obrigacaoTitulo?: string | null;
    titulo: string;
    descricao?: string | null;
    dataReuniao: string;
    horario: string;
    canal: ReuniaoCanal;
    linkReuniao?: string | null;
    status: ReuniaoStatus;
    solicitadoPor?: number | null;
    solicitadoPorNome?: string | null;
    solicitadoPorTipo: 'empresa' | 'contador';
    canceladoEm?: string | null;
    criadoEm: string;
    atualizadoEm?: string;
}

export interface ReuniaoFilters {
    empresaClienteId?: number;
    obrigacaoId?: number;
    status?: ReuniaoStatus;
    dataInicio?: string;
    dataFim?: string;
}

export interface ReuniaoData {
    empresaClienteId?: number;
    obrigacaoId?: number | null;
    titulo: string;
    descricao?: string;
    dataReuniao: string;
    horario: string;
    canal: ReuniaoCanal;
    linkReuniao?: string;
    status?: ReuniaoStatus;
}

const unwrap = <T>(response: any): T => response.data?.data ?? response.data;

export const portalContadorService = {
    async getContexto(): Promise<PortalContadorContexto> {
        const response = await api.get('/portal-contador/contexto');
        return unwrap<PortalContadorContexto>(response);
    },

    async getDashboardClientes(filters: DashboardClientesFilters = {}): Promise<DashboardClientesResponse> {
        const response = await api.get('/portal-contador/dashboard-clientes', { params: filters });
        return unwrap<DashboardClientesResponse>(response);
    },

    async updatePerfil(data: PerfilContadorData): Promise<void> {
        await api.put('/portal-contador/perfil', data);
    },

    async getClientesDisponiveis(nome?: string): Promise<EmpresaDisponivelPortal[]> {
        const response = await api.get('/portal-contador/clientes-disponiveis', {
            params: nome ? { nome } : {}
        });
        return unwrap<EmpresaDisponivelPortal[]>(response);
    },

    async vincularCliente(data: VincularClienteData): Promise<void> {
        await api.post('/portal-contador/clientes', data);
    },

    async getDocumentos(filters: DocumentoFilters = {}): Promise<PortalContadorDocumento[]> {
        const response = await api.get('/portal-contador/documentos', { params: filters });
        return unwrap<PortalContadorDocumento[]>(response);
    },

    async uploadDocumento(data: DocumentoUploadData): Promise<PortalContadorDocumento> {
        const formData = new FormData();
        formData.append('nome', data.nome);
        formData.append('tipo', data.tipo);
        if (data.empresaClienteId) formData.append('empresaClienteId', String(data.empresaClienteId));
        if (data.competencia) formData.append('competencia', data.competencia);
        if (data.descricao) formData.append('descricao', data.descricao);
        formData.append('arquivo', data.arquivo);

        const response = await api.post('/portal-contador/documentos', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return unwrap<PortalContadorDocumento>(response);
    },

    async downloadDocumento(documento: PortalContadorDocumento): Promise<void> {
        const response = await api.get(`/portal-contador/documentos/${documento.id}/download`, {
            responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: documento.arquivoMimeType || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = documento.arquivoNomeOriginal || documento.nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    },

    async deleteDocumento(id: number): Promise<void> {
        await api.delete(`/portal-contador/documentos/${id}`);
    },

    async downloadDocumentosZip(filters: DocumentoFilters = {}): Promise<void> {
        const response = await api.get('/portal-contador/documentos/download/zip', {
            params: filters,
            responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'application/zip' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `documentos_portal_contador_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    },

    async getSolicitacoes(filters: DocumentoSolicitacaoFilters = {}): Promise<PortalContadorDocumentoSolicitacao[]> {
        const response = await api.get('/portal-contador/documento-solicitacoes', { params: filters });
        return unwrap<PortalContadorDocumentoSolicitacao[]>(response);
    },

    async criarSolicitacao(data: DocumentoSolicitacaoData): Promise<PortalContadorDocumentoSolicitacao> {
        const response = await api.post('/portal-contador/documento-solicitacoes', data);
        return unwrap<PortalContadorDocumentoSolicitacao>(response);
    },

    async atualizarStatusSolicitacao(id: number, status: DocumentoSolicitacaoStatus): Promise<PortalContadorDocumentoSolicitacao> {
        const response = await api.patch(`/portal-contador/documento-solicitacoes/${id}/status`, { status });
        return unwrap<PortalContadorDocumentoSolicitacao>(response);
    },

    async getObrigacoes(filters: ObrigacaoFilters = {}): Promise<PortalContadorObrigacao[]> {
        const response = await api.get('/portal-contador/obrigacoes', { params: filters });
        return unwrap<PortalContadorObrigacao[]>(response);
    },

    async criarObrigacao(data: ObrigacaoData): Promise<PortalContadorObrigacao> {
        const response = await api.post('/portal-contador/obrigacoes', data);
        return unwrap<PortalContadorObrigacao>(response);
    },

    async atualizarObrigacao(id: number, data: Partial<ObrigacaoData>): Promise<PortalContadorObrigacao> {
        const response = await api.put(`/portal-contador/obrigacoes/${id}`, data);
        return unwrap<PortalContadorObrigacao>(response);
    },

    async concluirObrigacao(id: number): Promise<PortalContadorObrigacao> {
        const response = await api.patch(`/portal-contador/obrigacoes/${id}/concluir`);
        return unwrap<PortalContadorObrigacao>(response);
    },

    async excluirObrigacao(id: number): Promise<void> {
        await api.delete(`/portal-contador/obrigacoes/${id}`);
    },

    async getReunioes(filters: ReuniaoFilters = {}): Promise<PortalContadorReuniao[]> {
        const response = await api.get('/portal-contador/reunioes', { params: filters });
        return unwrap<PortalContadorReuniao[]>(response);
    },

    async criarReuniao(data: ReuniaoData): Promise<PortalContadorReuniao> {
        const response = await api.post('/portal-contador/reunioes', data);
        return unwrap<PortalContadorReuniao>(response);
    },

    async atualizarReuniao(id: number, data: Partial<ReuniaoData>): Promise<PortalContadorReuniao> {
        const response = await api.put(`/portal-contador/reunioes/${id}`, data);
        return unwrap<PortalContadorReuniao>(response);
    },

    async cancelarReuniao(id: number): Promise<PortalContadorReuniao> {
        const response = await api.patch(`/portal-contador/reunioes/${id}/cancelar`);
        return unwrap<PortalContadorReuniao>(response);
    },

    async excluirReuniao(id: number): Promise<void> {
        await api.delete(`/portal-contador/reunioes/${id}`);
    }
};
