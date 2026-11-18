import { Router } from 'express'; 
import auth from '../middlewares/auth.js';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import { calcularResumoTurno } from '../utils/resumoTurno.js';

const router = Router();

// Garante que a tabela existe
async function ensureTable() {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS turnos_caixa (
            id              SERIAL PRIMARY KEY,
            empresa_id      INTEGER,
            func_abertura_id   INTEGER,
            func_abertura_nome VARCHAR(200) NOT NULL,
            valor_abertura  DECIMAL(10,2) NOT NULL DEFAULT 0,
            data_abertura   TIMESTAMP NOT NULL DEFAULT NOW(),
            func_fechamento_id   INTEGER,
            func_fechamento_nome VARCHAR(200),
            valor_fechamento DECIMAL(10,2),
            data_fechamento  TIMESTAMP,
            status          VARCHAR(10) NOT NULL DEFAULT 'aberto',
            created_at      TIMESTAMP DEFAULT NOW()
        )
    `);
    // Garante colunas extras na tabela de vendas
    try {
        await sequelize.query(`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS pagamentos JSONB`);
        await sequelize.query(`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS turno_id INTEGER`);
    } catch (e) { /* ignora se tabela ainda não existe */ }
}
ensureTable().catch(console.error);

// GET /turnos-caixa — lista todos da empresa (ou filtra por status)
router.get('/', auth, async (req, res) => {
    try {
        const empresaId = empresaParaGravar(req.user);
        if (!empresaId) return res.status(400).json({ error: 'Selecione uma empresa para consultar o caixa' });
        const where = ['1=1'];
        const replacements = { empresaId };
        where.push('empresa_id = :empresaId');

        if (req.query.status) {
            where.push('status = :status');
            replacements.status = req.query.status;
        }

        const rows = await sequelize.query(
            `SELECT * FROM turnos_caixa WHERE ${where.join(' AND ')} ORDER BY data_abertura DESC`,
            { replacements, type: sequelize.QueryTypes.SELECT }
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /turnos-caixa — abre um novo turno
router.post('/', auth, async (req, res) => {
    const { func_abertura_id, func_abertura_nome, valor_abertura, empresa_id } = req.body;
    if (!func_abertura_nome) return res.status(400).json({ error: 'func_abertura_nome é obrigatório' });

    const empId = empresaParaGravar(req.user);
    if (!empId) return res.status(400).json({ error: 'Selecione uma empresa para abrir o caixa' });

    try {
        // Verifica se o funcionário já tem caixa aberto nessa empresa
        const jaAberto = await sequelize.query(
            `SELECT id FROM turnos_caixa WHERE func_abertura_id = :funcId AND empresa_id = :empId AND status = 'aberto'`,
            { replacements: { funcId: func_abertura_id, empId }, type: sequelize.QueryTypes.SELECT }
        );
        if (jaAberto.length > 0) {
            return res.status(400).json({ error: `${func_abertura_nome} já tem um caixa aberto` });
        }

        const [result] = await sequelize.query(
            `INSERT INTO turnos_caixa (empresa_id, func_abertura_id, func_abertura_nome, valor_abertura, data_abertura, status)
             VALUES (:empId, :funcId, :funcNome, :valor, NOW(), 'aberto')
             RETURNING *`,
            {
                replacements: { empId, funcId: func_abertura_id ?? null, funcNome: func_abertura_nome, valor: valor_abertura ?? 0 },
                type: sequelize.QueryTypes.INSERT
            }
        );
        res.status(201).json(result[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /turnos-caixa/:id/fechar — fecha um turno
router.put('/:id/fechar', auth, async (req, res) => {
    const { func_fechamento_id, func_fechamento_nome, valor_fechamento } = req.body;
    if (valor_fechamento == null) return res.status(400).json({ error: 'valor_fechamento é obrigatório' });
    const empresaId = empresaParaGravar(req.user);
    if (!empresaId) return res.status(400).json({ error: 'Selecione uma empresa para fechar o caixa' });

    try {
        const rows = await sequelize.query(
            `UPDATE turnos_caixa
             SET status = 'fechado',
                 func_fechamento_id   = :funcId,
                 func_fechamento_nome = :funcNome,
                 valor_fechamento     = :valor,
                 data_fechamento      = NOW()
             WHERE id = :id AND empresa_id = :empresaId AND status = 'aberto'
             RETURNING *`,
            {
                replacements: {
                    id: req.params.id,
                    empresaId,
                    funcId: func_fechamento_id ?? null,
                    funcNome: func_fechamento_nome ?? null,
                    valor: valor_fechamento
                },
                type: sequelize.QueryTypes.UPDATE
            }
        );
        if (!rows[0]?.length) return res.status(404).json({ error: 'Turno não encontrado ou já fechado' });
        res.json(rows[0][0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /turnos-caixa/:id/movimentos — detalhes de um turno com vendas e resumo
router.get('/:id/movimentos', auth, async (req, res) => {
    try {
        const empresaId = empresaParaGravar(req.user);
        if (!empresaId) return res.status(400).json({ error: 'Selecione uma empresa para consultar o caixa' });
        const [turnos] = await sequelize.query(
            `SELECT * FROM turnos_caixa WHERE id = :id AND empresa_id = :empresaId`,
            {
                replacements: { id: req.params.id, empresaId },
                type: sequelize.QueryTypes.SELECT
            }
        );
        const turno = turnos;
        if (!turno) return res.status(404).json({ error: 'Turno não encontrado' });

        // Busca vendas ligadas a este turno
        const vendas = await sequelize.query(
                `SELECT id, "createdAt", valor_total, desconto, taxa_entrega, pagamentos, forma_pagamento, turno_id
                 FROM vendas
                 WHERE turno_id = :turnoId AND empresa_id = :empresaId
                 ORDER BY "createdAt" ASC`,
                {
                    replacements: { turnoId: turno.id, empresaId },
                    type: sequelize.QueryTypes.SELECT
                }
            );

        // Só saídas explicitamente vinculadas a este turno e empresa. Não
        // inferir vínculo por data/funcionário para lançamentos antigos.
        const saidas = await sequelize.query(
            `SELECT id, tipo, descricao, data, valor, forma_pagamento, turno_id, natureza, status
             FROM saidas WHERE turno_id = :turnoId AND empresa_id = :empresaId
               AND natureza = 'SAIDA' AND status = 'pago'
             ORDER BY data ASC, id ASC`,
            { replacements: { turnoId: turno.id, empresaId }, type: sequelize.QueryTypes.SELECT }
        );

        res.json({
            turno,
            vendas,
            saidas,
            resumo: calcularResumoTurno(turno, vendas, saidas),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
