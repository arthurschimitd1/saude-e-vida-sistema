import { Router } from 'express';
import { 
  createRawMaterial, 
  getRawMaterials, 
  getRawMaterialById, 
  updateRawMaterial, 
  deleteRawMaterial 
} from '../controllers/RawMaterial.js';
import {
  listarEntradasSemNota,
  registrarEntradaSemNota
} from '../controllers/EntradaInsumoSemNotaController.js';
import validate from '../middlewares/validate.js';
import { createRawMaterialSchema, updateRawMaterialSchema } from '../validations/RawMaterialValidation.js';
import auth from '../middlewares/auth.js';

const router = Router();

// Todas as rotas precisam de autenticação
router.post('/', auth, validate(createRawMaterialSchema), createRawMaterial);
router.get('/', auth, getRawMaterials);
router.get('/:id/entradas-sem-nf', auth, listarEntradasSemNota);
router.post('/:id/entradas-sem-nf', auth, registrarEntradaSemNota);
router.get('/:id', auth, getRawMaterialById);
router.put('/:id', auth, validate(updateRawMaterialSchema), updateRawMaterial);
router.delete('/:id', auth, deleteRawMaterial);

export default router;
