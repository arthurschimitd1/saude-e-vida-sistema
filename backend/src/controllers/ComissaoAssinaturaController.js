import service from '../services/ComissaoAssinaturaService.js';

const responder = handler => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (error) { res.status(error.status || 400).json({ error: error.message }); }
};

export const getConfiguracao = responder(req => service.configuracao(req.user));
export const putConfiguracao = responder(req => service.salvarConfiguracao(req.body, req.user));
export const getDashboard = responder(req => service.dashboard(req.params.competencia, req.user));
export const calcular = responder(req => service.calcular(req.params.competencia, req.user));
export const fechar = responder(req => service.mudarStatus(req.params.competencia, 'FECHADA', req.user));
export const pagar = responder(req => service.mudarStatus(req.params.competencia, 'PAGA', req.user));
