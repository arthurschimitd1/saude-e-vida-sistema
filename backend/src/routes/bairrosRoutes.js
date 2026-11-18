import { Router } from 'express';
import auth from '../middlewares/auth.js';
import sequelize from '../config/database.js';
import { empresaParaGravar, aplicarEmpresaScope } from '../utils/empresaScope.js';

(async () => {
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS bairros (
                id          SERIAL PRIMARY KEY,
                nome        VARCHAR(200) NOT NULL,
                taxa        DECIMAL(10,2) NOT NULL DEFAULT 0,
                empresa_id  INTEGER,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    } catch (e) {
        console.error('[bairros] erro no setup:', e.message);
    }
})();

const router = Router();

router.get('/', auth, async (req, res) => {
    try {
        const where = ['1=1'];
        const replacements = {};
        const empId = empresaParaGravar(req.user);
        if (empId) { where.push('empresa_id = :empId'); replacements.empId = empId; }
        const [rows] = await sequelize.query(
            `SELECT * FROM bairros WHERE ${where.join(' AND ')} ORDER BY nome ASC`,
            { replacements }
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
    const { nome, taxa } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    try {
        const empId = empresaParaGravar(req.user);
        const [[row]] = await sequelize.query(
            `INSERT INTO bairros (nome, taxa, empresa_id) VALUES (:nome, :taxa, :empId) RETURNING *`,
            { replacements: { nome, taxa: Number(taxa) || 0, empId } }
        );
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
    const { nome, taxa } = req.body;
    try {
        const [[row]] = await sequelize.query(
            `UPDATE bairros SET nome = :nome, taxa = :taxa WHERE id = :id RETURNING *`,
            { replacements: { id: req.params.id, nome, taxa: Number(taxa) || 0 } }
        );
        if (!row) return res.status(404).json({ error: 'Bairro não encontrado' });
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        await sequelize.query(`DELETE FROM bairros WHERE id = :id`, { replacements: { id: req.params.id } });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
