import api from './baseApi';

export interface PlanoAssinaturaImportado {
    nome: string;
    diaVencimento?: string | null;
    periodicidade?: string | null;
    valor: number | string;
    tipo?: string | null;
    origemLinha?: number;
}

export interface AssinanteImportado {
    nome: string;
    plano: string;
    contratacao?: string | null;
    proximoVencimento?: string | null;
    status?: string | null;
    celular?: string | null;
    email?: string | null;
    planoOrigemLinha?: number | null;
    origemLinha?: number;
}

export interface ImportacaoAssinaturasPayload {
    planos: PlanoAssinaturaImportado[];
    assinantes: AssinanteImportado[];
}

export const assinaturaImportacaoService = {
    async listar() {
        const response = await api.get('/assinaturas/dom-ferraz/manaira');
        return response.data.data;
    },
    async preview(payload: ImportacaoAssinaturasPayload) {
        const response = await api.post('/assinaturas/dom-ferraz/manaira/preview', payload);
        return response.data.data;
    },
    async importar(payload: ImportacaoAssinaturasPayload) {
        const response = await api.post('/assinaturas/dom-ferraz/manaira/importar', payload);
        return response.data.data;
    },
};
