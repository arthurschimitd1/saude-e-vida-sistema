import movimentoService from '../services/MovimentoService.js';

export const getMovimentos = async (req, res) => {
    try {
        const filters = {
            produto_id: req.query.produto_id,
            tipo: req.query.tipo,
            dataInicio: req.query.dataInicio,
            dataFim: req.query.dataFim
        };
        const lista = await movimentoService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteMovimento = async (req, res) => {
    try {
        await movimentoService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
