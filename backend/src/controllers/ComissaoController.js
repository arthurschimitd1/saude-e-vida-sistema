import comissaoService from '../services/ComissaoService.js';

export const getComissoes = async (req, res) => {
    try {
        const filters = {
            funcionario_id: req.query.funcionario_id,
            status: req.query.status,
            dataInicio: req.query.dataInicio,
            dataFim: req.query.dataFim
        };
        const lista = await comissaoService.getAll(filters, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getResumo = async (req, res) => {
    try {
        const resumo = await comissaoService.getResumo(req.user);
        res.json(resumo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getInconsistencias = async (req, res) => {
    try {
        res.json(await comissaoService.getInconsistencias(req.query, req.user));
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

export const getProdutosPorProfissional = async (req, res) => {
    try {
        res.json(await comissaoService.getProdutosPorProfissional(req.query, req.user));
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

export const getEscopo = async (req, res) => {
    res.json(comissaoService.getEscopo(req.user));
};

export const getConfiguracoesServico = async (req, res) => {
    try {
        res.json(await comissaoService.getConfiguracoesServico(req.user));
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const getCatalogoServicos = async (req, res) => {
    try {
        res.json(await comissaoService.getCatalogoServicos(req.user));
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const salvarConfiguracaoServico = async (req, res) => {
    try {
        res.status(201).json(await comissaoService.salvarConfiguracaoServico(req.body, req.user));
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const excluirConfiguracaoServico = async (req, res) => {
    try {
        await comissaoService.excluirConfiguracaoServico(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const pagarComissao = async (req, res) => {
    try {
        const c = await comissaoService.pagar(req.params.id, req.user);
        res.json(c);
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const pagarTodasPendentes = async (req, res) => {
    try {
        const r = await comissaoService.pagarTodasPendentes(req.params.funcionario_id, req.user);
        res.json(r);
    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
};

export const deleteComissao = async (req, res) => {
    try {
        await comissaoService.delete(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};
