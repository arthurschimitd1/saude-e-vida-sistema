import rankingCaixaService from '../services/RankingCaixaService.js';

export const consultarRankingCaixa = async (req, res) => {
  try {
    res.json(await rankingCaixaService.consultar(req.query, req.user));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};
