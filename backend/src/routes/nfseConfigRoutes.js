import { Router } from 'express';
import { getConfig, upsertConfig } from '../controllers/NfseConfigController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, getConfig);
router.post('/', auth, upsertConfig);

export default router;
