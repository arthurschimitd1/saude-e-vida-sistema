import { Router } from 'express';
import { listar, criar, getById, atualizar, deletar, toggleAtivo } from '../controllers/ServiceController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, listar);
router.post('/', auth, criar);
router.get('/:id', auth, getById);
router.put('/:id', auth, atualizar);
router.delete('/:id', auth, deletar);
router.patch('/:id/toggle-ativo', auth, toggleAtivo);

export default router;
