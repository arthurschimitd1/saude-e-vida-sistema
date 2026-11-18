import { Router } from 'express';
import DashboardFiscalController from '../controllers/DashboardfiscalController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.use(auth);

router.get('/', DashboardFiscalController.getDashboard);

export default router;