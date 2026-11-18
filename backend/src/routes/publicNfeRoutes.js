import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { visualizarDANFEPublico } from '../controllers/PublicNFeController.js';

const router = Router();

const publicNfeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

router.use(publicNfeLimiter);
router.get('/:token', visualizarDANFEPublico);
// Mantém compatibilidade com links que possam ter sido gerados com o sufixo /pdf.
router.get('/:token/pdf', visualizarDANFEPublico);

export default router;
