// backend/src/controllers/RecorrenciaController.js
import recorrenciaService from '../services/Recorrencia.service.js';
import recorrenciaGestaoService from '../services/RecorrenciaGestao.service.js';
import ApiResponse from '../utils/apiResponse.js';

class RecorrenciaController {
    
    async create(req, res, next) {
        try {
            const recorrencia = await recorrenciaService.createRecorrencia(req.body, req.user);
            new ApiResponse(res).success(201, recorrencia, 'Recorrência criada com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req, res, next) {
        try {
            const filters = {
                nomeCliente: req.query.nomeCliente,
                produto: req.query.produto,
                tipoTransacao: req.query.tipoTransacao,
                ativo: req.query.ativo,
                bancoRecebimento: req.query.bancoRecebimento
            };
            
            const recorrencias = await recorrenciaService.getAllRecorrencias(filters, req.user);
            new ApiResponse(res).success(200, recorrencias);
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const recorrencia = await recorrenciaService.getRecorrenciaById(req.params.id, req.user);
            new ApiResponse(res).success(200, recorrencia);
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const recorrencia = await recorrenciaService.updateRecorrencia(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, recorrencia, 'Recorrência atualizada com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            await recorrenciaService.deleteRecorrencia(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Recorrência deletada com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async toggleStatus(req, res, next) {
        try {
            const atual = await recorrenciaService.getRecorrenciaById(req.params.id, req.user);
            const recorrencia = atual.asaasSubscriptionId
                ? await recorrenciaGestaoService.alterarStatus(req.params.id, atual.ativo ? 'pausar' : 'reativar', req.user, 'Alteração solicitada pelo fluxo legado')
                : await recorrenciaService.toggleStatus(req.params.id, req.user);
            const status = recorrencia.ativo ? 'ativada' : 'desativada';
            new ApiResponse(res).success(200, recorrencia, `Recorrência ${status} com sucesso`);
        } catch (error) {
            next(error);
        }
    }

    async confirmarPagamento(req, res, next) {
        try {
            const { dataPagamento, valor, referenciaId } = req.body;
            
            if (!dataPagamento) {
                return new ApiResponse(res).error(400, 'Data do pagamento é obrigatória');
            }
            
            const recorrencia = await recorrenciaService.confirmarPagamento(
                req.params.id, 
                dataPagamento, 
                valor,
                referenciaId,
                req.user
            );
            
            new ApiResponse(res).success(200, recorrencia, 'Pagamento confirmado com sucesso');
        } catch (error) {
            next(error);
        }
    }
}

export default new RecorrenciaController();
