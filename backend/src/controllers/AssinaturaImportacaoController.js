import ApiResponse from '../utils/apiResponse.js';
import service from '../services/AssinaturaImportacaoService.js';

export async function listar(req, res, next) {
  try { new ApiResponse(res).success(200, await service.listarImportacao(req.user)); } catch (error) { next(error); }
}

export async function preview(req, res, next) {
  try { new ApiResponse(res).success(200, await service.previewImportacao(req.body, req.user)); } catch (error) { next(error); }
}

export async function importar(req, res, next) {
  try { new ApiResponse(res).success(201, await service.importar(req.body, req.user), 'Planos e assinantes importados com segurança.'); } catch (error) { next(error); }
}
