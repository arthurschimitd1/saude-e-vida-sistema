import express from 'express';
import dashboardController from '../../controllers/whatsappCrm/DashboardController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', auth, dashboardController.resumo);

export default router;
