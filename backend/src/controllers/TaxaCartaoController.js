import taxaCartaoService from '../services/TaxaCartaoService.js';

const podeConfigurar = user => user?.tipo === 'MASTER' || user?.tipo === 'EMPRESA' || user?.cargo === 'Dono';

export const listar = async (req, res) => {
    if (!podeConfigurar(req.user)) return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    try { return res.json(await taxaCartaoService.listar(req.user)); }
    catch (error) { return res.status(error.status || 500).json({ error: error.message }); }
};

export const criar = async (req, res) => {
    if (!podeConfigurar(req.user)) return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    try { return res.status(201).json(await taxaCartaoService.criar(req.body, req.user)); }
    catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
};

export const atualizar = async (req, res) => {
    if (!podeConfigurar(req.user)) return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    try { return res.json(await taxaCartaoService.atualizar(req.params.id, req.body, req.user)); }
    catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
};
