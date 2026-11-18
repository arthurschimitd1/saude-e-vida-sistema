import vendaService from '../services/VendaService.js';

export const createVenda = async (req, res) => {
    try {
        const venda = await vendaService.create(req.body, req.user);
        res.status(201).json(venda);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getVendas = async (req, res) => {
    try {
        const filters = {
            cliente_id: req.query.cliente_id,
            funcionario_id: req.query.funcionario_id,
            dataInicio: req.query.dataInicio,
            dataFim: req.query.dataFim
        };
        const vendas = await vendaService.getAll(filters, req.user);
        res.json(vendas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getVendaById = async (req, res) => {
    try {
        const venda = await vendaService.getById(req.params.id, req.user);
        res.json(venda);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

export const deleteVenda = async (req, res) => {
    try {
        await vendaService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateVenda = async (req, res) => {
    try {
        const venda = await vendaService.update(req.params.id, req.body, req.user);
        res.json(venda);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};