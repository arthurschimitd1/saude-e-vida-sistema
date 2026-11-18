import tarefaService from '../services/TarefaService.js';

export const getTarefas = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            prioridade: req.query.prioridade,
            responsavel: req.query.responsavel,
            setor_id: req.query.setor_id,
        };
        const lista = await tarefaService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTarefaById = async (req, res) => {
    try {
        const tarefa = await tarefaService.getById(req.params.id, req.user);
        res.json(tarefa);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

export const createTarefa = async (req, res) => {
    try {
        const tarefa = await tarefaService.create(req.body, req.user);
        res.status(201).json(tarefa);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateTarefa = async (req, res) => {
    try {
        const tarefa = await tarefaService.update(req.params.id, req.body, req.user);
        res.json(tarefa);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteTarefa = async (req, res) => {
    try {
        await tarefaService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
