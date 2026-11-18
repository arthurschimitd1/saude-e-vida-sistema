import asaasService from '../services/Asaas.service.js';
import ApiResponse from '../utils/apiResponse.js';

class AsaasController {
  async getConfig(req, res, next) { try { new ApiResponse(res).success(200, await asaasService.getConfig(req.user)); } catch (error) { next(error); } }
  async saveConfig(req, res, next) { try { new ApiResponse(res).success(200, await asaasService.saveConfig(req.body, req.user), 'Asaas configurado com sucesso'); } catch (error) { next(error); } }
  async createSubscription(req, res, next) { try { new ApiResponse(res).success(201, await asaasService.createSubscription(req.params.id, req.user), 'Assinatura criada no Asaas'); } catch (error) { next(error); } }
  async createPaymentLink(req, res, next) { try { new ApiResponse(res).success(201, await asaasService.createPaymentLink(req.params.id, req.user, req.body), 'Link recorrente criado'); } catch (error) { next(error); } }
  async createCheckout(req, res, next) { try { new ApiResponse(res).success(201, await asaasService.createCheckout(req.params.id, req.user, req.header('Idempotency-Key')), 'Checkout seguro criado'); } catch (error) { next(error); } }
  async getCheckout(req, res, next) { try { new ApiResponse(res).success(200, await asaasService.getCheckout(req.params.id, req.user)); } catch (error) { next(error); } }
  async regenerateCheckout(req, res, next) { try { new ApiResponse(res).success(201, await asaasService.regenerateCheckout(req.params.id, req.user, req.header('Idempotency-Key')), 'Novo Checkout criado'); } catch (error) { next(error); } }
  async listPayments(req, res, next) { try { new ApiResponse(res).success(200, await asaasService.listPayments(req.params.id, req.user)); } catch (error) { next(error); } }
  async webhook(req, res) {
    try { await asaasService.processWebhook(Number(req.params.empresaId), req); res.status(200).json({ received: true }); }
    catch (error) { const status = /não autorizado|não configurado/.test(error.message) ? 401 : 200; res.status(status).json({ received: status === 200, message: status === 200 ? 'Evento recebido' : error.message }); }
  }
  async publicWebhook(req, res) {
    try { await asaasService.processWebhookByPublicId(req.params.publicId, req); res.status(200).json({ received: true }); }
    catch (error) { const status = /não autorizado|não configurado/.test(error.message) ? 401 : 200; res.status(status).json({ received: status === 200, message: status === 200 ? 'Evento recebido' : error.message }); }
  }
  async checkoutCallback(req, res) { asaasService.checkoutCallback(req.params.status, res); }
}
export default new AsaasController();
