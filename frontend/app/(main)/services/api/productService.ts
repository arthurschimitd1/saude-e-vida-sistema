import api from './baseApi';

interface Product {
  id: number;
  name: string;
  code?: string | null;
  lote?: string | null;
  fabricante?: string | null;
  fornecedor_id?: number | null;
  category?: string;
  price: number;
  minQuantity: number;
  currentQuantity: number;
  unidade_medida?: string | null;
  unidade_comercial?: string | null;
  unidade_tributavel?: string | null;
  [key: string]: unknown;
}

interface ProductFilters {
  name?: string;
  category?: string;
  stockStatus?: 'below' | 'ok';
  fornecedor_id?: number;
}

export const productService = {
  async create(productData: Omit<Product, 'id'>): Promise<Product> {
    const response = await api.post('/products', productData);
    return response.data;
  },

  async getAll(filters: ProductFilters = {}): Promise<Product[]> {
    const response = await api.get('/products', { params: filters });
    return response.data;
  },

  async update(id: number, productData: Partial<Product>): Promise<Product> {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  }
};
