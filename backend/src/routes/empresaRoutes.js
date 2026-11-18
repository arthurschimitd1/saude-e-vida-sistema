import { Router } from 'express';
import sequelize from '../config/database.js';
import auth from '../middlewares/auth.js';
import bcrypt from 'bcrypt';
import AccessControlService from '../services/access/AccessControlService.js';
import User from '../models/UserModel.js';
import { CENTRAL_GESTAO_ROUTE, CENTRAL_GESTAO_VISUALIZAR_FLAG } from '../access/accessCatalog.js';

const router = Router();

const empresaSchemaReady = (async () => {
    try {
        await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cadastrado_por VARCHAR(200)`);
        await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cadastrado_por_id INTEGER`);
        await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pacote VARCHAR(30)`);
        await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMPTZ`);
        await sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18)`);
    } catch {}
})();

const limparCnpj = (valor) => {
    const digitos = String(valor ?? '').replace(/\D/g, '').slice(0, 14);
    return digitos || null;
};

const buscarResponsavel = (empresaId, attributes, transaction) => User.findOne({
    where: { empresa_id: empresaId },
    attributes,
    order: [
        [sequelize.literal(`CASE WHEN LOWER(cargo) = 'dono' THEN 0 WHEN tipo = 'EMPRESA' THEN 1 ELSE 2 END`), 'ASC'],
        ['created_at', 'ASC'],
        ['id', 'ASC']
    ],
    transaction
});

router.get('/', auth, async (req, res) => {
    try {
        await empresaSchemaReady;
        if (req.user?.tipo !== 'MASTER') {
            if (!req.user?.empresa_id) return res.json([]);
            const rows = await sequelize.query(
                `SELECT id, nome, cnpj, permissoes, pacote, cadastrado_por, cadastrado_por_id
                 FROM empresas
                 WHERE id = :id AND arquivada_em IS NULL
                 ORDER BY nome`,
                { replacements: { id: req.user.empresa_id }, type: sequelize.QueryTypes.SELECT }
            );
            return res.json(rows);
        }
        const rows = await sequelize.query(
            `SELECT id, nome, cnpj, permissoes, pacote, cadastrado_por, cadastrado_por_id
             FROM empresas
             WHERE arquivada_em IS NULL
             ORDER BY nome`,
            { type: sequelize.QueryTypes.SELECT }
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', auth, async (req, res) => {
    // Não-MASTER só pode consultar sua própria empresa
    if (req.user?.tipo !== 'MASTER' && String(req.user?.empresa_id) !== String(req.params.id)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    try {
        await empresaSchemaReady;
        const rows = await sequelize.query(
            `SELECT id, nome, cnpj, permissoes, pacote, cadastrado_por, cadastrado_por_id
             FROM empresas
             WHERE id = :id AND arquivada_em IS NULL`,
            { replacements: { id: req.params.id }, type: sequelize.QueryTypes.SELECT }
        );
        if (!rows.length) return res.status(404).json({ error: 'Empresa não encontrada' });

        const enderecoResponsavel = await buscarResponsavel(req.params.id, [
            'cep', 'rua', 'bairro', 'cidade', 'estado', 'pais', 'numero', 'pontoReferencia'
        ]);
        const endereco = enderecoResponsavel?.toJSON() ?? null;

        if (req.user?.tipo !== 'MASTER') {
            return res.json({ ...rows[0], endereco });
        }

        const owner = await buscarResponsavel(req.params.id, [
            'id', 'nomeCompleto', 'email', 'cpf', 'cargo', 'cep', 'rua',
            'bairro', 'cidade', 'estado', 'pais', 'numero', 'pontoReferencia'
        ]);
        res.json({ ...rows[0], endereco, dono: owner?.toJSON() ?? null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', auth, async (req, res) => {
    if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });

    const {
        nomeEmpresa, cnpj, permissoes = [], pacote = null,
        nomeCompleto, email, senha, cpf,
        cargo = 'Dono',
        rua = '-', bairro = '-', cidade = '-', estado = 'XX', numero = 'S/N'
    } = req.body;

    if (!nomeEmpresa || !nomeCompleto || !email || !senha) {
        return res.status(400).json({ error: 'nomeEmpresa, nomeCompleto, email e senha são obrigatórios' });
    }

    const cadastradoPor = req.user?.nomeCompleto ?? req.user?.email ?? 'Sistema';
    const cadastradoPorId = req.user?.id ?? null;
    const permissoesEmpresa = [...new Set([...permissoes, CENTRAL_GESTAO_ROUTE])];
    const permissoesDono = [...new Set([...permissoesEmpresa, CENTRAL_GESTAO_VISUALIZAR_FLAG])];

    const t = await sequelize.transaction();
    try {
        await empresaSchemaReady;
        const [empresaResult] = await sequelize.query(
            'INSERT INTO empresas (nome, cnpj, permissoes, pacote, cadastrado_por, cadastrado_por_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            { bind: [nomeEmpresa, limparCnpj(cnpj), permissoesEmpresa, pacote, cadastradoPor, cadastradoPorId], type: sequelize.QueryTypes.INSERT, transaction: t }
        );
        const empresaId = empresaResult[0]?.id;

        const senhaHash = await bcrypt.hash(senha, 10);
        const [ownerResult] = await sequelize.query(
            `INSERT INTO users
                ("nomeCompleto", cpf, cargo, email, senha, senha_texto, rua, bairro, cidade, estado, numero, tipo, status, permissoes, empresa_id, created_at, updated_at)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EMPRESA', 'ativo', $12, $13, NOW(), NOW())
             RETURNING id`,
            {
                bind: [nomeCompleto, cpf || '000.000.000-00', cargo, email, senhaHash, senha, rua, bairro, cidade, estado, numero, permissoesDono, empresaId],
                type: sequelize.QueryTypes.INSERT,
                transaction: t
            }
        );
        const ownerId = ownerResult[0]?.id;

        await AccessControlService.initializeCompanyProfile({
            empresaId,
            planCode: pacote,
            permissions: permissoesEmpresa,
            actorUserId: req.user.id,
            transaction: t
        });
        await AccessControlService.initializeUserProfile(
            ownerId,
            'INHERIT_COMPANY',
            permissoesDono,
            t
        );

        await t.commit();
        res.status(201).json({ message: 'Empresa e dono cadastrados com sucesso', empresaId });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/permissoes', auth, async (req, res) => {
    if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });
    const { permissoes = [], pacote = null } = req.body;
    const ROTAS_P2 = ['/uikit/prospeccao','/financeiro/dashboard','/financeiro/entradas','/financeiro/contas-receber','/financeiro/saidas','/financeiro/relatorios','/uikit/crm','/uikit/escola-financeiro'];
    const temP2 = ROTAS_P2.some(r => permissoes.includes(r));
    console.log(`[EMP-AUDIT] PUT /empresas/${req.params.id}/permissoes | caller: ${req.user?.email ?? 'unknown'} | total: ${permissoes.length} | temP2: ${temP2}`);
    try {
        const access = await AccessControlService.updateCompanyPlan({
            empresaId: req.params.id,
            planCode: pacote ?? 'personalizado',
            customRoutes: permissoes,
            policy: 'AUTO_ADD',
            actorUserId: req.user.id
        });
        res.json({ message: 'Módulos atualizados com sucesso', access });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });
    const {
        nome, nomeEmpresa, cnpj, ownerId, nomeCompleto, email, senha, cpf, cargo,
        cep, rua, bairro, cidade, estado, pais, numero, pontoReferencia
    } = req.body;
    const nomeAtualizado = String(nomeEmpresa ?? nome ?? '').trim();
    const t = await sequelize.transaction();

    try {
        await empresaSchemaReady;
        const [empresa] = await sequelize.query(
            'SELECT id FROM empresas WHERE id = :id AND arquivada_em IS NULL FOR UPDATE',
            {
                replacements: { id: req.params.id },
                type: sequelize.QueryTypes.SELECT,
                transaction: t
            }
        );
        if (!empresa) {
            await t.rollback();
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }

        if (nomeAtualizado) {
            await sequelize.query(
                'UPDATE empresas SET nome = :nome WHERE id = :id',
                { replacements: { nome: nomeAtualizado, id: req.params.id }, transaction: t }
            );
        }
        if (cnpj !== undefined) {
            await sequelize.query(
                'UPDATE empresas SET cnpj = :cnpj WHERE id = :id',
                { replacements: { cnpj: limparCnpj(cnpj), id: req.params.id }, transaction: t }
            );
        }

        const ownerWhere = ownerId
            ? { id: ownerId, empresa_id: req.params.id }
            : { empresa_id: req.params.id };
        const owner = await User.findOne({
            where: ownerWhere,
            order: [
                [sequelize.literal(`CASE WHEN LOWER(cargo) = 'dono' THEN 0 WHEN tipo = 'EMPRESA' THEN 1 ELSE 2 END`), 'ASC'],
                ['created_at', 'ASC'],
                ['id', 'ASC']
            ],
            transaction: t
        });

        if (owner) {
            const ownerUpdates = {};
            const nonEmptyFields = { nomeCompleto, email, cargo };
            for (const [field, value] of Object.entries(nonEmptyFields)) {
                if (typeof value === 'string' && value.trim()) ownerUpdates[field] = value.trim();
            }

            const optionalFields = { cpf, cep, rua, bairro, cidade, estado, pais, numero, pontoReferencia };
            for (const [field, value] of Object.entries(optionalFields)) {
                if (value !== undefined) ownerUpdates[field] = typeof value === 'string' ? value.trim() || null : value;
            }

            if (typeof senha === 'string' && senha.trim()) {
                ownerUpdates.senha_texto = senha;
                ownerUpdates.senha = await bcrypt.hash(senha, 10);
            }
            if (Object.keys(ownerUpdates).length) {
                await owner.update(ownerUpdates, { transaction: t });
            }
        }

        await t.commit();
        res.json({ message: 'Informações atualizadas com sucesso' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
});

// ── Cargos da empresa (persiste no banco em vez de localStorage) ──────────
router.get('/:id/cargos', auth, async (req, res) => {
    const isMaster = req.user?.tipo === 'MASTER';
    if (!isMaster && String(req.user?.empresa_id) !== String(req.params.id))
        return res.status(403).json({ error: 'Acesso negado' });
    try {
        const [empresa] = await sequelize.query(
            'SELECT cargos FROM empresas WHERE id = :id',
            { replacements: { id: req.params.id }, type: sequelize.QueryTypes.SELECT }
        );
        res.json(empresa?.cargos ?? []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/cargos', auth, async (req, res) => {
    const isMaster = req.user?.tipo === 'MASTER';
    if (!isMaster && String(req.user?.empresa_id) !== String(req.params.id))
        return res.status(403).json({ error: 'Acesso negado' });
    const { cargos = [] } = req.body;
    try {
        await sequelize.query(
            'UPDATE empresas SET cargos = :cargos::jsonb WHERE id = :id',
            { replacements: { cargos: JSON.stringify(cargos), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
        );
        const result = await AccessControlService.applyRoleChanges(req.params.id, cargos, req.user.id);
        res.json({ message: 'Cargos atualizados', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Configurações da empresa (JSONB) ────────────────────────────────────────
router.get('/:id/configuracoes', auth, async (req, res) => {
    const isMaster = req.user?.tipo === 'MASTER';
    if (!isMaster && String(req.user?.empresa_id) !== String(req.params.id))
        return res.status(403).json({ error: 'Acesso negado' });
    try {
        const [empresa] = await sequelize.query(
            'SELECT configuracoes FROM empresas WHERE id = :id',
            { replacements: { id: req.params.id }, type: sequelize.QueryTypes.SELECT }
        );
        res.json(empresa?.configuracoes ?? {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/configuracoes', auth, async (req, res) => {
    const isMaster = req.user?.tipo === 'MASTER';
    if (!isMaster && String(req.user?.empresa_id) !== String(req.params.id))
        return res.status(403).json({ error: 'Acesso negado' });
    const { configuracoes = {} } = req.body;
    try {
        await sequelize.query(
            `UPDATE empresas SET configuracoes = COALESCE(configuracoes, '{}'::jsonb) || :cfg::jsonb WHERE id = :id`,
            { replacements: { cfg: JSON.stringify(configuracoes), id: req.params.id }, type: sequelize.QueryTypes.UPDATE }
        );
        res.json({ message: 'Configurações atualizadas' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });
    const id = req.params.id;
    const t = await sequelize.transaction();
    try {
        const [empresa] = await sequelize.query(
            'SELECT id, nome, arquivada_em FROM empresas WHERE id = :id FOR UPDATE',
            { replacements: { id }, type: sequelize.QueryTypes.SELECT, transaction: t }
        );

        if (!empresa || empresa.arquivada_em) {
            await t.rollback();
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }

        // Arquiva em vez de apagar para preservar estoque, vendas, notas e auditoria.
        await sequelize.query(
            `UPDATE users
             SET status = 'bloqueado', updated_at = NOW()
             WHERE empresa_id = :id AND status <> 'bloqueado'`,
            { replacements: { id }, transaction: t }
        );
        await sequelize.query(
            'UPDATE empresas SET arquivada_em = NOW() WHERE id = :id',
            { replacements: { id }, transaction: t }
        );
        await t.commit();
        res.json({ message: 'Empresa removida da gestão com segurança' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
});

export default router;
