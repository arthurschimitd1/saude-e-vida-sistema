import whatsAppBot from '../../services/crm/WhatsAppBotService.js';
import CrmProspect from '../../models/CrmProspect.js';
import ApiResponse from '../../utils/apiResponse.js';

class WhatsAppController {
    async status(req, res, next) {
        try {
            const status = whatsAppBot.getStatus();
            new ApiResponse(res).success(200, status);
        } catch (err) { next(err); }
    }

    async conectar(req, res, next) {
        try {
            whatsAppBot.conectar();
            new ApiResponse(res).success(200, null, 'Conectando ao WhatsApp...');
        } catch (err) { next(err); }
    }

    async desconectar(req, res, next) {
        try {
            whatsAppBot.desconectar();
            new ApiResponse(res).success(200, null, 'WhatsApp desconectado');
        } catch (err) { next(err); }
    }

    async enviarParaCampanha(req, res, next) {
        try {
            const { campaign_id, script, delay = 3000 } = req.body;

            if (!campaign_id || !script) {
                return res.status(400).json({ success: false, message: 'campaign_id e script são obrigatórios' });
            }

            const prospects = await CrmProspect.findAll({
                where: { campaign_id },
                raw: true,
            });

            const comTelefone = prospects.filter(p => p.phone);

            if (comTelefone.length === 0) {
                return res.status(400).json({ success: false, message: 'Nenhum prospect com telefone nesta campanha' });
            }

            const resultados = await whatsAppBot.enviarParaProspects(comTelefone, script, delay);

            const enviados = resultados.filter(r => r.status === 'enviado').length;
            const erros    = resultados.filter(r => r.status === 'erro').length;

            new ApiResponse(res).success(200, resultados, `${enviados} mensagem(ns) enviada(s), ${erros} erro(s)`);
        } catch (err) { next(err); }
    }
}

export default new WhatsAppController();
