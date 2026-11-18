import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getEventos,
    getProximos,
    createEvento,
    updateEvento,
    deleteEvento
} from '../controllers/CalendarioController.js';

const router = Router();

router.get('/', auth, getEventos);
router.get('/proximos', auth, getProximos);
router.post('/', auth, createEvento);
router.put('/:id', auth, updateEvento);
router.delete('/:id', auth, deleteEvento);

export default router;
