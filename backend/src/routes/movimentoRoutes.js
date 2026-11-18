import { Router } from 'express';
import { getMovimentos, deleteMovimento } from '../controllers/MovimentoController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, getMovimentos);
router.delete('/:id', auth, deleteMovimento);

export default router;
