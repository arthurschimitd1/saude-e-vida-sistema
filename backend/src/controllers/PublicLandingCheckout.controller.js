import asaasService from '../services/Asaas.service.js';

class PublicLandingCheckoutController {
  async create(req, res, next) {
    try {
      const result = await asaasService.createPublicLandingCheckout(req.body, req.header('Idempotency-Key'));
      res.status(201).json({ success: true, message: 'Checkout criado com sucesso', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new PublicLandingCheckoutController();
