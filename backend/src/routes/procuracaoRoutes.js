import express from 'express';
import multer from 'multer';
import ProcuracaoController from '../controllers/ProcuracaoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', auth, ProcuracaoController.getAll);
router.get('/:id/anexo', auth, ProcuracaoController.downloadAnexo);
router.get('/:id', auth, ProcuracaoController.getById);
router.post('/', auth, upload.single('anexo'), ProcuracaoController.create);
router.put('/:id', auth, upload.single('anexo'), ProcuracaoController.update);
router.patch('/:id/revogar', auth, ProcuracaoController.revogar);
router.delete('/:id', auth, ProcuracaoController.deleteProcuracao);

export default router;