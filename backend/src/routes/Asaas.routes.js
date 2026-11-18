import express from 'express';
import auth from '../middlewares/auth.js';
import controller from '../controllers/Asaas.controller.js';

const router = express.Router();
router.get('/config', auth, controller.getConfig);
router.put('/config', auth, controller.saveConfig);
router.post('/recorrencias/:id/assinatura', auth, controller.createSubscription);
router.post('/recorrencias/:id/link', auth, controller.createPaymentLink);
router.post('/recorrencias/:id/checkout', auth, controller.createCheckout);
router.get('/recorrencias/:id/checkout', auth, controller.getCheckout);
router.post('/recorrencias/:id/checkout/regenerate', auth, controller.regenerateCheckout);
router.get('/recorrencias/:id/cobrancas', auth, controller.listPayments);
router.post('/webhook/:empresaId', controller.webhook);
router.post('/webhook/public/:publicId', controller.publicWebhook);
router.get('/checkout/callback/:status', controller.checkoutCallback);
export default router;
