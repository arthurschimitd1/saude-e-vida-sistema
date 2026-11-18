import { Router } from 'express';
import { listar, emitir, getById, consultar, cancelar, reenviarEmail } from '../controllers/ServiceInvoiceController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, listar);
router.post('/emitir', auth, emitir);
router.get('/:id', auth, getById);
router.get('/:id/consultar', auth, consultar);
router.delete('/:id/cancelar', auth, cancelar);
router.post('/:id/email', auth, reenviarEmail);

export default router;
