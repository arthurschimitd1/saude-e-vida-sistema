import nuvemshopService, { getFrontendBase } from '../services/Nuvemshop.service.js';
import ApiResponse from '../utils/apiResponse.js';

const redirectResult = (res, status, message = '') => {
  const url = new URL('/uikit/estoque-roupas', `${getFrontendBase()}/`);
  url.searchParams.set('nuvemshop', status);
  if (message) url.searchParams.set('motivo', message);
  return res.redirect(302, url.toString());
};

class NuvemshopController {
  async status(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.getStatus(req.user)); }
    catch (error) { next(error); }
  }

  async connect(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.startConnection(req.user)); }
    catch (error) { next(error); }
  }

  async callback(req, res) {
    try {
      await nuvemshopService.finishConnection(req.query);
      return redirectResult(res, 'connected');
    } catch (error) {
      console.error('[Nuvemshop] Callback recusado:', error.message);
      return redirectResult(res, 'error', error.statusCode >= 500 ? 'Falha temporária na autorização' : error.message);
    }
  }

  async disconnect(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.disconnect(req.user), 'Integração desconectada'); }
    catch (error) { next(error); }
  }

  async pull(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.pullCatalog(req.user, req.body), 'Lote do estoque atualizado pela Nuvemshop'); }
    catch (error) { next(error); }
  }

  async push(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.pushCatalog(req.user), 'Estoque enviado para a Nuvemshop'); }
    catch (error) { next(error); }
  }

  async registerWebhooks(req, res, next) {
    try { new ApiResponse(res).success(200, await nuvemshopService.registerWebhooks(req.user), 'Webhooks da Nuvemshop conferidos'); }
    catch (error) { next(error); }
  }

  async storeRedact(req, res, next) {
    try { res.status(200).json(await nuvemshopService.handleRequiredWebhook(req, 'store-redact')); }
    catch (error) { next(error); }
  }

  async customersRedact(req, res, next) {
    try { res.status(200).json(await nuvemshopService.handleRequiredWebhook(req, 'customers-redact')); }
    catch (error) { next(error); }
  }

  async customersDataRequest(req, res, next) {
    try { res.status(200).json(await nuvemshopService.handleRequiredWebhook(req, 'customers-data-request')); }
    catch (error) { next(error); }
  }

  async events(req, res, next) {
    try { res.status(200).json(await nuvemshopService.handleEventWebhook(req)); }
    catch (error) { next(error); }
  }
}

export default new NuvemshopController();
