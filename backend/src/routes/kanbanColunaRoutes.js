import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getColunas, createColuna, updateColuna, deleteColuna } from '../controllers/KanbanColunaController.js';

const router = Router();
router.get('/', auth, getColunas);
router.post('/', auth, createColuna);
router.put('/:id', auth, updateColuna);
router.delete('/:id', auth, deleteColuna);

export default router;
