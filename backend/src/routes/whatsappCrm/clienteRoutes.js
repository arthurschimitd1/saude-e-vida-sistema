import express from 'express';
import clienteCrmController from '../../controllers/whatsappCrm/ClienteCrmController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { observacaoSchema, etiquetaSchema, estagioSchema, motivoClinicoSchema, profissionalSchema } from '../../validations/whatsappCrm/ClienteCrmValidation.js';

const router = express.Router();

router.get('/telefone/:telefone', auth, clienteCrmController.buscarPorTelefone);
router.post('/:id/observacoes', auth, validate(observacaoSchema), clienteCrmController.adicionarObservacao);
router.post('/:id/etiquetas', auth, validate(etiquetaSchema), clienteCrmController.adicionarEtiqueta);
router.patch('/:id/estagio', auth, validate(estagioSchema), clienteCrmController.atualizarEstagio);
router.patch('/:id/motivo-clinico', auth, validate(motivoClinicoSchema), clienteCrmController.atualizarMotivoClinico);
router.patch('/:id/profissional', auth, validate(profissionalSchema), clienteCrmController.atualizarProfissional);

export default router;
