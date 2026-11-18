// backend/src/controllers/ClienteRecorrencia.controller.js
import clienteRecorrenciaService from '../services/ClienteRecorrencia.service.js';
import ApiResponse from '../utils/apiResponse.js';

class ClienteRecorrenciaController {
    
    async getClientesComRecorrencias(req, res, next) {
        try {
            const filters = {
                nome: req.query.nome,
                cpf: req.query.cpf,
                telefone: req.query.telefone,
                tipoRecorrencia: req.query.tipoRecorrencia
            };
            
            const clientes = await clienteRecorrenciaService.getClientesComRecorrencias(filters, req.user);
            new ApiResponse(res).success(200, clientes);
        } catch (error) {
            next(error);
        }
    }

    async getRecorrenciasPorCliente(req, res, next) {
        try {
            const { clienteId } = req.params;
            const filters = {
                ativo: req.query.ativo,
                tipoTransacao: req.query.tipoTransacao,
                tempoRecorrencia: req.query.tempoRecorrencia
            };
            
            const recorrencias = await clienteRecorrenciaService.getRecorrenciasPorCliente(
                parseInt(clienteId), 
                filters, 
                req.user
            );
            
            new ApiResponse(res).success(200, recorrencias);
        } catch (error) {
            next(error);
        }
    }
    
    async getDashboardFaturamento(req, res, next) {
        try {
            const dashboard = await clienteRecorrenciaService.getDashboardFaturamento(req.user);
            new ApiResponse(res).success(200, dashboard);
        } catch (error) {
            next(error);
        }
    }
    
    async buscarCliente(req, res, next) {
        try {
            const { termo } = req.query;
            // Permite string vazia para retornar todos os clientes
            const clientes = await clienteRecorrenciaService.buscarCliente(termo || '', req.user);
            new ApiResponse(res).success(200, clientes);
        } catch (error) {
            next(error);
        }
    }
}

export default new ClienteRecorrenciaController();
