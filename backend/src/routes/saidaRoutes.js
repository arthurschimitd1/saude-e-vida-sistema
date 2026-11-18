import express from 'express';
import multer from 'multer';
import saidaController from '../controllers/SaidaController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);

router.get('/', saidaController.getAll);
router.get('/:id/comprovante', saidaController.downloadComprovante);
router.post('/', upload.single('comprovante'), saidaController.create);
router.put('/:id', upload.single('comprovante'), saidaController.update);
router.patch('/:id/pagar', saidaController.marcarPago);
router.delete('/:id', saidaController.delete);

export default router;