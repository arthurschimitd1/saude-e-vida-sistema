import express from 'express';
import webhookController from '../../controllers/whatsappCrm/WebhookController.js';

// SEM middleware `auth` — a Z-API chama essas rotas diretamente, sem JWT.
// Protegido por empresaId + webhookToken na própria URL (ver WebhookController).
const router = express.Router();

router.post('/:empresaId/:webhookToken/mensagem-recebida', webhookController.mensagemRecebida);
router.post('/:empresaId/:webhookToken/status-mensagem', webhookController.statusMensagem);

export default router;
