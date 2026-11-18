import express from 'express';
import AutomacaoController from '../controllers/AutomacaoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.use(auth);

router.get('/notificacoes', AutomacaoController.getNotificacoes);
router.patch('/notificacoes/:id/lida', AutomacaoController.marcarLida);
router.get('/resumo', AutomacaoController.getResumo);
router.get('/templates', AutomacaoController.getTemplates);
router.get('/', AutomacaoController.getAll);
router.get('/:id/historico', AutomacaoController.getHistorico);
router.get('/:id', AutomacaoController.getById);
router.post('/', AutomacaoController.create);
router.post('/:id/duplicar', AutomacaoController.duplicar);
router.put('/:id', AutomacaoController.update);
router.patch('/:id/toggle', AutomacaoController.toggleStatus);
router.delete('/:id', AutomacaoController.delete);

export default router;