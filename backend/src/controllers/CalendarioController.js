import calendarioService from '../services/CalendarioService.js';

export const getEventos = async (req, res) => {
    try {
        const filters = {
            mes: req.query.mes,
            ano: req.query.ano,
            responsavel: req.query.responsavel
        };
        const lista = await calendarioService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getProximos = async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 3;
        const lista = await calendarioService.getProximos(req.user, dias);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createEvento = async (req, res) => {
    try {
        const evento = await calendarioService.create(req.body, req.user);
        res.status(201).json(evento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateEvento = async (req, res) => {
    try {
        const evento = await calendarioService.update(req.params.id, req.body, req.user);
        res.json(evento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteEvento = async (req, res) => {
    try {
        await calendarioService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
