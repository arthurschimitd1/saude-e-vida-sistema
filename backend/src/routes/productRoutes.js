import { Router } from 'express';
import {
  createProduct,
  getProducts,
  getProductCostHistory,
  updateProduct,
  deleteProduct
} from '../controllers/productController.js';
import auth from '../middlewares/auth.js';
import Product from '../models/Product.js';
import Movimento from '../models/Movimento.js';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import productService from '../services/ProductService.js';
import { uploadSingle } from '../middlewares/upload.js';
import {
    applyUploadedInvoice,
    previewUploadedInvoice
} from '../controllers/FiscalStockImportController.js';

const router = Router();

router.post('/importacao-nota/preview', auth, uploadSingle, previewUploadedInvoice);
router.post('/importacao-nota/apply', auth, uploadSingle, applyUploadedInvoice);
router.get('/:id/historico-custos', auth, getProductCostHistory);

router.post('/transferir-caixa', auth, async (req, res) => {
    try {
        const result = await productService.transferBoxes(req.body, req.user);
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

router.post('/vincular-unidade-caixa', auth, async (req, res) => {
    try {
        const unidade = await productService.linkLegacyBoxUnit(req.body, req.user);
        return res.json(unidade);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Todas as rotas precisam de autenticação
router.post('/transferir-granel', auth, async (req, res) => {
    const { origem_id, granel_id, quantidade_saida } = req.body;
    if (!origem_id || !granel_id || !quantidade_saida || quantidade_saida <= 0) {
        return res.status(400).json({ error: 'origem_id, granel_id e quantidade_saida (> 0) são obrigatórios' });
    }

    const t = await sequelize.transaction();
    try {
        const origem = await Product.findByPk(origem_id, { transaction: t });
        const granel = await Product.findByPk(granel_id, { transaction: t });
        if (!origem) throw new Error('Produto de origem não encontrado');
        if (!granel) throw new Error('Produto a granel não encontrado');
        if (origem.empresa_id !== granel.empresa_id) {
            throw new Error('Os produtos precisam pertencer à mesma empresa');
        }
        if (Number(granel.granel_origem_id) !== Number(origem.id)) {
            throw new Error('O produto a granel não está vinculado ao produto de origem');
        }

        const estoqueOrigem = Number(origem.currentQuantity);
        if (estoqueOrigem < quantidade_saida) {
            throw new Error(`Estoque insuficiente: "${origem.name}" tem ${estoqueOrigem}, precisa ${quantidade_saida}`);
        }

        const empId = empresaParaGravar(req.user) ?? origem.empresa_id ?? null;
        const userId = req.user?.id ?? null;

        await origem.update({ currentQuantity: estoqueOrigem - quantidade_saida }, { transaction: t });
        await Movimento.create({
            produto_id: origem.id,
            empresa_id: empId,
            usuario_id: userId,
            tipo: 'saida',
            quantidade: quantidade_saida,
            motivo: `Transferência para granel — ${granel.name}`,
            origem_tipo: 'granel_transferencia',
            origem_id: granel.id,
            data: new Date()
        }, { transaction: t });

        const estoqueGranel = Number(granel.currentQuantity);
        const qtdEntrada = Number(req.body.quantidade_entrada ?? quantidade_saida);
        if (!Number.isFinite(qtdEntrada) || qtdEntrada <= 0) {
            throw new Error('A quantidade de entrada no granel deve ser maior que zero');
        }
        await granel.update({ currentQuantity: estoqueGranel + qtdEntrada }, { transaction: t });
        await Movimento.create({
            produto_id: granel.id,
            empresa_id: empId,
            usuario_id: userId,
            tipo: 'entrada',
            quantidade: qtdEntrada,
            motivo: `Transferência de "${origem.name}"`,
            origem_tipo: 'granel_transferencia',
            origem_id: origem.id,
            data: new Date()
        }, { transaction: t });

        await t.commit();
        res.json({
            ok: true,
            origem: { id: origem.id, currentQuantity: estoqueOrigem - quantidade_saida },
            granel: { id: granel.id, currentQuantity: estoqueGranel + qtdEntrada },
        });
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
});

router.post('/', auth, createProduct);
router.get('/', auth, getProducts);
router.put('/:id', auth, updateProduct);
router.delete('/:id', auth, deleteProduct);

export default router;
