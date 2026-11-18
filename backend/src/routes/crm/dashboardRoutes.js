import express from 'express';
import dashboardController from '../../controllers/crm/DashboardController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', auth, dashboardController.obterIndicadores);

export default router;
