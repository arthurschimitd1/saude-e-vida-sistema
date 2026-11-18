import { Op } from 'sequelize';
import Service from '../models/Service.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

export const listar = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);

        // Fallback para empresa_id query param (MASTER sem override)
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }

        if (req.query.search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${req.query.search}%` } },
                { description: { [Op.iLike]: `%${req.query.search}%` } },
            ];
        }
        if (req.query.category) {
            where.category = req.query.category;
        }
        if (req.query.ativo !== undefined) {
            where.ativo = req.query.ativo === 'true';
        }

        const services = await Service.findAll({ where, order: [['name', 'ASC']] });
        res.json(services);
    } catch (err) {
        console.error('Erro ao listar serviços:', err);
        res.status(500).json({ error: err.message });
    }
};

export const criar = async (req, res) => {
    try {
        const empresa_id = empresaParaGravar(req.user) ?? req.body.empresa_id;
        const service = await Service.create({ ...req.body, empresa_id });
        res.status(201).json(service);
    } catch (err) {
        console.error('Erro ao criar serviço:', err);
        res.status(400).json({ error: err.message });
    }
};

export const getById = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const service = await Service.findOne({ where });
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const atualizar = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const service = await Service.findOne({ where });
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
        await service.update(req.body);
        res.json(service);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const deletar = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const service = await Service.findOne({ where });
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
        await service.destroy();
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const toggleAtivo = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        const service = await Service.findOne({ where });
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
        await service.update({ ativo: !service.ativo });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
