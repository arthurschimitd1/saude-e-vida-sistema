import relatorioProdutosService from '../services/RelatorioProdutosService.js';

const filtrosDaRequisicao = (req) => ({
  dataInicio: req.query.dataInicio,
  dataFim: req.query.dataFim,
  categoria: req.query.categoria,
  produto: req.query.produto,
});

const responder = (acao) => async (req, res) => {
  try {
    res.json(await acao(filtrosDaRequisicao(req), req.user));
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

export const vendasPorProduto = responder((filtros, usuario) => relatorioProdutosService.vendas(filtros, usuario));
export const vendasFinanceiras = responder((filtros, usuario) => relatorioProdutosService.vendasFinanceiras(filtros, usuario));
export const producaoPorProduto = responder((filtros, usuario) => relatorioProdutosService.producao(filtros, usuario));
