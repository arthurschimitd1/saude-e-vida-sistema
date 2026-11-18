import express from 'express';
import catalogoController from '../../controllers/whatsappCrm/CatalogoController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { tipoCatalogoParamSchema, catalogoItemSchema } from '../../validations/whatsappCrm/CatalogoValidation.js';

const router = express.Router();

router.get('/:tipo', auth, validate(tipoCatalogoParamSchema), catalogoController.listar);
router.post('/:tipo', auth, validate(catalogoItemSchema), catalogoController.criar);
router.put('/:tipo/:id', auth, validate(catalogoItemSchema), catalogoController.atualizar);
router.delete('/:tipo/:id', auth, validate(tipoCatalogoParamSchema), catalogoController.remover);

export default router;
