// src/services/focusInvoiceService.ts

import api from './baseApi';

export type TipoInvoice =
  | 'nfe'
  | 'nfse';

export interface InvoiceFilters {
  type: TipoInvoice;
  data_inicio?: string;
  data_fim?: string;
}

export interface ManifestacaoPayload {
  tipo:
    | 'CIENCIA'
    | 'CONFIRMACAO'
    | 'DESCONHECIMENTO'
    | 'OPERACAO_NAO_REALIZADA';
  justificativa?: string;
}

export interface InvoiceListResponse {
  success: boolean;
  data: any[];
  meta?: {
    totalCount: number;
  };
}

export const focusInvoiceService = {
  /**
   * Lista NF-e ou NFS-e
   * GET /focus-invoice/:empresaId?type=nfe|nfse
   */
  async getInvoices(
    empresaId: number,
    filters: InvoiceFilters
  ): Promise<InvoiceListResponse> {
    const response = await api.get(
      `/focus-invoice/${empresaId}`,
      {
        params: filters
      }
    );

    return response.data;
  },

  /**
   * Manifestação do destinatário NF-e
   */
  async manifestarNFe(
    empresaId: number,
    chave: string,
    payload: ManifestacaoPayload
  ): Promise<any> {
    const response = await api.post(
      `/focus-invoice/${empresaId}/nfe/${chave}/manifestacao`,
      payload
    );

    return response.data;
  },

  /**
   * Download XML NF-e
   */
  async downloadNFeXML(
    empresaId: number,
    chave: string
  ): Promise<Blob> {
    const response = await api.get(
      `/focus-invoice/${empresaId}/nfe/${chave}/xml`,
      {
        responseType: 'blob'
      }
    );

    return response.data;
  },

  /**
   * Download XML NFS-e
   */
  async downloadNFSeXML(
    empresaId: number,
    chave: string
  ): Promise<Blob> {
    const response = await api.get(
      `/focus-invoice/${empresaId}/nfse/${chave}/xml`,
      {
        responseType: 'blob'
      }
    );

    return response.data;
  },

  /**
   * Download PDF NF-e
   */
  async downloadNFePDF(
    empresaId: number,
    chave: string
  ): Promise<Blob> {
    const response = await api.get(
      `/focus-invoice/${empresaId}/nfe/${chave}/pdf`,
      {
        responseType: 'blob'
      }
    );

    return response.data;
  },

  /**
   * Download PDF NFS-e
   */
  async downloadNFSePDF(
    empresaId: number,
    chave: string
  ): Promise<Blob> {
    const response = await api.get(
      `/focus-invoice/${empresaId}/nfse/${chave}/pdf`,
      {
        responseType: 'blob'
      }
    );

    return response.data;
  }
};
