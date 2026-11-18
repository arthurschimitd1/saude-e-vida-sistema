import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import controller from '../controllers/PublicLandingCheckout.controller.js';

const router = Router();

const landingCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/', landingCheckoutLimiter, controller.create);

export default router;
