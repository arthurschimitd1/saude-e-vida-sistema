import pedidoService from '../services/PedidoService.js';

export const getPedidos = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            fornecedor: req.query.fornecedor,
            fornecedor_id: req.query.fornecedor_id,
            status_financeiro: req.query.status_financeiro,
            somente_pendentes: req.query.somente_pendentes
        };
        const lista = await pedidoService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getPedidoById = async (req, res) => {
    try {
        const pedido = await pedidoService.getById(req.params.id, req.user);
        res.json(pedido);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

export const createPedido = async (req, res) => {
    try {
        const pedido = await pedidoService.create(req.body, req.user);
        res.status(201).json(pedido);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updatePedido = async (req, res) => {
    try {
        const pedido = await pedidoService.update(req.params.id, req.body, req.user);
        res.json(pedido);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deletePedido = async (req, res) => {
    try {
        await pedidoService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        const status = error.message === 'Pedido com pagamentos registrados não pode ser excluído' ? 409 : 500;
        res.status(status).json({ error: error.message });
    }
};
