import { Router } from 'express';
import {
    createVenda,
    getVendas,
    getVendaById,
    deleteVenda,
    updateVenda
} from '../controllers/VendaController.js';
import { consultarRankingCaixa } from '../controllers/RankingCaixaController.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { createVendaSchema } from '../validations/VendaValidation.js';

const router = Router();

router.post('/', auth, validate(createVendaSchema), createVenda);
router.get('/', auth, getVendas);
router.get('/ranking-caixa', auth, consultarRankingCaixa);
router.get('/:id', auth, getVendaById);
router.put('/:id', auth, updateVenda);
router.delete('/:id', auth, deleteVenda);

export default router;
