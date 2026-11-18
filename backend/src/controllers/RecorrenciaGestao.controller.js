import recorrenciaGestaoService from '../services/RecorrenciaGestao.service.js';
import ApiResponse from '../utils/apiResponse.js';

class RecorrenciaGestaoController {
  async dashboard(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.dashboard(req.user)); } catch (error) { next(error); } }
  async pagamentos(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.listarPagamentos(req.query, req.user)); } catch (error) { next(error); } }
  async configuracao(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.configuracao(req.user)); } catch (error) { next(error); } }
  async salvarConfiguracao(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.salvarConfiguracao(req.body, req.user), 'Configuração de recorrência salva'); } catch (error) { next(error); } }
  async planos(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.listarPlanos(req.user)); } catch (error) { next(error); } }
  async criarPlano(req, res, next) { try { new ApiResponse(res).success(201, await recorrenciaGestaoService.criarPlano(req.body, req.user), 'Plano criado'); } catch (error) { next(error); } }
  async atualizarPlano(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.atualizarPlano(req.params.id, req.body, req.user), 'Plano atualizado'); } catch (error) { next(error); } }
  async excluirPlano(req, res, next) { try { await recorrenciaGestaoService.excluirPlano(req.params.id, req.user); new ApiResponse(res).success(200, null, 'Plano removido'); } catch (error) { next(error); } }
  async pausar(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.alterarStatus(req.params.id, 'pausar', req.user, req.body?.motivo), 'Pausa solicitada ao Asaas'); } catch (error) { next(error); } }
  async reativar(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.alterarStatus(req.params.id, 'reativar', req.user, req.body?.motivo), 'Reativação solicitada ao Asaas'); } catch (error) { next(error); } }
  async cancelar(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.alterarStatus(req.params.id, 'cancelar', req.user, req.body?.motivo), 'Cancelamento solicitado ao Asaas'); } catch (error) { next(error); } }
  async estornar(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.solicitarEstorno(req.params.id, req.body, req.user), 'Estorno solicitado ao Asaas'); } catch (error) { next(error); } }
  async eventos(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.eventos(req.params.id, req.user)); } catch (error) { next(error); } }
  async recibo(req, res, next) { try { new ApiResponse(res).success(200, await recorrenciaGestaoService.recibo(req.params.id, req.user)); } catch (error) { next(error); } }
}

export default new RecorrenciaGestaoController();
