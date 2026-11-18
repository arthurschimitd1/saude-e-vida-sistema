import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getTarefas,
    getTarefaById,
    createTarefa,
    updateTarefa,
    deleteTarefa
} from '../controllers/TarefaController.js';

const router = Router();

router.get('/', auth, getTarefas);
router.get('/:id', auth, getTarefaById);
router.post('/', auth, createTarefa);
router.put('/:id', auth, updateTarefa);
router.delete('/:id', auth, deleteTarefa);

export default router;
