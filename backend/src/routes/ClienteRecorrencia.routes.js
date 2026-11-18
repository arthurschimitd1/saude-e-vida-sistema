// backend/src/routes/ClienteRecorrencia.routes.js
import express from 'express';
import clienteRecorrenciaController from '../controllers/ClienteRecorrencia.controller.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
router.use(auth);

router.get('/clientes-recorrencias', clienteRecorrenciaController.getClientesComRecorrencias);
router.get('/dashboard-faturamento', clienteRecorrenciaController.getDashboardFaturamento);
router.get('/buscar-cliente', clienteRecorrenciaController.buscarCliente);

router.get('/cliente/:clienteId/recorrencias', clienteRecorrenciaController.getRecorrenciasPorCliente);

export default router;
