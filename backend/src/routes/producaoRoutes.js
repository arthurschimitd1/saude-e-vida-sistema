import { Router } from 'express';
import { Op } from 'sequelize';
import auth from '../middlewares/auth.js';
import sequelize from '../config/database.js';
import Receita from '../models/Receita.js';
import ReceitaItem from '../models/ReceitaItem.js';
import OrdemProducao from '../models/OrdemProducao.js';
import RawMaterial from '../models/RawMaterial.js';
import Product from '../models/Product.js';
import Movimento from '../models/Movimento.js';
import { empresaParaGravar, aplicarEmpresaScope } from '../utils/empresaScope.js';
import producaoDesperdicioService from '../services/ProducaoDesperdicioService.js';
import { criarCalculadoraCustosReceitas } from '../utils/receitas.js';

// ── Criação automática das tabelas (sem FK constraints para evitar conflito de nomes) ──
(async () => {
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS receitas (
                id          SERIAL PRIMARY KEY,
                nome        VARCHAR(200) NOT NULL,
                produto_id  INTEGER,
                empresa_id  INTEGER,
                descricao   TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS receita_itens (
                id               SERIAL PRIMARY KEY,
                receita_id       INTEGER NOT NULL,
                raw_material_id  INTEGER,
                produto_id       INTEGER,
                quantidade       DECIMAL(10,3) NOT NULL DEFAULT 1
            )
        `);
        await sequelize.query(`ALTER TABLE receita_itens ADD COLUMN IF NOT EXISTS produto_id INTEGER`).catch(() => {});
        await sequelize.query(`ALTER TABLE receita_itens ALTER COLUMN raw_material_id DROP NOT NULL`).catch(() => {});
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS ordens_producao (
                id          SERIAL PRIMARY KEY,
                receita_id  INTEGER NOT NULL,
                quantidade  DECIMAL(10,3) NOT NULL DEFAULT 1,
                status      VARCHAR(20) NOT NULL DEFAULT 'pendente',
                empresa_id  INTEGER,
                usuario_id  INTEGER,
                observacao  TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        // Garante colunas extras na tabela Products que podem ter sido adicionadas depois
        await sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cfop VARCHAR(255)`);
        await sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS ncm VARCHAR(255)`);
        await sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(255)`);
        // Valor unitário do produto final na receita
        await sequelize.query(`ALTER TABLE receitas ADD COLUMN IF NOT EXISTS valor_unitario DECIMAL(10,2)`);
        // Custo dos ingredientes, recalculado pelos precos de compra atuais.
        await sequelize.query(`ALTER TABLE receitas ADD COLUMN IF NOT EXISTS custo_estimado DECIMAL(10,2)`);
        await sequelize.query(`ALTER TABLE receitas ADD COLUMN IF NOT EXISTS rendimento DECIMAL(10,3)`);
        // Permite excluir receita sem perder histórico de ordens
        await sequelize.query(`ALTER TABLE ordens_producao ALTER COLUMN receita_id DROP NOT NULL`);
        await sequelize.query(`ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS quantidade_final DECIMAL(10,3)`);
        await sequelize.query(`ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS quantidade_produzida DECIMAL(10,3)`);
        await sequelize.query(`ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS itens_consumidos JSONB`);
        await sequelize.query(`
            UPDATE ordens_producao AS ordem
               SET quantidade_produzida = producao.quantidade
              FROM (
                SELECT origem_id, SUM(quantidade) AS quantidade
                  FROM movimentos
                 WHERE origem_tipo = 'producao' AND tipo = 'entrada' AND quantidade > 0
                 GROUP BY origem_id
              ) AS producao
             WHERE ordem.id = producao.origem_id
               AND ordem.status = 'concluida'
               AND ordem.quantidade_produzida IS NULL
        `);
        await sequelize.query(`ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS classificacao_desperdicio VARCHAR(40)`);
        await sequelize.query(`ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS observacao_desperdicio TEXT`);
        console.log('[producao] tabelas ok');
    } catch (e) {
        console.error('[producao] erro no setup:', e.message);
    }
})();

// Compatibilidade de rollout: garante o schema do relatório antes de liberar
// qualquer rota de produção. A migration formal continua versionada, mas essa
// guarda idempotente evita que uma instância nova grave em coluna inexistente.
await (async () => {
    try {
        await sequelize.query(`ALTER TABLE movimentos ADD COLUMN IF NOT EXISTS tipo_movimento VARCHAR(40)`);
        await sequelize.query(`ALTER TABLE movimentos ADD COLUMN IF NOT EXISTS classificacao_desperdicio VARCHAR(40)`);
        await sequelize.query(`ALTER TABLE movimentos ADD COLUMN IF NOT EXISTS observacao_desperdicio TEXT`);
        await sequelize.query(`
            UPDATE movimentos
               SET tipo_movimento = 'DESPERDICIO'
             WHERE tipo_movimento IS NULL
               AND origem_tipo = 'producao'
               AND motivo ILIKE 'Desperdício %'
        `);
        await sequelize.query(`CREATE INDEX IF NOT EXISTS movimentos_empresa_tipo_data_idx ON movimentos (empresa_id, tipo_movimento, data)`);
        await sequelize.query(`CREATE INDEX IF NOT EXISTS movimentos_empresa_origem_data_idx ON movimentos (empresa_id, origem_tipo, data)`);
    } catch (e) {
        console.error('[producao] erro ao preparar schema de desperdícios:', e.message);
    }
})();

