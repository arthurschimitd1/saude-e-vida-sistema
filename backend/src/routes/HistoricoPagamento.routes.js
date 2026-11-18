import express from 'express';
import historicoPagamentoController from '../controllers/HistoricoPagamento.controller.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.use(auth);

router.get('/recorrencia/:recorrenciaId', historicoPagamentoController.getHistorico);

export default router;
