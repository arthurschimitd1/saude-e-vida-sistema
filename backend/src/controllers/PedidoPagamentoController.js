import pedidoPagamentoService from '../services/PedidoPagamentoService.js';

export const listarPagamentosPedido = async (req, res) => {
    try {
        const resultado = await pedidoPagamentoService.listar(req.params.id, req.user);
        res.json(resultado);
    } catch (error) {
        const status = error.message === 'Pedido não encontrado' ? 404 : 400;
        res.status(status).json({ error: error.message });
    }
};

export const registrarPagamentoPedido = async (req, res) => {
    try {
        const resultado = await pedidoPagamentoService.registrar(req.params.id, req.body, req.user);
        res.status(201).json(resultado);
    } catch (error) {
        const status = error.message === 'Pedido não encontrado' ? 404 : 400;
        res.status(status).json({ error: error.message });
    }
};
