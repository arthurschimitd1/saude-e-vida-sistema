// backend/src/routes/RecorrenciaRoutes.js
import express from 'express';
import recorrenciaController from '../controllers/Recorrencia.controller.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(auth);

// CRUD básico
router.post('/', recorrenciaController.create);
router.get('/', recorrenciaController.getAll);
router.get('/:id', recorrenciaController.getById);
router.put('/:id', recorrenciaController.update);
router.delete('/:id', recorrenciaController.delete);

// Rotas específicas
router.patch('/:id/toggle-status', recorrenciaController.toggleStatus);
router.post('/:id/confirmar-pagamento', recorrenciaController.confirmarPagamento);

export default router;
