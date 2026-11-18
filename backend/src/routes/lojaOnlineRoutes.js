import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../middlewares/auth.js';
import lojaClienteAuth from '../middlewares/lojaClienteAuth.js';
import { uploadSingle } from '../middlewares/upload.js';
import {
  catalogoPublico,
  criarPedidoPublico,
  listarConfiguracao,
  listarEstoqueConfiguracao,
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  atualizarConfiguracao,
  atualizarFoto,
  listarPedidos,
  atualizarStatus,
  cancelarPedido,
  cadastrarClientePublico,
  loginClientePublico,
  clienteAtualPublico,
  listarPedidosClientePublico,
  validarCupomPublico,
  validarCupomCaixa,
  listarCupons,
  listarClientesParaCupons,
  criarCupom,
  enviarCupom,
  webhookMercadoPago,
  iniciarRoletaPublica,
  girarRoletaPublica,
  listarPontosPublico,
  resgatarPontosPublico,
  listarLeadsRoleta,
  decidirLeadRoleta,
  listarPremios,
  listarProdutosPremios,
  criarPremio,
  atualizarPremio,
  excluirPremio,
} from '../controllers/LojaOnlineController.js';

const router = Router();
const pedidoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.get('/public/:slug', catalogoPublico);
router.post('/mercado-pago/webhook', webhookMercadoPago);
router.post('/public/:slug/clientes/cadastro', pedidoLimiter, cadastrarClientePublico);
router.post('/public/:slug/clientes/login', pedidoLimiter, loginClientePublico);
router.get('/public/:slug/clientes/me', lojaClienteAuth, clienteAtualPublico);
router.get('/public/:slug/clientes/me/pedidos', lojaClienteAuth, listarPedidosClientePublico);
router.post('/public/:slug/cupom/validar', pedidoLimiter, lojaClienteAuth, validarCupomPublico);
router.post('/cupons/validar-caixa', auth, validarCupomCaixa);
router.post('/public/:slug/roleta/iniciar', pedidoLimiter, iniciarRoletaPublica);
router.post('/public/:slug/roleta/girar', pedidoLimiter, girarRoletaPublica);
router.get('/public/:slug/pontos', lojaClienteAuth, listarPontosPublico);
router.post('/public/:slug/pontos/resgatar', lojaClienteAuth, resgatarPontosPublico);
router.post('/public/:slug/pedidos', pedidoLimiter, lojaClienteAuth, criarPedidoPublico);
router.get('/configuracao', auth, listarConfiguracao);
router.get('/configuracao/estoque', auth, listarEstoqueConfiguracao);
router.get('/categorias', auth, listarCategorias);
router.post('/categorias', auth, criarCategoria);
router.put('/categorias/:id', auth, atualizarCategoria);
router.delete('/categorias/:id', auth, excluirCategoria);
router.put('/configuracao/:id', auth, atualizarConfiguracao);
router.post('/configuracao/:id/foto', auth, uploadSingle, atualizarFoto);
router.get('/cupons', auth, listarCupons);
router.get('/cupons/clientes', auth, listarClientesParaCupons);
router.post('/cupons', auth, criarCupom);
router.post('/cupons/:id/enviar', auth, enviarCupom);
router.get('/roleta/leads', auth, listarLeadsRoleta);
router.patch('/roleta/leads/:id/cadastro', auth, decidirLeadRoleta);
router.get('/roleta/premios', auth, listarPremios);
router.get('/roleta/premios/produtos', auth, listarProdutosPremios);
router.post('/roleta/premios', auth, criarPremio);
router.put('/roleta/premios/:id', auth, atualizarPremio);
router.delete('/roleta/premios/:id', auth, excluirPremio);
router.get('/pedidos', auth, listarPedidos);
router.patch('/pedidos/:id/status', auth, atualizarStatus);
router.post('/pedidos/:id/cancelar', auth, cancelarPedido);

export default router;
