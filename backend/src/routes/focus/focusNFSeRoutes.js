// src/routes/focus/nfse.js

import { Router } from 'express';
import NFSeController from '../../controllers/focus/NFSeController.js';
import auth from '../../middlewares/auth.js';

const router = Router();

router.use(auth);

// Emitir NFS-e
router.post('/emitir', NFSeController.emitir);

// Buscar por ID (registro local)
router.get('/:id', NFSeController.buscarPorId);

// Consultar situação na Focus
router.get('/:id/consultar', NFSeController.consultar);

// Cancelar
router.post('/:id/cancelar', NFSeController.cancelar);

// Reenviar e-mail
router.post('/:id/email', NFSeController.reenviarEmail);

// Listar
router.get('/', NFSeController.listar);

export default router;