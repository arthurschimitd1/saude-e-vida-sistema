import { Router } from 'express';
import auth from '../middlewares/auth.js';
import controller from '../controllers/Nuvemshop.controller.js';

const router = Router();

router.get('/status', auth, controller.status.bind(controller));
router.post('/connect', auth, controller.connect.bind(controller));
router.delete('/disconnect', auth, controller.disconnect.bind(controller));
router.post('/sync/pull', auth, controller.pull.bind(controller));
router.post('/sync/push', auth, controller.push.bind(controller));
router.post('/webhooks/register', auth, controller.registerWebhooks.bind(controller));
router.get('/callback', controller.callback.bind(controller));
router.post('/webhooks/events', controller.events.bind(controller));
router.post('/webhooks/store-redact', controller.storeRedact.bind(controller));
router.post('/webhooks/customers-redact', controller.customersRedact.bind(controller));
router.post('/webhooks/customers-data-request', controller.customersDataRequest.bind(controller));

export default router;
