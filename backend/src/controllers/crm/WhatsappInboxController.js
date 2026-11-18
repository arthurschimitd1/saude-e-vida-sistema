import whatsappCrmService from '../../services/crm/WhatsappCrmService.js';
import ApiResponse from '../../utils/apiResponse.js';

class WhatsappInboxController {
    async config(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.getConfig(req.user)); } catch (error) { next(error); } }
    async saveConfig(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.saveConfig(req.body, req.user), 'Integração Z-API configurada'); } catch (error) { next(error); } }
    async status(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.getStatus(req.user)); } catch (error) { next(error); } }
    async qrCode(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.getQrCode(req.user)); } catch (error) { next(error); } }
    async syncChats(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.syncChats(req.user), 'Conversas sincronizadas'); } catch (error) { next(error); } }
    async agents(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.listAgents(req.user)); } catch (error) { next(error); } }
    async conversations(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.listConversations(req.query, req.user)); } catch (error) { next(error); } }
    async createConversation(req, res, next) { try { new ApiResponse(res).success(201, await whatsappCrmService.createConversation(req.body, req.user), 'Conversa criada'); } catch (error) { next(error); } }
    async messages(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.getMessages(req.params.id, req.user)); } catch (error) { next(error); } }
    async send(req, res, next) { try { new ApiResponse(res).success(201, await whatsappCrmService.sendText(req.params.id, req.body.content, req.user), 'Mensagem enviada'); } catch (error) { next(error); } }
    async bulkSend(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.bulkSend(req.body, req.user), 'Disparo concluído'); } catch (error) { next(error); } }
    async sendProspectsBatch(req, res, next) { try { res.json({ resultados: await whatsappCrmService.sendProspectsBatch(req.body, req.user) }); } catch (error) { next(error); } }
    async update(req, res, next) { try { new ApiResponse(res).success(200, await whatsappCrmService.updateConversation(req.params.id, req.body, req.user)); } catch (error) { next(error); } }
    async webhookCheck(req, res, next) { try { res.status(200).json({ value: true, message: 'Webhook LucroMais ativo. A Z-API deve enviar mensagens por POST para esta URL.' }); } catch (error) { next(error); } }
    async webhook(req, res, next) { try { await whatsappCrmService.handleWebhook(req.params.instanceId, req.params.secret, req.body); res.status(200).json({ value: true }); } catch (error) { next(error); } }
}

export default new WhatsappInboxController();
