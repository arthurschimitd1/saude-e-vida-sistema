import express from 'express';
import rateLimit from 'express-rate-limit';
import userController from '../controllers/UserController.js';
import googleAuthController from '../controllers/GoogleAuthController.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
});

// Rotas existentes com rate limit adicionado
router.post('/login', authLimiter, userController.login);
router.post('/verificar-senha', authLimiter, userController.verificarSenha);

// Nova rota complementar: login via Google OAuth 2.0
router.post('/google', authLimiter, googleAuthController.googleLogin);

export default router;
