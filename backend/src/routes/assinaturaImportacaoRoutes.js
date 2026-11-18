import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { listar, preview, importar } from '../controllers/AssinaturaImportacaoController.js';

const router = Router();
router.use(auth);
router.get('/dom-ferraz/manaira', listar);
router.post('/dom-ferraz/manaira/preview', preview);
router.post('/dom-ferraz/manaira/importar', importar);

export default router;
