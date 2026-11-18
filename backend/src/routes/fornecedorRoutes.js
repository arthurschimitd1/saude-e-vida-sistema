import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import fornecedorController from '../controllers/FornecedorController.js';
import {
    createFornecedorSchema,
    fornecedorIdSchema,
    updateFornecedorSchema
} from '../validations/FornecedorValidation.js';

const router = Router();

router.get('/', auth, fornecedorController.listar);
router.get('/sugestoes/xml', auth, fornecedorController.listarSugestoesXml);
router.get('/:id', auth, validate(fornecedorIdSchema), fornecedorController.buscarPorId);
router.post('/', auth, validate(createFornecedorSchema), fornecedorController.criar);
router.put('/:id', auth, validate(updateFornecedorSchema), fornecedorController.atualizar);
router.delete('/:id', auth, validate(fornecedorIdSchema), fornecedorController.excluir);

export default router;
