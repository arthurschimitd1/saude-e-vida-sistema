import express from 'express';
import rateLimit from 'express-rate-limit';
import maiaController from '../controllers/MaiaController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

const maiaLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente novamente.',
    },
});

router.post('/chat', auth, maiaLimiter, maiaController.chat);
router.post('/confirmar', auth, maiaLimiter, maiaController.confirmar);

export default router;
