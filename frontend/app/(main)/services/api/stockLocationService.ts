import api from './baseApi';

export interface StockLocation { id:number; nome:string; tipo:string; endereco?:string|null; principal:boolean; ativo:boolean }
export interface ProductLocationBalance {
  produto_id:number; produto_nome:string; produto_codigo?:string|null; unidade_medida?:string|null;
  saldos:Array<{unidade_id:number; quantidade:number}>; total:number;
}

export const stockLocationService = {
  list: async (): Promise<StockLocation[]> => (await api.get('/stock-locations')).data,
  balances: async (): Promise<ProductLocationBalance[]> => (await api.get('/stock-locations/saldos')).data,
  create: async (payload:{nome:string; tipo:string; endereco?:string}) => (await api.post('/stock-locations', payload)).data,
  update: async (id:number, payload:Partial<StockLocation>) => (await api.put(`/stock-locations/${id}`, payload)).data,
  transfer: async (payload:{produto_id:number; unidade_origem_id:number; unidade_destino_id:number; quantidade:number; observacao?:string}) =>
    (await api.post('/stock-locations/transferencias', payload)).data
};
