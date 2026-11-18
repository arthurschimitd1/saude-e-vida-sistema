import api from './baseApi';

export type TipoIntegracaoFocus =
  | 'PROVISIONADA'
  | 'ASSOCIADA';

export type FocusStatus =
  | 'PENDING'
  | 'VALIDATING_CERTIFICATE'
  | 'CREATING_ON_FOCUS'
  | 'ACTIVE'
  | 'FAILED_CERTIFICATE_INVALID'
  | 'FAILED_CERTIFICATE_EXPIRED'
  | 'FAILED_CNPJ_MISMATCH';

export interface EmpresaFocusIntegracao {
  id: number;

  empresa_id: number;

  tipo_integracao: TipoIntegracaoFocus;

  focus_empresa_id?: number | null;

  focusnfe_token?: string | null;

  focusnfe_token_homologacao?: string | null;

  ambiente:
    | 'producao'
    | 'homologacao';

  status: FocusStatus;

  ativo: boolean;

  ultima_sincronizacao?: string | null;

  dados_emitente?: FocusEmpresa;
}

export interface ConfiguracaoFiscalFocus {
  id: number;
  empresa_id: number;

  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  email?: string | null;
  telefone?: string | null;

  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  regime_tributario?: number | string | null;

  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigo_municipio?: string | null;
  uf?: string | null;
  cep?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface VerificarConfiguracaoResponse {
  configurada: boolean;

  tipo: TipoIntegracaoFocus | null;

  configuracao: EmpresaFocusIntegracao | null;

  configuracaoFiscal: ConfiguracaoFiscalFocus | null;
}

export interface AssociarEmpresaPayload {
  cnpj?: string;
  
  token_producao?: string;

  token_homologacao?: string;

  ambiente?:
    | 'producao'
    | 'homologacao';
}

export interface FocusEmpresa {
  id?: number;

  nome: string;

  nome_fantasia?: string;

  cnpj?: string;

  cpf?: string;

  email?: string;

  telefone?: string;

  logradouro?: string;

  numero?: string;

  complemento?: string;

  bairro?: string;

  municipio?: string;

  uf?: string;

  cep?: string;

  inscricao_estadual?: string;

  inscricao_municipal?: string;

  regime_tributario?:
    | number
    | string;

  habilita_nfe?: boolean;

  habilita_nfse?: boolean;

  habilita_nfce?: boolean;

  habilita_manifestacao?: boolean;

  token_producao?: string;

  token_homologacao?: string;

  arquivo_certificado_base64?: string;

  senha_certificado?: string;

  [key: string]: any;
}

export const focusResellerService = {
  async verificarConfiguracao(
    empresaId: number
  ): Promise<VerificarConfiguracaoResponse> {
    const response =
      await api.get(
        `/focus-reseller/config/${empresaId}`
      );

    return response.data;
  },

  async listarEmpresas(
    params: Record<
      string,
      any
    > = {}
  ): Promise<FocusEmpresa[]> {
    const response =
      await api.get(
        '/focus-reseller/empresas',
        {
          params
        }
      );

    return response.data;
  },

  async detalharEmpresa(
    focusEmpresaId: number
  ): Promise<FocusEmpresa> {
    const response =
      await api.get(
        `/focus-reseller/empresas/focus/${focusEmpresaId}`
      );

    return response.data;
  },

  async criarEmpresa(
    empresaId: number,
    payload: FocusEmpresa
  ): Promise<EmpresaFocusIntegracao> {
    const response =
      await api.post(
        `/focus-reseller/empresas/${empresaId}`,
        payload
      );

    return response.data;
  },

  async associarEmpresa(
    empresaId: number,
    payload: AssociarEmpresaPayload
  ): Promise<EmpresaFocusIntegracao> {
    const response =
      await api.post(
        `/focus-reseller/empresas/${empresaId}/associar`,
        payload
      );

    return response.data;
  },

  async validarCriacao(
    payload: FocusEmpresa
  ): Promise<FocusEmpresa> {
    const response =
      await api.post(
        '/focus-reseller/empresas/validar',
        payload
      );

    return response.data;
  },

  async editarEmpresa(
    empresaId: number,
    payload: Partial<FocusEmpresa>
  ): Promise<EmpresaFocusIntegracao> {
    console.log(payload);
    const response =
      await api.put(
        `/focus-reseller/empresas/${empresaId}`,
        payload
      );

    return response.data;
  },

  async deletarEmpresa(
    empresaId: number
  ): Promise<{
    success: boolean;
  }> {
    const response =
      await api.delete(
        `/focus-reseller/empresas/${empresaId}`
      );

    return response.data;
  }
};
