import express from 'express';
import departamentoController from '../controllers/DepartamentoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();
router.use(auth);

router.get('/', departamentoController.getAll);
router.post('/', departamentoController.create);
router.put('/:id', departamentoController.update);
router.delete('/:id', departamentoController.delete);

export default router;