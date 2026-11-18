import { Router } from 'express';

import AuditoriaFiscalController from '../../controllers/inteligencia-fiscal/AuditoriaFiscalController.js';

const router = Router();

router.get('/dashboard', AuditoriaFiscalController.obterDashboard);
router.get('/', AuditoriaFiscalController.listar);
router.get('/:id', AuditoriaFiscalController.buscarDetalhes);

router.post('/', AuditoriaFiscalController.executarPeriodo);
router.post('/nota/:notaFiscalId', AuditoriaFiscalController.executarNota);

export default router;