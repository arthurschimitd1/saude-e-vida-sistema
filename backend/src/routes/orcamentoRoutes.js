import { Router } from 'express';
import {
    createOrcamento,
    updateOrcamento,
    getOrcamentos,
    getOrcamentoById,
    deleteOrcamento
} from '../controllers/OrcamentoController.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { createOrcamentoSchema, updateOrcamentoSchema } from '../validations/OrcamentoValidation.js';

const router = Router();

router.post('/', auth, validate(createOrcamentoSchema), createOrcamento);
router.put('/:id', auth, validate(updateOrcamentoSchema), updateOrcamento);
router.get('/', auth, getOrcamentos);
router.get('/:id', auth, getOrcamentoById);
router.delete('/:id', auth, deleteOrcamento);

export default router;
