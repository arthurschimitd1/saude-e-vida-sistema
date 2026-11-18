import { Router } from 'express';
import { getStatus, iniciarConexao, desconectar } from '../../services/crm/WhatsAppService.js';
import whatsappController from '../../controllers/crm/WhatsappInboxController.js';
import auth from '../../middlewares/auth.js';

const router = Router();

router.get('/webhook/:instanceId/:secret', whatsappController.webhookCheck);
router.post('/webhook/:instanceId/:secret', whatsappController.webhook);
router.get('/config', auth, whatsappController.config);
router.put('/config', auth, whatsappController.saveConfig);
router.get('/integration/status', auth, whatsappController.status);
router.get('/integration/qrcode', auth, whatsappController.qrCode);
router.post('/integration/sync-chats', auth, whatsappController.syncChats);
router.get('/agents', auth, whatsappController.agents);
router.get('/conversations', auth, whatsappController.conversations);
router.post('/conversations', auth, whatsappController.createConversation);
router.post('/conversations/bulk-send', auth, whatsappController.bulkSend);
router.get('/conversations/:id/messages', auth, whatsappController.messages);
router.post('/conversations/:id/messages', auth, whatsappController.send);
router.patch('/conversations/:id', auth, whatsappController.update);

// Compatibilidade com o disparo legado da tela de prospecção.
router.get('/status', auth, (req, res) => res.json(getStatus()));

// Inicia conexão / gera QR
router.post('/connect', auth, async (req, res) => {
    try {
        await iniciarConexao();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Desconecta e limpa sessão (permite trocar de celular)
router.post('/disconnect', auth, async (req, res) => {
    try {
        await desconectar();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Envia mensagens aleatórias para lista de prospects
router.post('/enviar-lote', auth, whatsappController.sendProspectsBatch);

export default router;
