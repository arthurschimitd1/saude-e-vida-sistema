import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { getConfig, saveConfig } from '../controllers/EmpresaConfigFiscalController.js';
import validate from '../middlewares/validate.js';
import { configFiscalSchema } from '../validations/EmpresaConfigFiscalValidation.js';

const router = Router();
router.use(auth);

router.get('/:empresa_id', getConfig);
router.put('/:empresa_id', validate(configFiscalSchema), saveConfig);

export default router;