import api from './baseApi';

interface StockMovement {
  id: number;
  productId: number;
  quantity: number;
  type: 'entry' | 'exit';
  date: string;
  reason?: string;
}

export const stockService = {
  async registerMovement(movementData: Omit<StockMovement, 'id' | 'date'>): Promise<StockMovement> {
    const response = await api.post('/stock/movements', movementData);
    return response.data;
  },

  async getMovements(productId?: number): Promise<StockMovement[]> {
    const params = productId ? { productId } : {};
    const response = await api.get('/stock/movements', { params });
    return response.data;
  },

  async getInventory(): Promise<{productId: number, quantity: number}[]> {
    const response = await api.get('/stock/inventory');
    return response.data;
  },

  async adjustStock(productId: number, newQuantity: number, reason: string): Promise<void> {
    await api.post('/stock/adjustment', { productId, newQuantity, reason });
  }
};