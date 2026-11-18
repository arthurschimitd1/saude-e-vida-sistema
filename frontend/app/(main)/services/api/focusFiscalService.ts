// src/services/focusFiscalService.ts

import api from './baseApi';

export interface EmitirNotaPayload {
  vendaId: number;
  itemIds?: number[];
  destinatarioIsentoIE?: boolean;
}

export interface CancelarNotaPayload {
  justificativa: string;
}

export interface AjusteFiscalItem {
  index: number;
  cfop?: string;
  codigo_ncm?: string;
  cest?: string;
  icms_origem?: string;
  icms_situacao_tributaria?: string;
  pis_situacao_tributaria?: string;
  cofins_situacao_tributaria?: string;
}

export interface AjusteDestinatario {
  usar_dados_cliente?: boolean;
  isento_inscricao_estadual?: boolean;
  nome?: string;
  cpf?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  rua?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  municipio?: string;
  estado?: string;
  uf?: string;
}

export interface AjustePagamento {
  valor_recebido?: string | number;
  troco?: string | number;
}

export interface RefazerNotaPayload {
  ajustes: {
    items: AjusteFiscalItem[];
    data_emissao?: string;
    destinatario?: AjusteDestinatario;
    pagamento?: AjustePagamento;
  };
}

export interface FiscalResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface NotaFiscalRegistro {
  id: number;
  empresa_id: number;
  venda_id: number;
  tipo: 'NFE' | 'NFCE';
  status: string;
  numero?: string | null;
  serie?: string | null;
  chave_acesso?: string | null;
  referencia_externa?: string | null;
  mensagem_retorno?: string | null;
  codigo_retorno?: string | number | null;
  payload_enviado?: {
    valor_total?: number | string | null;
    troco?: number | string | null;
    formas_pagamento?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  } | null;
  resposta_provedor?: unknown;
}

export interface ResultadoEmissaoNFCe {
  success: boolean;
  data: {
    status?: string;
    numero?: string | null;
    serie?: string | null;
    chave_nfe?: string | null;
    [key: string]: unknown;
  };
  registro: NotaFiscalRegistro;
}

type TipoNota = 'nfe' | 'nfce';
type FormatoPdf = 'a4' | '58x297';

function obterNomeArquivo(
  contentDisposition: unknown,
  nomePadrao: string
) {
  const header =
    typeof contentDisposition === 'string'
      ? contentDisposition
      : '';

  const filenameMatch = header.match(
    /filename="?([^";]+)"?/
  );

  return filenameMatch?.[1] || nomePadrao;
}

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = nomeArquivo;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

async function baixarArquivo(
  tipo: TipoNota,
  extensao: 'xml' | 'pdf',
  id: number,
  numero?: string,
  formato?: FormatoPdf
) {
  const response = await api.get<Blob>(
    `/focus-${tipo}/${id}/${extensao}`,
    {
      responseType: 'blob',
      params:
        extensao === 'pdf' && formato
          ? { formato }
          : undefined
    }
  );

  const nomeArquivo = obterNomeArquivo(
    response.headers['content-disposition'],
    `${tipo}-${numero ?? id}.${extensao}`
  );

  baixarBlob(response.data, nomeArquivo);
}

async function abrirDanfeNFCe(id: number) {
  const novaAba = window.open('', '_blank');

  try {
    const response = await api.get<Blob>(
      `/focus-nfce/${id}/danfe`,
      {
        responseType: 'blob'
      }
    );

    const blob = new Blob([response.data], {
      type: 'text/html;charset=utf-8'
    });

    const url = window.URL.createObjectURL(blob);

    if (novaAba) {
      novaAba.location.href = url;
    } else {
      window.open(url, '_blank');
    }

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60000);
  } catch (error) {
    novaAba?.close();
    throw error;
  }
}

async function abrirImpressaoDanfeNFCe(id: number) {
  const janelaImpressao = window.open('', '_blank');

  if (!janelaImpressao) {
    throw new Error(
      'Não foi possível abrir a impressão. Verifique o bloqueador de pop-ups.'
    );
  }

  try {
    const response = await api.get<Blob>(
      `/focus-nfce/${id}/danfe`,
      {
        responseType: 'blob'
      }
    );

    const html = await response.data.text();

    janelaImpressao.document.open();
    janelaImpressao.document.write(html);
    janelaImpressao.document.close();

    setTimeout(() => {
      janelaImpressao.focus();
      janelaImpressao.print();
    }, 1000);
  } catch (error) {
    janelaImpressao.close();
    throw error;
  }
}

