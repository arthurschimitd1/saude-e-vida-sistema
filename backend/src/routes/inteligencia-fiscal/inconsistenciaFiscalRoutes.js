import { Router } from 'express';

import InconsistenciaFiscalController from '../../controllers/inteligencia-fiscal/InconsistenciaFiscalController.js';

const router = Router();

router.get('/resumo', InconsistenciaFiscalController.obterResumo);
router.get('/', InconsistenciaFiscalController.listar);
router.get('/:id', InconsistenciaFiscalController.buscarDetalhes);

router.patch('/:id/status', InconsistenciaFiscalController.alterarStatus);
router.patch('/:id/resolver', InconsistenciaFiscalController.resolver);
router.patch('/:id/responsavel', InconsistenciaFiscalController.atribuirResponsavel);
router.patch('/:id/prazo', InconsistenciaFiscalController.definirPrazo);

export default router;