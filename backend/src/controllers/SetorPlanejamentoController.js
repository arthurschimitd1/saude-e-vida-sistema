import SetorPlanejamento from '../models/SetorPlanejamento.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

export const getSetores = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);
        const setores = await SetorPlanejamento.findAll({ where, order: [['created_at', 'ASC']] });
        res.json(setores);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const isGestorCheck = (user) =>
    user?.tipo === 'MASTER' || user?.tipo === 'EMPRESA'
    || (Array.isArray(user?.permissoes) && user.permissoes.includes('planejamento:todos'));

export const createSetor = async (req, res) => {
    try {
        if (!isGestorCheck(req.user)) return res.status(403).json({ error: 'Sem permissão para criar setores' });
        const userId = req.user?.id ?? null;
        const setor = await SetorPlanejamento.create({
            ...req.body,
            empresa_id: empresaParaGravar(req.user),
            criado_por: userId,
            // O criador é automaticamente membro
            membros: Array.isArray(req.body.membros)
                ? [...new Set([...(req.body.membros), userId].filter(Boolean))]
                : [userId].filter(Boolean),
        });
        res.status(201).json(setor);
    } catch (e) { res.status(400).json({ error: e.message }); }
};

export const updateSetor = async (req, res) => {
    try {
        if (!isGestorCheck(req.user)) return res.status(403).json({ error: 'Sem permissão para editar setores' });
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const setor = await SetorPlanejamento.findOne({ where });
        if (!setor) return res.status(404).json({ error: 'Setor não encontrado' });
        await setor.update(req.body);
        res.json(setor);
    } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteSetor = async (req, res) => {
    try {
        if (!isGestorCheck(req.user)) return res.status(403).json({ error: 'Sem permissão para excluir setores' });
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const setor = await SetorPlanejamento.findOne({ where });
        if (!setor) return res.status(404).json({ error: 'Setor não encontrado' });
        await setor.destroy();
        res.status(204).end();
    } catch (e) { res.status(500).json({ error: e.message }); }
};
