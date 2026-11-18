import { Router } from 'express';

import auditoriaFiscalRoutes from './auditoriaFiscalRoutes.js';
import inconsistenciaFiscalRoutes from './inconsistenciaFiscalRoutes.js';

const router = Router();

router.use('/auditorias', auditoriaFiscalRoutes);
router.use('/inconsistencias', inconsistenciaFiscalRoutes);

export default router;