const router = Router();

const CLASSIFICACOES_DESPERDICIO = new Set([
    'rendimento_excedente',
    'desperdicio_real',
    'outro'
]);

const normalizarClassificacaoDesperdicio = (value) => {
    const classificacao = String(value || '').trim().toLowerCase();
    return CLASSIFICACOES_DESPERDICIO.has(classificacao) ? classificacao : 'desperdicio_real';
};

const normalizarBooleano = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined || value === '') return false;
    return !['false', '0', 'nao', 'não', 'off'].includes(String(value).trim().toLowerCase());
};

const quantidadeEsperadaDaReceita = (receita, quantidadeReceitas, quantidadeInformada = null) => {
    const rendimentoCadastrado = Number(receita?.rendimento ?? 0);
    const rendimentoEfetivo = Number(receita?.rendimento_efetivo ?? 0);
    const rendimento = rendimentoCadastrado > 0 ? rendimentoCadastrado : rendimentoEfetivo;
    if (Number.isFinite(rendimento) && rendimento > 0) return rendimento * Number(quantidadeReceitas);
    const informada = Number(quantidadeInformada);
    if (Number.isFinite(informada) && informada > 0) return informada;
    return Number(quantidadeReceitas);
};

const quantidadeMuitoDivergente = (quantidade, esperada) => {
    const atual = Number(quantidade);
    const referencia = Number(esperada);
    if (!Number.isFinite(atual) || !Number.isFinite(referencia) || atual <= 0 || referencia <= 0) return false;
    const proporcao = atual / referencia;
    return proporcao < 0.25 || proporcao > 4;
};

const receitasComCustoAtual = (receitas) => {
    const lista = receitas.map(receita => receita.toJSON ? receita.toJSON() : receita);
    const calculadora = criarCalculadoraCustosReceitas(lista);
    return lista.map(receita => {
        const custo = calculadora.custoDaReceita(receita);
        return {
            ...receita,
            custo_estimado: Number(custo.custoLote.toFixed(2)),
            custo_unitario: Number(custo.custoUnitario.toFixed(4)),
            rendimento_efetivo: custo.rendimento.valor,
            rendimento_inferido: custo.rendimento.inferido,
            rendimento_pendente: custo.rendimento.pendente,
            custo_pendente: custo.pendente,
        };
    });
};

const receitaComCustoAtual = (receita) => receitasComCustoAtual([receita])[0];

// ══════════════════════════════════════════
// RECEITAS
// ══════════════════════════════════════════

