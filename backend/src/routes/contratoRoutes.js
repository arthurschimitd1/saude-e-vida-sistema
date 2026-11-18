import express from 'express';
import multer from 'multer';
import contratoController from '../controllers/ContratoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', auth, upload.single('anexo'), contratoController.create);
router.get('/', auth, contratoController.getAll);
router.get('/:id/historico', auth, contratoController.getHistorico);
router.get('/:id/anexo', auth, contratoController.downloadAnexo);
router.get('/:id', auth, contratoController.getById);
router.put('/:id', auth, upload.single('anexo'), contratoController.update);
router.delete('/:id', auth, contratoController.delete);

export default router;