import WhatsappConfig from '../../models/WhatsappConfig.js';
import metaWebhookService from '../../services/whatsappCrm/MetaWebhookService.js';
import { decryptCredential } from '../../utils/credentialCrypto.js';

function credencial(value) {
    if (!value) return null;
    try { return decryptCredential(value); } catch { return value; }
}

async function buscarConfig(req, res) {
    const config = await WhatsappConfig.findOne({ where: { empresa_id: req.params.empresaId } });
    if (!config || !config.meta_webhook_token || config.meta_webhook_token !== req.params.webhookToken) {
        res.status(401).json({ message: 'Webhook Meta não autorizado' });
        return null;
    }
    return config;
}

class MetaWebhookController {
    async verificar(req, res) {
        const config = await buscarConfig(req, res);
        if (!config) return;
        const modo = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const desafio = req.query['hub.challenge'];
        if (modo === 'subscribe' && token && token === credencial(config.meta_verify_token)) {
            res.status(200).send(String(desafio || ''));
            return;
        }
        res.status(403).send('Token de verificação inválido');
    }

    async receber(req, res) {
        try {
            const config = await buscarConfig(req, res);
            if (!config) return;
            const assinatura = req.headers['x-hub-signature-256'];
            if (!metaWebhookService.validarAssinatura(config, req.rawBody, assinatura)) {
                res.status(401).json({ message: 'Assinatura do webhook Meta inválida' });
                return;
            }
            const resumo = await metaWebhookService.processar(config, req.body);
            res.status(200).json({ received: true, ...resumo });
        } catch (error) {
            console.error('[WhatsApp Meta] Erro no webhook:', error);
            res.status(500).json({ received: false });
        }
    }
}

export default new MetaWebhookController();
