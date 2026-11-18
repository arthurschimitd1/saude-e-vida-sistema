import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  emitirNFCe,
  emitirNFe,
  consultarNota,
  cancelarNota,
  enviarEmailNota,
  getAllNotas,
  importarNotasFocus,
} from '../controllers/NotaFiscalController.js';
import validate from '../middlewares/validate.js';
import { emitirNotaSchema, cancelarNotaSchema, emailNotaSchema } from '../validations/NotaFiscalValidation.js';

const router = Router();

router.use(auth);

router.get('/', getAllNotas);
router.post('/importar', importarNotasFocus);
router.post('/nfce', validate(emitirNotaSchema), emitirNFCe);
router.post('/nfe', validate(emitirNotaSchema), emitirNFe);
router.get('/:id', consultarNota);
router.delete('/:id', validate(cancelarNotaSchema), cancelarNota);
router.post('/:id/email', validate(emailNotaSchema), enviarEmailNota);

export default router;