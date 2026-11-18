import express from 'express';
import configController from '../../controllers/whatsappCrm/ConfigController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { salvarConfigSchema } from '../../validations/whatsappCrm/ConfigValidation.js';

const router = express.Router();

router.get('/', auth, configController.buscar);
router.put('/', auth, validate(salvarConfigSchema), configController.salvar);
router.post('/testar', auth, configController.testar);
router.post('/testar-meta', auth, configController.testarMeta);

export default router;
