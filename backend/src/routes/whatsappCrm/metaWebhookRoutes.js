import express from 'express';
import metaWebhookController from '../../controllers/whatsappCrm/MetaWebhookController.js';

const router = express.Router();

router.get('/:empresaId/:webhookToken', metaWebhookController.verificar);
router.post('/:empresaId/:webhookToken', metaWebhookController.receber);

export default router;
