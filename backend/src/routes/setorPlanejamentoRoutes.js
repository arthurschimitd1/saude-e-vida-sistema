import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getSetores, createSetor, updateSetor, deleteSetor } from '../controllers/SetorPlanejamentoController.js';

const router = Router();
router.get('/', auth, getSetores);
router.post('/', auth, createSetor);
router.put('/:id', auth, updateSetor);
router.delete('/:id', auth, deleteSetor);

export default router;
