import inventarioService from '../services/InventarioService.js';

export const createInventario = async (req, res) => {
  try {
    const registro = await inventarioService.create(req.body, req.user);
    res.status(201).json(registro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const aplicarLoteInventario = async (req, res) => {
  try {
    const itens = req.body.itens || req.body;
    const resultado = await inventarioService.aplicarLote(itens, req.user);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getInventarios = async (req, res) => {
  try {
    const filters = {
      produto_id: req.query.produto_id,
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim
    };
    const lista = await inventarioService.getAll(filters, req.user);
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getInventarioById = async (req, res) => {
  try {
    const registro = await inventarioService.getById(req.params.id, req.user);
    res.json(registro);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const deleteInventario = async (req, res) => {
  try {
    await inventarioService.delete(req.params.id, req.user);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
