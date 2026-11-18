import express from 'express';
import etiquetaController from '../../controllers/whatsappCrm/EtiquetaController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { etiquetaCatalogoSchema } from '../../validations/whatsappCrm/EtiquetaValidation.js';

const router = express.Router();

router.get('/', auth, etiquetaController.listar);
router.post('/', auth, validate(etiquetaCatalogoSchema), etiquetaController.criar);
router.put('/:id', auth, validate(etiquetaCatalogoSchema), etiquetaController.atualizar);
router.delete('/:id', auth, etiquetaController.remover);
router.delete('/vinculo/:vinculoId', auth, etiquetaController.removerDoCliente);
router.patch('/vinculo/:vinculoId/aceitar', auth, etiquetaController.aceitarSugestao);

export default router;
