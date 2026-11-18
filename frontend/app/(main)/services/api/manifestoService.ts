import api from './baseApi';

export interface ManifestoVeiculo {
    id: number;
    placa: string;
    renavam?: string;
    tara_kg: number;
    capacidade_kg?: number;
    tipo_rodado?: string;
    tipo_carroceria: string;
    uf_licenciamento: string;
    rntrc?: string;
    ativo?: boolean;
}

export interface ManifestoCondutor {
    id: number;
    nome: string;
    cpf: string;
    telefone?: string;
    cnh?: string;
    validade_cnh?: string;
    ativo?: boolean;
}

export interface ManifestoDocumento {
    id?: number;
    documento_origem_id?: number;
    tipo: 'NFE' | 'CTE';
    chave_acesso: string;
    numero?: string;
    serie?: string;
    emitente_nome?: string;
    destinatario_nome?: string;
    valor?: number;
    valor_total?: number;
    status?: string;
    data_emissao?: string;
}

export interface ManifestoMdfe {
    id: number;
    referencia: string;
    numero?: string;
    serie: string;
    chave_acesso?: string;
    ambiente: 'homologacao' | 'producao';
    status: string;
    motivo_retorno?: string;
    protocolo?: string;
    uf_carregamento?: string;
    municipio_carregamento?: string;
    uf_descarregamento?: string;
    municipio_descarregamento?: string;
    quantidade_documentos: number;
    valor_total_carga: number;
    peso_bruto: number;
    versao: number;
    updated_at: string;
    documentos?: ManifestoDocumento[];
    [key: string]: any;
}

export interface ManifestoDashboard {
    mdfe: Record<string, number>;
    eventosRecentes: any[];
}

const data = <T>(response: any): T => response.data?.data ?? response.data;

export const manifestoService = {
    dashboard: async () => data<ManifestoDashboard>(await api.get('/manifestos/dashboard')),
    listarDocumentos: async (busca = '') =>
        data<ManifestoDocumento[]>(
            await api.get('/manifestos/documentos-elegiveis', { params: { busca } })
        ),

    listarVeiculos: async () =>
        data<ManifestoVeiculo[]>(await api.get('/manifestos/veiculos')),
    salvarVeiculo: async (payload: Partial<ManifestoVeiculo>, id?: number) =>
        data<ManifestoVeiculo>(
            id
                ? await api.put(`/manifestos/veiculos/${id}`, payload)
                : await api.post('/manifestos/veiculos', payload)
        ),
    excluirVeiculo: async (id: number) => api.delete(`/manifestos/veiculos/${id}`),

    listarCondutores: async () =>
        data<ManifestoCondutor[]>(await api.get('/manifestos/condutores')),
    salvarCondutor: async (payload: Partial<ManifestoCondutor>, id?: number) =>
        data<ManifestoCondutor>(
            id
                ? await api.put(`/manifestos/condutores/${id}`, payload)
                : await api.post('/manifestos/condutores', payload)
        ),
    excluirCondutor: async (id: number) => api.delete(`/manifestos/condutores/${id}`),

    listarMdfe: async (params: Record<string, any> = {}) => {
        const response = await api.get('/manifestos/mdfe', { params });
        return response.data as {
            success: boolean;
            data: ManifestoMdfe[];
            total: number;
            pagina: number;
            limite: number;
        };
    },
    detalharMdfe: async (id: number) =>
        data<ManifestoMdfe>(await api.get(`/manifestos/mdfe/${id}`)),
    salvarMdfe: async (payload: Record<string, any>, id?: number) =>
        data<ManifestoMdfe>(
            id
                ? await api.put(`/manifestos/mdfe/${id}`, payload)
                : await api.post('/manifestos/mdfe', payload)
        ),
    arquivarMdfe: async (id: number) => api.delete(`/manifestos/mdfe/${id}`),
    validarMdfe: async (id: number) =>
        data<{ valido: boolean; erros: string[] }>(
            await api.post(`/manifestos/mdfe/${id}/validar`)
        ),
    emitirMdfe: async (id: number) =>
        data<ManifestoMdfe>(await api.post(`/manifestos/mdfe/${id}/emitir`)),
    consultarMdfe: async (id: number) =>
        data<ManifestoMdfe>(await api.post(`/manifestos/mdfe/${id}/consultar`)),
    cancelarMdfe: async (id: number, justificativa: string) =>
        data<ManifestoMdfe>(
            await api.post(`/manifestos/mdfe/${id}/cancelar`, { justificativa })
        ),
    encerrarMdfe: async (
        id: number,
        payload: { data: string; sigla_uf: string; nome_municipio: string }
    ) => data<ManifestoMdfe>(await api.post(`/manifestos/mdfe/${id}/encerrar`, payload))
};
