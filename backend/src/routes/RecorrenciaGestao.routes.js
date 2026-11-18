import express from 'express';
import auth from '../middlewares/auth.js';
import controller from '../controllers/RecorrenciaGestao.controller.js';

const router = express.Router();
router.use(auth);

router.get('/dashboard', controller.dashboard);
router.get('/pagamentos', controller.pagamentos);
router.get('/configuracao', controller.configuracao);
router.put('/configuracao', controller.salvarConfiguracao);
router.get('/planos', controller.planos);
router.post('/planos', controller.criarPlano);
router.put('/planos/:id', controller.atualizarPlano);
router.delete('/planos/:id', controller.excluirPlano);
router.post('/:id/pausar', controller.pausar);
router.post('/:id/reativar', controller.reativar);
router.post('/:id/cancelar', controller.cancelar);
router.get('/:id/eventos', controller.eventos);
router.get('/pagamentos/:id/recibo', controller.recibo);
router.post('/pagamentos/:id/estorno', controller.estornar);

export default router;
