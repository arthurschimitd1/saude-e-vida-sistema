import express from 'express';
import campanhaController from '../../controllers/crm/CampanhaController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import uploadPlanilha from '../../middlewares/uploadPlanilha.js';
import { createCampanhaSchema, updateCampanhaSchema } from '../../validations/crm/CampanhaValidation.js';

const router = express.Router();

router.get('/',        auth, campanhaController.listar);
router.get('/:id',     auth, campanhaController.buscarPorId);
router.post('/',       auth, validate(createCampanhaSchema), campanhaController.criar);
router.put('/:id',     auth, validate(updateCampanhaSchema), campanhaController.atualizar);
router.delete('/:id',  auth, campanhaController.deletar);
router.post('/:id/buscar-empresas',   auth, campanhaController.buscarEmpresas);
router.post('/:id/importar-planilha', auth, uploadPlanilha.single('file'), campanhaController.importarPlanilha);

export default router;
