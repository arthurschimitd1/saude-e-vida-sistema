import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getProjetos,
    getProjetoById,
    createProjeto,
    updateProjeto,
    deleteProjeto
} from '../controllers/MarketingController.js';

const router = Router();

router.get('/', auth, getProjetos);
router.get('/:id', auth, getProjetoById);
router.post('/', auth, createProjeto);
router.put('/:id', auth, updateProjeto);
router.delete('/:id', auth, deleteProjeto);

export default router;
