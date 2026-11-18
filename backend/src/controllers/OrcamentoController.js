import orcamentoService from '../services/OrcamentoService.js';

export const createOrcamento = async (req, res) => {
    try {
        const orcamento = await orcamentoService.create(req.body, req.user);
        res.status(201).json(orcamento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateOrcamento = async (req, res) => {
    try {
        const orcamento = await orcamentoService.update(req.params.id, req.body, req.user);
        res.json(orcamento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getOrcamentos = async (req, res) => {
    try {
        const filters = {
            cliente_id: req.query.cliente_id,
            nome_cliente: req.query.nome_cliente,
            dataInicio: req.query.dataInicio,
            dataFim: req.query.dataFim
        };
        const lista = await orcamentoService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getOrcamentoById = async (req, res) => {
    try {
        const orcamento = await orcamentoService.getById(req.params.id, req.user);
        res.json(orcamento);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

export const deleteOrcamento = async (req, res) => {
    try {
        await orcamentoService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
