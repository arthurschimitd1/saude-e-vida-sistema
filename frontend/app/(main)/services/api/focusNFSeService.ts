// src/services/focusNFSeService.ts

import api from './baseApi';

export interface EmitirNFSePayload {
  cliente_id?: number;
  service_id?: number;
  venda_id?: number;
  servico_avulso?: boolean;
  empresa_id?: number;

  valor_total?: number;
  servico_descricao?: string;
  servico_nome?: string;
  item_lista_servico?: string;
  codigo_tributacao_municipio?: string;
  codigo_cnae?: string;
  codigo_indicador_operacao?: string;
  ibs_cbs_situacao_tributaria?: string;
  ibs_cbs_classificacao_tributaria?: string;
  aliquota?: number;
  data_emissao?: string;

  natureza_operacao?: number;
  iss_retido?: boolean;

  deducoes?: number;
  desconto?: number;
  desconto_incondicionado?: number;
  desconto_condicionado?: number;

  pis?: number;
  cofins?: number;
  inss?: number;
  irrf?: number;
  csll?: number;
  outras_retencoes?: number;
}

export interface CancelarNFSePayload {
  justificativa: string;
}

export interface ReenviarEmailNFSePayload {
  emails?: string[];
}

export interface NFSeResponse<T = any> {
  success: boolean;
  data?: T;
  focus?: any;
  message?: string;
  errors?: any[];
  details?: any;
}

export interface ListarNFSeParams {
  empresaId: number;
  status?: string;
}

export const focusNFSeService = {
  async emitir(
    payload: EmitirNFSePayload
  ): Promise<NFSeResponse> {
    const response = await api.post(
      '/focus-nfse/emitir',
      payload
    );

    return response.data;
  },

  async consultar(
    id: number
  ): Promise<NFSeResponse> {
    const response = await api.get(
      `/focus-nfse/${id}/consultar`
    );

    return response.data;
  },

  async buscarPorId(
    id: number
  ): Promise<NFSeResponse> {
    const response = await api.get(
      `/focus-nfse/${id}`
    );

    return response.data;
  },

  async listar({
    empresaId,
    status
  }: ListarNFSeParams): Promise<NFSeResponse> {
    const response = await api.get(
      '/focus-nfse',
      {
        params: {
          empresaId,
          ...(status ? { status } : {})
        }
      }
    );

    return response.data;
  },

  async cancelar(
    id: number,
    payload: CancelarNFSePayload
  ): Promise<NFSeResponse> {
    const response = await api.post(
      `/focus-nfse/${id}/cancelar`,
      payload
    );

    return response.data;
  },

  async reenviarEmail(
    id: number,
    payload: ReenviarEmailNFSePayload = {}
  ): Promise<NFSeResponse> {
    const response = await api.post(
      `/focus-nfse/${id}/email`,
      payload
    );

    return response.data;
  }
};
