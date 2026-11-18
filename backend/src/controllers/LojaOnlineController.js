import lojaOnlineService from '../services/LojaOnlineService.js';
import lojaProgramaService from '../services/LojaProgramaService.js';

export async function catalogoPublico(req, res, next) {
  try {
    res.json(await lojaOnlineService.catalogo(req.params.slug));
  } catch (error) {
    next(error);
  }
}

export async function criarPedidoPublico(req, res, next) {
  try {
    res.status(201).json(await lojaOnlineService.criarPedido(req.params.slug, req.body, req.lojaCliente));
  } catch (error) {
    next(error);
  }
}

export async function webhookMercadoPago(req, res, next) {
  try {
    const resultado = await lojaOnlineService.processarWebhookMercadoPago(req.body, req.query);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

export async function cadastrarClientePublico(req, res, next) {
  try {
    res.status(201).json(await lojaOnlineService.cadastrarCliente(req.params.slug, req.body));
  } catch (error) {
    next(error);
  }
}

export async function loginClientePublico(req, res, next) {
  try {
    res.json(await lojaOnlineService.loginCliente(req.params.slug, req.body));
  } catch (error) {
    next(error);
  }
}

export async function clienteAtualPublico(req, res, next) {
  try {
    res.json(await lojaOnlineService.clienteAtual(req.params.slug, req.lojaCliente));
  } catch (error) {
    next(error);
  }
}

export async function listarPedidosClientePublico(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarPedidosCliente(req.params.slug, req.lojaCliente));
  } catch (error) {
    next(error);
  }
}

export async function validarCupomPublico(req, res, next) {
  try {
    res.json(await lojaOnlineService.validarCupom(req.params.slug, req.body, req.lojaCliente));
  } catch (error) {
    next(error);
  }
}

export async function validarCupomCaixa(req, res, next) {
  try {
    res.json(await lojaProgramaService.validarCupomCaixa(req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function iniciarRoletaPublica(req, res, next) {
  try { res.status(201).json(await lojaProgramaService.iniciarLead(req.params.slug, req.body)); } catch (error) { next(error); }
}

export async function girarRoletaPublica(req, res, next) {
  try { res.json(await lojaProgramaService.girarRoleta(req.params.slug, req.body.token)); } catch (error) { next(error); }
}

export async function listarPontosPublico(req, res, next) {
  try { res.json(await lojaProgramaService.pontosDoCliente(req.params.slug, req.lojaCliente)); } catch (error) { next(error); }
}

export async function resgatarPontosPublico(req, res, next) {
  try { res.status(201).json(await lojaProgramaService.resgatar(req.params.slug, Number(req.body.premio_id), req.lojaCliente)); } catch (error) { next(error); }
}

export async function listarLeadsRoleta(req, res, next) {
  try { res.json(await lojaProgramaService.listarLeads(req.user)); } catch (error) { next(error); }
}

export async function decidirLeadRoleta(req, res, next) {
  try { res.json(await lojaProgramaService.decidirCadastro(Number(req.params.id), req.body.cadastrar === true, req.user)); } catch (error) { next(error); }
}

export async function listarPremios(req, res, next) {
  try { res.json(await lojaProgramaService.listarPremios(req.user)); } catch (error) { next(error); }
}

export async function listarProdutosPremios(req, res, next) {
  try { res.json(await lojaProgramaService.listarProdutosPremios(req.user)); } catch (error) { next(error); }
}

export async function criarPremio(req, res, next) {
  try { res.status(201).json(await lojaProgramaService.criarPremio(req.body, req.user)); } catch (error) { next(error); }
}

export async function atualizarPremio(req, res, next) {
  try { res.json(await lojaProgramaService.criarPremio(req.body, req.user, Number(req.params.id))); } catch (error) { next(error); }
}

export async function excluirPremio(req, res, next) {
  try { res.json(await lojaProgramaService.excluirPremio(Number(req.params.id), req.user)); } catch (error) { next(error); }
}

export async function listarConfiguracao(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarConfiguracao(req.user));
  } catch (error) {
    next(error);
  }
}

export async function listarEstoqueConfiguracao(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarEstoqueConfiguracao(req.user));
  } catch (error) {
    next(error);
  }
}

export async function listarCategorias(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarCategorias(req.user));
  } catch (error) {
    next(error);
  }
}

export async function criarCategoria(req, res, next) {
  try {
    res.status(201).json(await lojaOnlineService.criarCategoria(req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function atualizarCategoria(req, res, next) {
  try {
    res.json(await lojaOnlineService.atualizarCategoria(req.params.id, req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function excluirCategoria(req, res, next) {
  try {
    res.json(await lojaOnlineService.excluirCategoria(req.params.id, req.user));
  } catch (error) {
    next(error);
  }
}

export async function atualizarConfiguracao(req, res, next) {
  try {
    res.json(await lojaOnlineService.atualizarConfiguracao(req.params.id, req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function atualizarFoto(req, res, next) {
  try {
    res.json(await lojaOnlineService.atualizarFoto(req.params.id, req.file, req.user));
  } catch (error) {
    next(error);
  }
}

export async function listarCupons(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarCupons(req.user));
  } catch (error) {
    next(error);
  }
}

export async function listarClientesParaCupons(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarClientesParaCupons(req.user));
  } catch (error) {
    next(error);
  }
}

export async function criarCupom(req, res, next) {
  try {
    res.status(201).json(await lojaOnlineService.criarCupom(req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function enviarCupom(req, res, next) {
  try {
    res.json(await lojaOnlineService.enviarCupom(req.params.id, req.body.cliente_ids, req.user));
  } catch (error) {
    next(error);
  }
}

export async function listarPedidos(req, res, next) {
  try {
    res.json(await lojaOnlineService.listarPedidos(req.user, req.query));
  } catch (error) {
    next(error);
  }
}

export async function atualizarStatus(req, res, next) {
  try {
    res.json(await lojaOnlineService.atualizarStatus(req.params.id, req.body.status, req.user));
  } catch (error) {
    next(error);
  }
}

export async function cancelarPedido(req, res, next) {
  try {
    res.json(await lojaOnlineService.cancelarPedido(req.params.id, req.body, req.user));
  } catch (error) {
    next(error);
  }
}
