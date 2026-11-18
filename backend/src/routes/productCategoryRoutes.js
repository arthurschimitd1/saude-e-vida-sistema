import { Router } from 'express';
import { listar, criar, atualizar, deletar } from '../controllers/productCategoryController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, listar);
router.post('/', auth, criar);
router.put('/:id', auth, atualizar);
router.delete('/:id', auth, deletar);

export default router;
