import express from 'express';
import conversaController from '../../controllers/whatsappCrm/ConversaController.js';
import mensagemController from '../../controllers/whatsappCrm/MensagemController.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { uploadMensagemMidia } from '../../middlewares/upload.js';
import { statusSchema, responsavelSchema, mensagemSchema, iniciarConversaSchema, renomearContatoSchema, editarMensagemSchema } from '../../validations/whatsappCrm/ConversaValidation.js';

const router = express.Router();

router.get('/', auth, conversaController.listar);
router.post('/', auth, validate(iniciarConversaSchema), conversaController.iniciar);
router.get('/:id', auth, conversaController.buscarPorId);
router.patch('/:id/status', auth, validate(statusSchema), conversaController.atualizarStatus);
router.patch('/:id/responsavel', auth, validate(responsavelSchema), conversaController.atribuirResponsavel);
router.patch('/:id/nome', auth, validate(renomearContatoSchema), conversaController.renomear);
router.post('/:id/marcar-lida', auth, conversaController.marcarComoLida);
router.post('/:id/analisar-ia', auth, conversaController.analisarComIA);
router.post('/:id/avaliar-agendamento', auth, conversaController.avaliarAgendamento);

router.get('/:id/mensagens', auth, mensagemController.listar);
router.post('/:id/mensagens', auth, uploadMensagemMidia, validate(mensagemSchema), mensagemController.enviar);
router.patch('/:id/mensagens/:mensagemId', auth, validate(editarMensagemSchema), mensagemController.editar);
router.post('/:id/mensagens/:mensagemId/reenviar', auth, mensagemController.reenviar);
router.post('/:id/mensagens/:mensagemId/transcrever', auth, mensagemController.transcrever);

export default router;
