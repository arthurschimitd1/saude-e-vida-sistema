import WhatsappConfig from '../../models/WhatsappConfig.js';
import webhookService from '../../services/whatsappCrm/WebhookService.js';

// A Z-API não assina os webhooks — a única proteção é a própria URL conter
// o empresaId + um token secreto gerado ao salvar a configuração (ver
// ConfigService.gerarWebhookToken). Por isso não passa pelo middleware `auth`
// normal (a Z-API não tem um JWT de usuário do sistema).
async function validarEmpresa(req, res) {
    const { empresaId, webhookToken } = req.params;
    const config = await WhatsappConfig.findOne({ where: { empresa_id: empresaId } });
    if (!config || !config.webhook_token || config.webhook_token !== webhookToken) {
        res.status(401).json({ value: false, message: 'Webhook não autorizado' });
        return null;
    }
    return config;
}

class WebhookController {
    async mensagemRecebida(req, res) {
        try {
            const config = await validarEmpresa(req, res);
            if (!config) return;
            await webhookService.processarMensagemRecebida(config.empresa_id, req.body);
            res.status(200).json({ value: true });
        } catch (err) {
            console.error('[WhatsApp CRM] Erro no webhook de mensagem recebida:', err);
            res.status(200).json({ value: true }); // Z-API não deve reter/reenviar em loop por erro nosso
        }
    }

    async statusMensagem(req, res) {
        try {
            const config = await validarEmpresa(req, res);
            if (!config) return;
            await webhookService.processarStatusMensagem(config.empresa_id, req.body);
            res.status(200).json({ value: true });
        } catch (err) {
            console.error('[WhatsApp CRM] Erro no webhook de status de mensagem:', err);
            res.status(200).json({ value: true });
        }
    }
}

export default new WebhookController();
