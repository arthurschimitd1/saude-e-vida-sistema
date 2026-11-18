import express from 'express';
import clienteController from '../controllers/ClienteController.js';
import validate from '../middlewares/validate.js';
import { createClienteSchema, updateClienteSchema } from '../validations/ClienteValidation.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.post('/', auth, validate(createClienteSchema), clienteController.create);
router.get('/', auth, clienteController.getAll);
router.get('/:id', auth, clienteController.getById);
router.put('/:id', auth, validate(updateClienteSchema), clienteController.update);
router.delete('/:id', auth, clienteController.delete);

export default router;