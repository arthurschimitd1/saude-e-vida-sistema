import { Router } from 'express';
import auth from '../middlewares/auth.js';
import service from '../services/StockLocationService.js';

const router = Router();
const responder = handler => async (req, res) => {
  try {
    return res.json(await handler(req));
  } catch (error) {
    const status = /duplic|unique/i.test(`${error.name} ${error.message}`) ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }
};

router.get('/', auth, responder(req => service.listar(req.user)));
router.post('/', auth, responder(req => service.criar(req.body, req.user)));
router.put('/:id', auth, responder(req => service.atualizar(req.params.id, req.body, req.user)));
router.get('/saldos', auth, responder(req => service.saldos(req.user)));
router.post('/transferencias', auth, responder(req => service.transferir(req.body, req.user)));

export default router;
