import { Router } from 'express';
import {
  createInventario,
  aplicarLoteInventario,
  getInventarios,
  getInventarioById,
  deleteInventario
} from '../controllers/InventarioController.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  createInventarioSchema,
  aplicarLoteSchema
} from '../validations/InventarioValidation.js';

const router = Router();

// Todas as rotas exigem autenticação
router.post('/', auth, validate(createInventarioSchema), createInventario);
router.post('/aplicar-lote', auth, validate(aplicarLoteSchema), aplicarLoteInventario);
router.get('/', auth, getInventarios);
router.get('/:id', auth, getInventarioById);
router.delete('/:id', auth, deleteInventario);

export default router;
