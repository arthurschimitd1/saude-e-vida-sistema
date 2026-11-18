import KanbanColuna from '../models/KanbanColuna.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

export const getColunas = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);
        const colunas = await KanbanColuna.findAll({ where, order: [['ordem', 'ASC']] });
        res.json(colunas);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createColuna = async (req, res) => {
    try {
        const coluna = await KanbanColuna.create({
            ...req.body,
            empresa_id: empresaParaGravar(req.user),
        });
        res.status(201).json(coluna);
    } catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateColuna = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const coluna = await KanbanColuna.findOne({ where });
        if (!coluna) return res.status(404).json({ error: 'Coluna não encontrada' });
        await coluna.update(req.body);
        res.json(coluna);
    } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteColuna = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const coluna = await KanbanColuna.findOne({ where });
        if (!coluna) return res.status(404).json({ error: 'Coluna não encontrada' });
        await coluna.destroy();
        res.status(204).end();
    } catch (e) { res.status(500).json({ error: e.message }); }
};
