import movimentoService from '../services/EstoqueRoupaMovimentoService.js';
import inventarioService from '../services/EstoqueRoupaInventarioService.js';

export const listarMovimentos = async (req, res) => {
  try {
    res.json(await movimentoService.listar(req.query, req.user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const listarInventarios = async (req, res) => {
  try {
    res.json(await inventarioService.listar(req.query, req.user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const aplicarInventario = async (req, res) => {
  try {
    const itens = req.body?.itens ?? req.body;
    res.status(201).json(await inventarioService.aplicarLote(itens, req.user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
