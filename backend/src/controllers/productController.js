import productService from '../services/ProductService.js';
import entradaInsumoSemNotaService from '../services/EntradaInsumoSemNotaService.js';

export const createProduct = async (req, res) => {
  try {
    console.log('Dados recebidos:', req.body);
    const product = await productService.createProduct(req.body, req.user);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const filters = {
      name: req.query.name,
      category: req.query.category,
      stockStatus: req.query.stockStatus,
      is_materia_prima: req.query.is_materia_prima,
      fornecedor_id: req.query.fornecedor_id,
    };
    
    const products = await productService.getProducts(filters, req.user);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductCostHistory = async (req, res) => {
  try {
    const historico = await entradaInsumoSemNotaService.listarPorProduto(req.params.id, req.user);
    res.json(historico);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body, req.user);
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id, req.user);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
