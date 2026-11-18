import api from './baseApi';

export type AsaasAmbiente = 'sandbox' | 'producao';

export interface AsaasConfig {
    configurado: boolean;
    ambiente: AsaasAmbiente;
    webhookConfigurado: boolean;
    webhookUrl?: string | null;
    ativo?: boolean;
}

export interface AsaasPayment {
    id: string;
    status: string;
    value: number;
    dueDate?: string | null;
    paymentDate?: string | null;
    invoiceUrl?: string | null;
    bankSlipUrl?: string | null;
}

export interface AsaasCheckout {
    public_id: string;
    asaas_checkout_id?: string | null;
    asaas_customer_id?: string | null;
    asaas_subscription_id?: string | null;
    checkout_url?: string | null;
    checkout_status: string;
    subscription_status?: string | null;
    cycle: string;
    value: number;
    next_due_date: string;
    end_date?: string | null;
    expires_at?: string | null;
    paid_at?: string | null;
    canceled_at?: string | null;
    last_error_code?: string | null;
}

export const asaasService = {
    async getConfig(): Promise<AsaasConfig> {
        const response = await api.get('/asaas/config');
        return response.data.data;
    },

    async saveConfig(data: { apiKey?: string; ambiente: AsaasAmbiente }): Promise<AsaasConfig> {
        const response = await api.put('/asaas/config', data);
        return response.data.data;
    },

    async createSubscription(recorrenciaId: number) {
        const response = await api.post(`/asaas/recorrencias/${recorrenciaId}/assinatura`);
        return response.data.data;
    },

    async createPaymentLink(recorrenciaId: number, dueDateLimitDays = 5) {
        const response = await api.post(`/asaas/recorrencias/${recorrenciaId}/link`, { dueDateLimitDays });
        return response.data.data;
    },

    async createCheckout(recorrenciaId: number, requestId?: string): Promise<{ checkout: AsaasCheckout; alreadyExists?: boolean }> {
        const response = await api.post(`/asaas/recorrencias/${recorrenciaId}/checkout`, {}, requestId ? { headers: { 'Idempotency-Key': requestId } } : undefined);
        return response.data.data;
    },

    async getCheckout(recorrenciaId: number): Promise<AsaasCheckout | null> {
        const response = await api.get(`/asaas/recorrencias/${recorrenciaId}/checkout`);
        return response.data.data || null;
    },

    async regenerateCheckout(recorrenciaId: number, requestId?: string): Promise<{ checkout: AsaasCheckout }> {
        const response = await api.post(`/asaas/recorrencias/${recorrenciaId}/checkout/regenerate`, {}, requestId ? { headers: { 'Idempotency-Key': requestId } } : undefined);
        return response.data.data;
    },

    async listPayments(recorrenciaId: number): Promise<AsaasPayment[]> {
        const response = await api.get(`/asaas/recorrencias/${recorrenciaId}/cobrancas`);
        return response.data.data || [];
    }
};
