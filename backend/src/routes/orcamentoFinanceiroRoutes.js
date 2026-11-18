import express from 'express';
import orcamentoFinanceiroController from '../controllers/OrcamentoFinanceiroController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
router.use(auth);

router.get('/', orcamentoFinanceiroController.getByPeriodo);
router.get('/historico', orcamentoFinanceiroController.getHistorico);
router.post('/', orcamentoFinanceiroController.upsert);
router.delete('/:id', orcamentoFinanceiroController.delete);

export default router;