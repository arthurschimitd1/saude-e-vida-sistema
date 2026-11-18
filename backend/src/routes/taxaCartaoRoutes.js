import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { listar, criar, atualizar } from '../controllers/TaxaCartaoController.js';

const router = Router();
router.use(auth);
router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);

export default router;