export const focusFiscalService = {
  // ============================
  // NFE
  // ============================

  async emitirNFe(
    payload: EmitirNotaPayload
  ): Promise<FiscalResponse> {
    const response = await api.post<FiscalResponse>(
      '/focus-nfe/emitir',
      payload
    );

    return response.data;
  },

  async consultarNFe(
    id: number
  ): Promise<FiscalResponse> {
    const response = await api.get<FiscalResponse>(
      `/focus-nfe/${id}/consultar`
    );

    return response.data;
  },

  async baixarXmlNFe(id: number, numero?: string) {
    return baixarArquivo('nfe', 'xml', id, numero);
  },

  async baixarPdfNFe(id: number, numero?: string) {
    return baixarArquivo('nfe', 'pdf', id, numero, 'a4');
  },

  async cancelarNFe(
    id: number,
    payload: CancelarNotaPayload
  ): Promise<FiscalResponse> {
    const response = await api.post<FiscalResponse>(
      `/focus-nfe/${id}/cancelar`,
      payload
    );

    return response.data;
  },

  async refazerNFe(
    id: number,
    payload: RefazerNotaPayload
  ): Promise<FiscalResponse> {
    const response = await api.post<FiscalResponse>(
      `/focus-nfe/${id}/refazer`,
      payload
    );

    return response.data;
  },

  async listarNFe(
    empresaId: number
  ): Promise<FiscalResponse> {
    const response = await api.get<FiscalResponse>(
      '/focus-nfe',
      {
        params: { empresaId }
      }
    );

    return response.data;
  },

  async buscarNFe(
    id: number
  ): Promise<FiscalResponse> {
    return this.consultarNFe(id);
  },

  async buscarNFePorVenda(
    vendaId: number
  ): Promise<FiscalResponse> {
    const response = await api.get<FiscalResponse>(
      `/focus-nfe/venda/${vendaId}`
    );

    return response.data;
  },

  // ============================
  // NFCE
  // ============================

  async emitirNFCe(
    payload: EmitirNotaPayload
  ): Promise<FiscalResponse<ResultadoEmissaoNFCe>> {
    const response =
      await api.post<FiscalResponse<ResultadoEmissaoNFCe>>(
        '/focus-nfce/emitir',
        payload
      );

    return response.data;
  },

  async consultarNFCe(
    id: number
  ): Promise<FiscalResponse> {
    const response = await api.get<FiscalResponse>(
      `/focus-nfce/${id}`
    );

    return response.data;
  },

  async baixarXmlNFCe(id: number, numero?: string) {
    return baixarArquivo('nfce', 'xml', id, numero);
  },

  async baixarPdfNFCe(
    id: number,
    numero?: string,
    formato: FormatoPdf = 'a4'
  ) {
    return baixarArquivo(
      'nfce',
      'pdf',
      id,
      numero,
      formato
    );
  },

  async visualizarDanfeNFCe(id: number) {
    return abrirDanfeNFCe(id);
  },

  async imprimirDanfeNFCe(id: number) {
    return abrirImpressaoDanfeNFCe(id);
  },

  async cancelarNFCe(
    id: number,
    payload: CancelarNotaPayload
  ): Promise<FiscalResponse> {
    const response = await api.post<FiscalResponse>(
      `/focus-nfce/${id}/cancelar`,
      payload
    );

    return response.data;
  },

  async refazerNFCe(
    id: number,
    payload: RefazerNotaPayload
  ): Promise<FiscalResponse> {
    const response = await api.post<FiscalResponse>(
      `/focus-nfce/${id}/refazer`,
      payload
    );

    return response.data;
  },

  async listarNFCe(
    empresaId: number
  ): Promise<FiscalResponse<NotaFiscalRegistro[]>> {
    const response = await api.get<FiscalResponse<NotaFiscalRegistro[]>>(
      '/focus-nfce',
      {
        params: { empresaId }
      }
    );

    return response.data;
  },

  async buscarNFCe(
    id: number
  ): Promise<FiscalResponse> {
    return this.consultarNFCe(id);
  },

  async buscarNFCePorVenda(
    vendaId: number
  ): Promise<FiscalResponse> {
    const response = await api.get<FiscalResponse>(
      `/focus-nfce/venda/${vendaId}`
    );

    return response.data;
  }
};
