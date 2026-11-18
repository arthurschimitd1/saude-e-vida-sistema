import express from 'express';
import lancamentoVinculoController from '../controllers/LancamentoVinculoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
router.use(auth);

router.get('/', lancamentoVinculoController.getAll);
router.get('/sem-vinculo', lancamentoVinculoController.semVinculo);
router.get('/saida/:saida_id', lancamentoVinculoController.getBySaida);
router.post('/', lancamentoVinculoController.upsert);
router.delete('/:id', lancamentoVinculoController.delete);

export default router;