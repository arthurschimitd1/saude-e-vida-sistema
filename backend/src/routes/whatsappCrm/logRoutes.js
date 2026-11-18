import express from 'express';
import logController from '../../controllers/whatsappCrm/LogController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', auth, logController.listar);

export default router;