// GET /producao/receitas
router.get('/receitas', auth, async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);

        const receitas = await Receita.findAll({
            where,
            include: [
                {
                    model: ReceitaItem,
                    as: 'itens',
                    include: [
                        { model: RawMaterial, as: 'materiaPrima' },
                        { model: Product, as: 'produtoMP' },
                    ]
                },
                { model: Product, as: 'produto' }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(receitasComCustoAtual(receitas));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /producao/ordens?receita_id=X — histórico de ordens por receita
router.get('/ordens/por-receita/:receitaId', auth, async (req, res) => {
    try {
        const where = { receita_id: req.params.receitaId };
        aplicarEmpresaScope(where, req.user);
        const ordens = await OrdemProducao.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
        res.json(ordens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /producao/ordens/:id/consumo — consumo real registrado na ordem
router.get('/ordens/:id/consumo', auth, async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const ordem = await OrdemProducao.findOne({
            where,
            attributes: ['id', 'empresa_id', 'receita_id', 'quantidade', 'quantidade_produzida', 'status', 'itens_consumidos'],
        });
        if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada' });

        let itens = Array.isArray(ordem.itens_consumidos) ? ordem.itens_consumidos : null;
        if (!itens) {
            const movimentos = await Movimento.findAll({
                where: { origem_tipo: 'producao', origem_id: ordem.id, tipo: 'saida', empresa_id: ordem.empresa_id ?? empresaParaGravar(req.user) },
                include: [{ model: Product, as: 'produto', attributes: ['id', 'name', 'unidade_medida', 'raw_material_id'] }],
                order: [['id', 'ASC']],
            });
            const porProduto = new Map();
            for (const movimento of movimentos) {
                const produto = movimento.produto;
                const produtoId = Number(movimento.produto_id);
                const atual = porProduto.get(produtoId) ?? {
                    produto_id: produtoId,
                    raw_material_id: produto?.raw_material_id ?? null,
                    tipo_item: 'produto',
                    nome: produto?.name ?? `Produto #${produtoId}`,
                    unidade: produto?.unidade_medida ?? 'UN',
                    quantidade_ficha: null,
                    quantidade_real: 0,
                    quantidade_desperdicio: 0,
                    quantidade_movimentada: 0,
                };
                const quantidade = Number(movimento.quantidade) || 0;
                atual.quantidade_real += quantidade;
                atual.quantidade_movimentada += quantidade;
                if (movimento.tipo_movimento === 'DESPERDICIO') atual.quantidade_desperdicio += quantidade;
                porProduto.set(produtoId, atual);
            }
            itens = [...porProduto.values()];
        }

        res.json({
            ordemId: ordem.id,
            receitaId: ordem.receita_id,
            quantidadeReceitas: Number(ordem.quantidade),
            quantidadeProduzida: ordem.quantidade_produzida == null ? null : Number(ordem.quantidade_produzida),
            status: ordem.status,
            fonte: Array.isArray(ordem.itens_consumidos) ? 'registro_da_conclusao' : 'movimentos_historicos',
            itens: itens.map((item) => ({
                ...item,
                quantidade_ficha: item.quantidade_ficha == null ? null : Number(item.quantidade_ficha),
                quantidade_real: Number(item.quantidade_real ?? 0),
                quantidade_desperdicio: Number(item.quantidade_desperdicio ?? 0),
                quantidade_movimentada: Number(item.quantidade_movimentada ?? item.quantidade_real ?? 0),
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /producao/relatorios/desperdicios — consulta somente leitura
router.get('/relatorios/desperdicios', auth, async (req, res) => {
    try {
        const data = await producaoDesperdicioService.listar(req.query, req.user);
        res.json(data);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Erro ao consultar desperdícios' });
    }
});

// POST /producao/receitas
router.post('/receitas', auth, async (req, res) => {
    const { nome, descricao, itens, valor_unitario, unidade_medida, is_materia_prima, rendimento } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    if (!(Number(rendimento) > 0)) return res.status(400).json({ error: 'rendimento por receita é obrigatório e deve ser maior que zero' });

    const empId = empresaParaGravar(req.user);
    const t = await sequelize.transaction();
    try {
        const produto = await Product.create({
            name: nome,
            price: valor_unitario && Number(valor_unitario) > 0 ? Number(valor_unitario) : 0,
            currentQuantity: 0,
            minQuantity: 0,
            category: 'Produção',
            empresa_id: empId,
            ...(unidade_medida ? { unidade_medida, unidade_comercial: unidade_medida, unidade_tributavel: unidade_medida } : {}),
            ...(is_materia_prima != null ? { is_materia_prima: normalizarBooleano(is_materia_prima) } : {}),
        }, { transaction: t });

        const receita = await Receita.create({
            nome,
            produto_id: produto.id,
            descricao: descricao ?? null,
            valor_unitario: valor_unitario ?? null,
            custo_estimado: null,
            rendimento: rendimento != null && Number(rendimento) > 0 ? Number(rendimento) : null,
            empresa_id: empId
        }, { transaction: t });

        for (const item of (itens ?? [])) {
            await ReceitaItem.create({
                receita_id: receita.id,
                raw_material_id: item.raw_material_id || null,
                produto_id: item.produto_id || null,
                quantidade: item.quantidade
            }, { transaction: t });
        }

        await t.commit();

        const completa = await Receita.findByPk(receita.id, {
            include: [
                { model: ReceitaItem, as: 'itens', include: [{ model: RawMaterial, as: 'materiaPrima' }, { model: Product, as: 'produtoMP' }] },
                { model: Product, as: 'produto' }
            ]
        });
        res.status(201).json(receitaComCustoAtual(completa));
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// PUT /producao/receitas/:id
router.put('/receitas/:id', auth, async (req, res) => {
    const { nome, descricao, itens, valor_unitario, unidade_medida, is_materia_prima, rendimento } = req.body;
    if (!(Number(rendimento) > 0)) return res.status(400).json({ error: 'rendimento por receita é obrigatório e deve ser maior que zero' });
    const t = await sequelize.transaction();
    try {
        const receitaWhere = { id: req.params.id };
        aplicarEmpresaScope(receitaWhere, req.user);
        const receita = await Receita.findOne({ where: receitaWhere, transaction: t });
        if (!receita) {
            await t.rollback();
            return res.status(404).json({ error: 'Receita não encontrada' });
        }

        if (receita.produto_id) {
            const prodUpdate = {};
            if (nome) prodUpdate.name = nome;
            if (valor_unitario != null && Number(valor_unitario) > 0) prodUpdate.price = Number(valor_unitario);
            if (unidade_medida) {
                prodUpdate.unidade_medida = unidade_medida;
                prodUpdate.unidade_comercial = unidade_medida;
                prodUpdate.unidade_tributavel = unidade_medida;
            }
            if (is_materia_prima != null) prodUpdate.is_materia_prima = normalizarBooleano(is_materia_prima);
            if (Object.keys(prodUpdate).length > 0) {
                const produtoWhere = { id: receita.produto_id };
                aplicarEmpresaScope(produtoWhere, req.user);
                await Product.update(prodUpdate, { where: produtoWhere, transaction: t });
            }
        }

        await receita.update({
            nome,
            descricao: descricao ?? null,
            valor_unitario: valor_unitario ?? null,
            rendimento: rendimento != null && Number(rendimento) > 0 ? Number(rendimento) : null
        }, { transaction: t });

        // Substitui os itens
        await ReceitaItem.destroy({ where: { receita_id: receita.id }, transaction: t });
        for (const item of (itens ?? [])) {
            await ReceitaItem.create({
                receita_id: receita.id,
                raw_material_id: item.raw_material_id || null,
                produto_id: item.produto_id || null,
                quantidade: item.quantidade
            }, { transaction: t });
        }

        await t.commit();

        const completa = await Receita.findByPk(receita.id, {
            include: [
                { model: ReceitaItem, as: 'itens', include: [{ model: RawMaterial, as: 'materiaPrima' }, { model: Product, as: 'produtoMP' }] },
                { model: Product, as: 'produto' }
            ]
        });
        res.json(receitaComCustoAtual(completa));
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// DELETE /producao/receitas/:id
router.delete('/receitas/:id', auth, async (req, res) => {
    const receitaWhere = { id: req.params.id };
    aplicarEmpresaScope(receitaWhere, req.user);
    try {
        const receita = await Receita.findOne({ where: receitaWhere });
        if (!receita) return res.status(404).json({ error: 'Receita não encontrada' });
        await ReceitaItem.destroy({ where: { receita_id: receita.id } });
        const ordemWhere = { receita_id: receita.id };
        aplicarEmpresaScope(ordemWhere, req.user);
        await OrdemProducao.update({ receita_id: null }, { where: ordemWhere });
        await receita.destroy();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════
// ORDENS DE PRODUÇÃO
// ══════════════════════════════════════════

// GET /producao/ordens
router.get('/ordens', auth, async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);

        const ordens = await OrdemProducao.findAll({
            where,
            include: [
                {
                    model: Receita,
                    as: 'receita',
                    include: [
                        { model: ReceitaItem, as: 'itens', include: [{ model: RawMaterial, as: 'materiaPrima' }, { model: Product, as: 'produtoMP' }] },
                        { model: Product, as: 'produto' }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(ordens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /producao/ordens — cria uma nova ordem (status: pendente)
router.post('/ordens', auth, async (req, res) => {
    const { receita_id, quantidade, quantidade_final, observacao } = req.body;
    if (!receita_id) return res.status(400).json({ error: 'receita_id é obrigatório' });
    if (!Number.isFinite(Number(quantidade)) || Number(quantidade) <= 0) return res.status(400).json({ error: 'quantidade deve ser maior que zero' });
    if (quantidade_final != null && (!Number.isFinite(Number(quantidade_final)) || Number(quantidade_final) <= 0)) {
        return res.status(400).json({ error: 'quantidade_final deve ser maior que zero' });
    }

    try {
        const receitaWhere = { id: receita_id };
        aplicarEmpresaScope(receitaWhere, req.user);
        const receita = await Receita.findOne({ where: receitaWhere });
        if (!receita) return res.status(404).json({ error: 'Receita não encontrada' });

        const quantidadeReceitas = Number(quantidade);
        const quantidadeEsperada = quantidadeEsperadaDaReceita(receita, quantidadeReceitas, quantidade_final);
        const quantidadeFinal = quantidade_final != null ? Number(quantidade_final) : quantidadeEsperada;
        if (quantidadeMuitoDivergente(quantidadeFinal, quantidadeEsperada)) {
            return res.status(400).json({
                error: `A quantidade final (${quantidadeFinal}) está muito distante do rendimento esperado (${quantidadeEsperada}). Revise a quantidade de receitas e o rendimento da ficha técnica.`
            });
        }
        const ordem = await OrdemProducao.create({
            receita_id,
            quantidade: quantidadeReceitas,
            quantidade_final: quantidadeFinal,
            observacao: observacao ?? null,
            status: 'pendente',
            empresa_id: empresaParaGravar(req.user),
            usuario_id: req.user?.id ?? null
        });
        res.status(201).json(ordem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /producao/ordens/:id/concluir — executa a produção
// Aceita body.itens opcional: [{ produto_id|raw_material_id, quantidade_real }]
// Se quantidade_real > quantidade_receita, o excedente é registrado como "Desperdício"
router.post('/ordens/:id/concluir', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const ordemWhere = { id: req.params.id };
        aplicarEmpresaScope(ordemWhere, req.user);
        const ordem = await OrdemProducao.findOne({ where: ordemWhere, transaction: t, lock: t.LOCK.UPDATE });
        if (!ordem) {
            await t.rollback();
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        if (ordem.status !== 'pendente') {
            await t.rollback();
            return res.status(400).json({ error: 'Ordem já foi concluída ou cancelada' });
        }

        const receitaWhere = { id: ordem.receita_id };
        aplicarEmpresaScope(receitaWhere, req.user);
        const receita = await Receita.findOne({
            where: receitaWhere,
            include: [{ model: ReceitaItem, as: 'itens', include: [{ model: RawMaterial, as: 'materiaPrima' }, { model: Product, as: 'produtoMP' }] }],
            transaction: t
        });
        if (!receita) {
            await t.rollback();
            return res.status(404).json({ error: 'Receita não encontrada' });
        }

        const qtdReceitas = Number(ordem.quantidade);
        const qtdEsperada = quantidadeEsperadaDaReceita(receita, qtdReceitas, ordem.quantidade_final);
        const qtdProduzida = req.body.quantidade_final_real != null ? Number(req.body.quantidade_final_real) : qtdEsperada;
        if (!Number.isFinite(qtdProduzida) || qtdProduzida <= 0) {
            throw new Error('A quantidade realmente produzida deve ser maior que zero');
        }
        if (quantidadeMuitoDivergente(qtdProduzida, qtdEsperada) && !normalizarBooleano(req.body.confirmar_divergencia_quantidade)) {
            const erro = new Error(`A quantidade produzida (${qtdProduzida}) está muito distante do esperado (${qtdEsperada}). Confirme a divergência para continuar.`);
            erro.codigo = 'QUANTIDADE_PRODUZIDA_DIVERGENTE';
            erro.quantidadeEsperada = qtdEsperada;
            throw erro;
        }
        const itensReais = Array.isArray(req.body.itens) ? req.body.itens : null;
        const classificacaoDesperdicio = normalizarClassificacaoDesperdicio(req.body.classificacao_desperdicio);
        const observacaoDesperdicio = String(req.body.observacao_desperdicio || '').trim() || null;

        const registrarExcedente = async ({ produtoId, quantidade, motivoBase }) => {
            const rendimentoExcedente = classificacaoDesperdicio === 'rendimento_excedente';
            await Movimento.create({
                produto_id: produtoId,
                empresa_id: ordem.empresa_id ?? null,
                usuario_id: req.user?.id ?? null,
                tipo: 'saida',
                quantidade,
                motivo: `${rendimentoExcedente ? 'Rendimento excedente' : 'Desperdício'} — ${motivoBase}`,
                origem_tipo: 'producao',
                origem_id: ordem.id,
                tipo_movimento: rendimentoExcedente ? 'RENDIMENTO_EXCEDENTE' : 'DESPERDICIO',
                classificacao_desperdicio: classificacaoDesperdicio,
                observacao_desperdicio: observacaoDesperdicio,
                data: new Date()
            }, { transaction: t });
        };

        // ── 1. Verifica e desconta matérias-primas ──
        const itensConsumidos = [];
        for (const item of receita.itens) {
            let prodIngrediente = null;
            let nomeIngrediente = '';
            let unidadeIngrediente = '';

            const consumoReceita = Number(item.quantidade) * qtdReceitas;
            let consumoReal = consumoReceita;

            if (itensReais) {
                const override = itensReais.find(r =>
                    (item.produto_id && Number(r.produto_id) === item.produto_id) ||
                    (item.raw_material_id && Number(r.raw_material_id) === item.raw_material_id)
                );
                if (override && override.quantidade_real != null) {
                    consumoReal = Number(override.quantidade_real);
                    if (consumoReal < 0) consumoReal = 0;
                }
            }

            if (item.produto_id) {
                prodIngrediente = item.produtoMP || await Product.findByPk(item.produto_id, { transaction: t });
                if (!prodIngrediente) throw new Error(`Produto (matéria-prima) ID ${item.produto_id} não encontrado`);
                nomeIngrediente = prodIngrediente.name;
                unidadeIngrediente = prodIngrediente.unidade_medida || 'UN';
            } else if (item.raw_material_id) {
                const mp = await RawMaterial.findByPk(item.raw_material_id, { transaction: t });
                if (!mp) throw new Error(`Matéria-prima ID ${item.raw_material_id} não encontrada`);
                nomeIngrediente = mp.name;
                unidadeIngrediente = mp.unit;
                prodIngrediente = await Product.findOne({
                    where: { [Op.or]: [{ raw_material_id: mp.id }, { name: mp.name, is_materia_prima: true }] },
                    order: [['raw_material_id', 'DESC NULLS LAST']],
                    transaction: t
                }).catch(() => null);
                const qtdAtual = prodIngrediente ? Number(prodIngrediente.currentQuantity) : Number(mp.currentQuantity);
                if (qtdAtual < consumoReal) {
                    throw new Error(`Estoque insuficiente de "${nomeIngrediente}": tem ${qtdAtual} ${unidadeIngrediente}, precisa ${consumoReal} ${unidadeIngrediente}`);
                }
                const novaQtd = qtdAtual - consumoReal;
                await mp.update({ currentQuantity: novaQtd }, { transaction: t });
                if (prodIngrediente) {
                    await prodIngrediente.update({ currentQuantity: novaQtd }, { transaction: t });
                    const qtdProducao = Math.min(consumoReal, consumoReceita);
                    if (qtdProducao > 0) {
                        await Movimento.create({
                            produto_id: prodIngrediente.id,
                            empresa_id: ordem.empresa_id ?? null,
                            usuario_id: req.user?.id ?? null,
                            tipo: 'saida',
                            quantidade: qtdProducao,
                            motivo: `Produção — ${receita.nome}`,
                            origem_tipo: 'producao',
                            origem_id: ordem.id,
                            data: new Date()
                        }, { transaction: t });
                    }
                    const desperdicio = consumoReal - consumoReceita;
                    if (desperdicio > 0) {
                        await registrarExcedente({ produtoId: prodIngrediente.id, quantidade: desperdicio, motivoBase: receita.nome });
                    }
                }
                itensConsumidos.push({
                    tipo_item: 'raw_material',
                    produto_id: prodIngrediente?.id ?? null,
                    raw_material_id: mp.id,
                    nome: nomeIngrediente,
                    unidade: unidadeIngrediente,
                    quantidade_ficha: consumoReceita,
                    quantidade_real: consumoReal,
                    quantidade_desperdicio: Math.max(0, consumoReal - consumoReceita),
                    quantidade_movimentada: prodIngrediente ? consumoReal : 0,
                });
                continue;
            } else {
                throw new Error('Item de receita sem matéria-prima ou produto vinculado');
            }

            const qtdAtual = Number(prodIngrediente.currentQuantity);
            if (qtdAtual < consumoReal) {
                throw new Error(`Estoque insuficiente de "${nomeIngrediente}": tem ${qtdAtual} ${unidadeIngrediente}, precisa ${consumoReal} ${unidadeIngrediente}`);
            }
            const novaQtd = qtdAtual - consumoReal;
            await prodIngrediente.update({ currentQuantity: novaQtd }, { transaction: t });
            const qtdProducao = Math.min(consumoReal, consumoReceita);
            if (qtdProducao > 0) {
                await Movimento.create({
                    produto_id: prodIngrediente.id,
                    empresa_id: ordem.empresa_id ?? null,
                    usuario_id: req.user?.id ?? null,
                    tipo: 'saida',
                    quantidade: qtdProducao,
                    motivo: `Produção — ${receita.nome}`,
                    origem_tipo: 'producao',
                    origem_id: ordem.id,
                    data: new Date()
                }, { transaction: t });
            }
            const desperdicio = consumoReal - consumoReceita;
            if (desperdicio > 0) {
                await registrarExcedente({ produtoId: prodIngrediente.id, quantidade: desperdicio, motivoBase: receita.nome });
            }
            itensConsumidos.push({
                tipo_item: 'produto',
                produto_id: prodIngrediente.id,
                raw_material_id: null,
                nome: nomeIngrediente,
                unidade: unidadeIngrediente,
                quantidade_ficha: consumoReceita,
                quantidade_real: consumoReal,
                quantidade_desperdicio: Math.max(0, consumoReal - consumoReceita),
                quantidade_movimentada: consumoReal,
            });
        }

        // ── 2. Adiciona ao estoque do produto final ──
        let produto = receita.produto_id
            ? await Product.findByPk(receita.produto_id, { transaction: t })
            : null;

        if (!produto) {
            produto = await Product.create({
                name: receita.nome,
                price: receita.valor_unitario ? Number(receita.valor_unitario) : 0,
                currentQuantity: 0,
                minQuantity: 0,
                category: 'Produção',
                empresa_id: ordem.empresa_id ?? null
            }, { transaction: t });
            await receita.update({ produto_id: produto.id }, { transaction: t });
        }

        const prodUpdate = { currentQuantity: Number(produto.currentQuantity) + qtdProduzida };
        if (receita.valor_unitario && Number(receita.valor_unitario) > 0) {
            prodUpdate.price = Number(receita.valor_unitario);
        }
        await produto.update(prodUpdate, { transaction: t });

        await Movimento.create({
            produto_id: produto.id,
            empresa_id: ordem.empresa_id ?? null,
            usuario_id: req.user?.id ?? null,
            tipo: 'entrada',
            quantidade: qtdProduzida,
            motivo: `Produção — ${receita.nome}`,
            origem_tipo: 'producao',
            origem_id: ordem.id,
            data: new Date()
        }, { transaction: t });

        // ── 3. Marca a ordem como concluída ──
        const houveExcedente = itensReais?.some((item) => {
            const itemReceita = receita.itens.find((itemBase) =>
                (itemBase.produto_id && Number(item.produto_id) === itemBase.produto_id) ||
                (itemBase.raw_material_id && Number(item.raw_material_id) === itemBase.raw_material_id)
            );
            return itemReceita && Number(item.quantidade_real) > Number(itemReceita.quantidade) * qtdReceitas;
        }) || false;
        await ordem.update({
            status: 'concluida',
            quantidade_produzida: qtdProduzida,
            itens_consumidos: itensConsumidos,
            classificacao_desperdicio: houveExcedente ? classificacaoDesperdicio : null,
            observacao_desperdicio: houveExcedente ? observacaoDesperdicio : null
        }, { transaction: t });

        await t.commit();
        res.json({ ok: true, ordem });
    } catch (err) {
        await t.rollback();
        res.status(400).json({
            error: err.message,
            codigo: err.codigo,
            quantidadeEsperada: err.quantidadeEsperada
        });
    }
});

// POST /producao/ordens/:id/desfazer — desfaz uma produção já concluída
// mantendo os movimentos originais e registrando lançamentos compensatórios.
router.post('/ordens/:id/desfazer', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const ordemWhere = { id: req.params.id };
        aplicarEmpresaScope(ordemWhere, req.user);
        const ordem = await OrdemProducao.findOne({ where: ordemWhere, transaction: t, lock: t.LOCK.UPDATE });
        if (!ordem) {
            await t.rollback();
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        if (ordem.status !== 'concluida') {
            await t.rollback();
            return res.status(400).json({ error: 'Somente uma ordem concluída pode ser desfeita' });
        }

        const movimentos = await Movimento.findAll({
            where: { origem_tipo: 'producao', origem_id: ordem.id, empresa_id: ordem.empresa_id },
            transaction: t,
            lock: t.LOCK.UPDATE,
            order: [['id', 'ASC']],
        });
        const entradas = movimentos.filter((movimento) => movimento.tipo === 'entrada');
        const saidas = movimentos.filter((movimento) => movimento.tipo === 'saida');
        if (!entradas.length) throw new Error('Não foi encontrado o lançamento do produto produzido para esta ordem');

        const devolucoesRaw = new Map();
        if (Array.isArray(ordem.itens_consumidos)) {
            for (const item of ordem.itens_consumidos) {
                if (item.tipo_item !== 'raw_material' || !item.raw_material_id) continue;
                const id = Number(item.raw_material_id);
                devolucoesRaw.set(id, Number(devolucoesRaw.get(id) ?? 0) + Number(item.quantidade_real ?? 0));
            }
        } else {
            // Ordens antigas não possuem snapshot. Só permitimos desfazê-las
            // quando todos os insumos eram produtos-espelho, pois nesse caso
            // os movimentos guardam a quantidade exata que saiu do estoque.
            const receitaAntiga = ordem.receita_id
                ? await Receita.findOne({ where: { id: ordem.receita_id }, include: [{ model: ReceitaItem, as: 'itens' }], transaction: t })
                : null;
            const idsRaw = (receitaAntiga?.itens ?? []).filter((item) => item.raw_material_id).map((item) => Number(item.raw_material_id));
            const produtosSaida = await Product.findAll({
                where: { id: { [Op.in]: [...new Set(saidas.map((movimento) => Number(movimento.produto_id)))] }, empresa_id: ordem.empresa_id },
                attributes: ['id', 'raw_material_id'],
                transaction: t,
            });
            const idsRawComMovimento = new Set(produtosSaida.map((produto) => Number(produto.raw_material_id)).filter(Number.isInteger));
            const semRastreio = idsRaw.filter((id) => !idsRawComMovimento.has(id));
            if (semRastreio.length) {
                throw new Error('Esta ordem foi concluída antes do registro detalhado do consumo e possui matéria-prima sem produto-espelho. Ela não pode ser desfeita automaticamente com segurança.');
            }
            for (const movimento of saidas) {
                const produto = produtosSaida.find((item) => Number(item.id) === Number(movimento.produto_id));
                const rawId = Number(produto?.raw_material_id);
                if (!Number.isInteger(rawId)) continue;
                devolucoesRaw.set(rawId, Number(devolucoesRaw.get(rawId) ?? 0) + Number(movimento.quantidade));
            }
        }

        const entradasPorProduto = new Map();
        for (const movimento of entradas) {
            const id = Number(movimento.produto_id);
            entradasPorProduto.set(id, Number(entradasPorProduto.get(id) ?? 0) + Number(movimento.quantidade));
        }
        const dataUltimaEntrada = entradas.reduce((maisRecente, movimento) => {
            const data = new Date(movimento.data).getTime();
            return Number.isFinite(data) && data > maisRecente ? data : maisRecente;
        }, 0);
        if (dataUltimaEntrada > 0) {
            const saidasPosteriores = await Movimento.count({
                where: {
                    empresa_id: ordem.empresa_id,
                    produto_id: { [Op.in]: [...entradasPorProduto.keys()] },
                    tipo: 'saida',
                    data: { [Op.gt]: new Date(dataUltimaEntrada) },
                    origem_tipo: { [Op.ne]: 'producao_desfazimento' },
                },
                transaction: t,
            });
            if (saidasPosteriores > 0) {
                throw new Error('Não é possível desfazer: o produto produzido já teve uma saída posterior, como venda, consumo ou ajuste de estoque.');
            }
        }
        for (const [produtoId, quantidade] of entradasPorProduto) {
            const produto = await Product.findOne({
                where: { id: produtoId, empresa_id: ordem.empresa_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!produto) throw new Error(`Produto produzido #${produtoId} não foi encontrado`);
            if (Number(produto.currentQuantity) + 0.0005 < quantidade) {
                throw new Error(`Não é possível desfazer: o estoque de "${produto.name}" não possui as ${quantidade} unidades produzidas. Cancele ou ajuste as movimentações posteriores primeiro.`);
            }
        }

        // Retira o produto final que entrou no estoque.
        for (const movimento of entradas) {
            const produto = await Product.findOne({
                where: { id: movimento.produto_id, empresa_id: ordem.empresa_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            await produto.update({ currentQuantity: Number(produto.currentQuantity) - Number(movimento.quantidade) }, { transaction: t });
            await Movimento.create({
                produto_id: movimento.produto_id,
                empresa_id: ordem.empresa_id,
                usuario_id: req.user?.id ?? null,
                tipo: 'saida',
                quantidade: movimento.quantidade,
                motivo: `Desfazimento da produção — ${ordem.id}`,
                origem_tipo: 'producao_desfazimento',
                origem_id: ordem.id,
                tipo_movimento: 'DESFAZIMENTO_PRODUCAO',
                data: new Date(),
            }, { transaction: t });
        }

        // Devolve ao estoque os insumos que possuíam produto-espelho.
        for (const movimento of saidas) {
            const produto = await Product.findOne({
                where: { id: movimento.produto_id, empresa_id: ordem.empresa_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (produto) {
                await produto.update({ currentQuantity: Number(produto.currentQuantity) + Number(movimento.quantidade) }, { transaction: t });
            }
            await Movimento.create({
                produto_id: movimento.produto_id,
                empresa_id: ordem.empresa_id,
                usuario_id: req.user?.id ?? null,
                tipo: 'entrada',
                quantidade: movimento.quantidade,
                motivo: `Desfazimento da produção — ${ordem.id}`,
                origem_tipo: 'producao_desfazimento',
                origem_id: ordem.id,
                tipo_movimento: 'DESFAZIMENTO_PRODUCAO',
                data: new Date(),
            }, { transaction: t });
        }

        // Matérias-primas sem produto-espelho não tinham Movimento para
        // registrar a baixa; o snapshot da conclusão permite devolvê-las.
        for (const [rawMaterialId, quantidade] of devolucoesRaw) {
            const materia = await RawMaterial.findOne({
                where: { id: rawMaterialId, empresa_id: ordem.empresa_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (materia) {
                await materia.update({ currentQuantity: Number(materia.currentQuantity) + quantidade }, { transaction: t });
            }
        }

        await ordem.update({ status: 'desfeita' }, { transaction: t });
        await t.commit();
        res.json({ ok: true, ordem });
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
});

// POST /producao/ordens/:id/cancelar
router.post('/ordens/:id/cancelar', auth, async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const ordem = await OrdemProducao.findOne({ where });
        if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada' });
        if (ordem.status !== 'pendente') return res.status(400).json({ error: 'Só ordens pendentes podem ser canceladas' });
        await ordem.update({ status: 'cancelada' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
