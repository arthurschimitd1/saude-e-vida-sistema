import api from '@/app/(main)/services/api/baseApi';
import type { Contexto, Detalhes, Filtros, TipoDetalhe, Visao } from './types';

export const centralApi = {
  contexto: (signal: AbortSignal) => api.get<Contexto>('/central-gestao/contexto', { signal }),
  visao: (params: Filtros, signal: AbortSignal) => api.get<Visao>('/central-gestao/visao-geral', { params, signal }),
  detalhes: (params: Filtros & { tipo: TipoDetalhe; pagina: number; tamanho: number }, signal: AbortSignal) => api.get<Detalhes>('/central-gestao/detalhes', { params, signal }),
};

export const chaveSessao = () => typeof window === 'undefined' ? '' : `${localStorage.getItem('token') ?? ''}|${localStorage.getItem('empresa_selecionada') ?? ''}|${localStorage.getItem('user') ?? ''}`;
export const mensagemErro = (error: unknown) => {
  const message = (error as { message?: string })?.message;
  return !message || message === 'Network Error' ? 'Não foi possível conectar ao servidor. Tente novamente.' : message;
};

