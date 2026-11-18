import api from './baseApi';

export type FiscalImportAction = 'link' | 'create' | 'skip';

export interface FiscalImportProduct {
    id: number;
    name: string;
    code?: string | null;
    currentQuantity: number;
    unidade_medida?: string | null;
}

export interface FiscalImportItem {
    item_key: string;
    external_code?: string | null;
    description: string;
    quantity: number;
    unit_cost: number;
    total: number;
    commercial_unit?: string | null;
    ncm?: string | null;
    suggested_product_id?: number | null;
    suggestion_reason?: string | null;
}

export interface FiscalImportPreview {
    source_hash: string;
    access_key?: string | null;
    invoice_number?: string | null;
    supplier_document?: string | null;
    supplier_name?: string | null;
    already_imported: boolean;
    imported_at?: string | null;
    items: FiscalImportItem[];
    products: FiscalImportProduct[];
}

export interface FiscalImportDecision {
    item_key: string;
    action: FiscalImportAction;
    product_id?: number | null;
    new_name?: string;
}

const arquivoForm = (file: File, decisions?: FiscalImportDecision[]) => {
    const form = new FormData();
    form.append('arquivo', file);
    if (decisions) form.append('decisions', JSON.stringify(decisions));
    return form;
};

export const fiscalStockImportService = {
    async previewFile(file: File): Promise<FiscalImportPreview> {
        const response = await api.post('/products/importacao-nota/preview', arquivoForm(file), {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    async applyFile(file: File, decisions: FiscalImportDecision[]) {
        const response = await api.post(
            '/products/importacao-nota/apply',
            arquivoForm(file, decisions),
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    },

    async previewFocus(empresaId: number, chave: string): Promise<FiscalImportPreview> {
        const response = await api.get(
            `/focus-invoice/${empresaId}/nfe/${chave}/estoque-preview`
        );
        return response.data;
    },

    async applyFocus(empresaId: number, chave: string, decisions: FiscalImportDecision[]) {
        const response = await api.post(
            `/focus-invoice/${empresaId}/nfe/${chave}/estoque-aplicar`,
            { decisions }
        );
        return response.data;
    }
};
