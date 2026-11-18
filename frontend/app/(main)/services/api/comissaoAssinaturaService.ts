import api from './baseApi';

export interface DetalheComissaoAssinatura { id: number; realizado_em: string; cliente_nome: string; plano_nome: string; servico_nome: string; minutos: number; tipo_atendimento: 'ASSINATURA'; comissao: number; }
export interface ProfissionalComissaoAssinatura { profissional_id: number; profissional: string; atendimentos: number; minutos: number; faixa: string | null; peso: number; participacao: number; comissao: number; detalhes: DetalheComissaoAssinatura[]; }
export interface DashboardComissaoAssinatura { competencia: string; status: 'EM_ANDAMENTO' | 'FECHADA' | 'PAGA'; receita_assinaturas: number; valor_barbearia: number; valor_pote: number; assinantes_ativos: number; atendimentos: number; minutos: number; profissionais: ProfissionalComissaoAssinatura[]; }

export const comissaoAssinaturaService = {
  dashboard: async (competencia: string) => (await api.get<DashboardComissaoAssinatura>(`/comissao-assinatura/competencias/${competencia}`)).data,
  calcular: async (competencia: string) => (await api.post<DashboardComissaoAssinatura>(`/comissao-assinatura/competencias/${competencia}/calcular`)).data,
  fechar: async (competencia: string) => (await api.post<DashboardComissaoAssinatura>(`/comissao-assinatura/competencias/${competencia}/fechar`)).data,
  pagar: async (competencia: string) => (await api.post<DashboardComissaoAssinatura>(`/comissao-assinatura/competencias/${competencia}/pagar`)).data,
};
