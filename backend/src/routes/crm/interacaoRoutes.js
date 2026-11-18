import express from 'express';
import interacaoController from '../../controllers/crm/InteracaoController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/',     auth, interacaoController.listar);
router.post('/',    auth, interacaoController.criar);
router.delete('/:id', auth, interacaoController.deletar);

export default router;
