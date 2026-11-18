import express from 'express';
import prospectController from '../../controllers/crm/ProspectController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { createProspectSchema, updateProspectSchema } from '../../validations/crm/ProspectValidation.js';

const router = express.Router();

router.get('/',              auth, prospectController.listar);
router.get('/:id',           auth, prospectController.buscarPorId);
router.post('/',             auth, validate(createProspectSchema), prospectController.criar);
router.put('/:id',           auth, validate(updateProspectSchema), prospectController.atualizar);
router.patch('/:id/status',  auth, prospectController.atualizarStatus);
router.delete('/:id',        auth, prospectController.deletar);
router.post('/:id/enriquecer', auth, prospectController.enriquecer);

export default router;
