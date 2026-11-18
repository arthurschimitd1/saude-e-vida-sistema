import { Router } from 'express';
import * as financeiroController from '../controllers/financeiroController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.use(auth);

// Resumo financeiro
router.get('/resumo', financeiroController.getResumo);

// Dashboard consolidado (KPIs + série mensal)
router.get('/dashboard', financeiroController.getDashboard);

// Comparativo CMV Financeiro x Real x Teórico
router.get('/cmv', financeiroController.getCMV);

// Entradas consolidadas (vendas + recorrências + lançamentos manuais)
router.get('/entradas', financeiroController.listarEntradas);

// Saídas consolidadas (lançamentos manuais + folha de pagamento + recorrências)
router.get('/saidas-consolidado', financeiroController.listarSaidasConsolidado);

// Vendas
router.get('/vendas/ultima-compra', financeiroController.ultimaCompraPorCliente);
router.get('/vendas', financeiroController.listarVendas);

// Saídas (lançamentos manuais — CRUD)
router.get('/saidas', financeiroController.listarSaidas);
router.post('/saidas', financeiroController.criarSaida);
router.put('/saidas/:id', financeiroController.atualizarSaida);
router.delete('/saidas/:id', financeiroController.deletarSaida);

export default router;
