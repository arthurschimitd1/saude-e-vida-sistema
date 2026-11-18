import ProductCategory from '../models/ProductCategory.js';

const getEmpresaId = (user) => user?.empresa_id ?? user?.empresaId ?? null;

export const listar = async (req, res) => {
    try {
        const empresa_id = getEmpresaId(req.user);
        const where = empresa_id ? { empresa_id } : {};
        const categorias = await ProductCategory.findAll({ where, order: [['nome', 'ASC']] });
        res.json(categorias);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const criar = async (req, res) => {
    try {
        const empresa_id = getEmpresaId(req.user);
        const { nome } = req.body;
        if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
        const categoria = await ProductCategory.create({ nome: nome.trim(), empresa_id });
        res.status(201).json(categoria);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const atualizar = async (req, res) => {
    try {
        const empresa_id = getEmpresaId(req.user);
        const cat = await ProductCategory.findOne({ where: { id: req.params.id, empresa_id } });
        if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
        await cat.update({ nome: req.body.nome?.trim() });
        res.json(cat);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const deletar = async (req, res) => {
    try {
        const empresa_id = getEmpresaId(req.user);
        const cat = await ProductCategory.findOne({ where: { id: req.params.id, empresa_id } });
        if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
        await cat.destroy();
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
