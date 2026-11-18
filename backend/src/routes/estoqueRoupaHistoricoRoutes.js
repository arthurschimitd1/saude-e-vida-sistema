import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as controller from '../controllers/EstoqueRoupaHistoricoController.js';

const router = Router();

// Estas rotas ficam antes de /:id para não serem interpretadas como uma peça.
router.get('/movimentos', auth, controller.listarMovimentos);
router.get('/inventarios', auth, controller.listarInventarios);
router.post('/inventario/aplicar-lote', auth, controller.aplicarInventario);

export default router;
