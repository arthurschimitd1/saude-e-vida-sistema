import express from 'express';
import { listar, criar, atualizar, excluir, importarBulk, iniciar, pausar, retomar, finalizar, iniciarExtra } from '../controllers/AttendanceController.js';

const router = express.Router();

// Ações de jornada (ordem importa: específicas antes de genéricas)
router.post('/iniciar', iniciar);
router.post('/:id/pausar', pausar);
router.post('/:id/retomar', retomar);
router.post('/:id/finalizar', finalizar);
router.post('/:id/iniciar-extra', iniciarExtra);

// CRUD
router.get('/', listar);
router.post('/bulk', importarBulk);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', excluir);

export default router;
