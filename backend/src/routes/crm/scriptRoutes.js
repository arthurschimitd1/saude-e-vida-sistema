import express from 'express';
import scriptController from '../../controllers/crm/ScriptController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/',          auth, scriptController.listar);
router.post('/',         auth, scriptController.criar);
router.post('/gerar',    auth, scriptController.gerar);
router.put('/:id',       auth, scriptController.atualizar);
router.delete('/:id',    auth, scriptController.deletar);

export default router;
