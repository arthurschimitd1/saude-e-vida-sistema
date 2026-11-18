import marketingService from '../services/MarketingService.js';

export const getProjetos = async (req, res) => {
    try {
        const lista = await marketingService.getAll({ status: req.query.status }, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getProjetoById = async (req, res) => {
    try {
        const projeto = await marketingService.getById(req.params.id, req.user);
        res.json(projeto);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

export const createProjeto = async (req, res) => {
    try {
        const projeto = await marketingService.create(req.body, req.user);
        res.status(201).json(projeto);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateProjeto = async (req, res) => {
    try {
        const projeto = await marketingService.update(req.params.id, req.body, req.user);
        res.json(projeto);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteProjeto = async (req, res) => {
    try {
        await marketingService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
