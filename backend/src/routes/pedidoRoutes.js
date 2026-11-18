import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    getPedidos,
    getPedidoById,
    createPedido,
    updatePedido,
    deletePedido
} from '../controllers/PedidoController.js';
import {
    listarPagamentosPedido,
    registrarPagamentoPedido
} from '../controllers/PedidoPagamentoController.js';

const router = Router();

router.get('/', auth, getPedidos);
router.get('/:id/pagamentos', auth, listarPagamentosPedido);
router.post('/:id/pagamentos', auth, registrarPagamentoPedido);
router.get('/:id', auth, getPedidoById);
router.post('/', auth, createPedido);
router.put('/:id', auth, updatePedido);
router.delete('/:id', auth, deletePedido);

export default router;
