import clienteService from '../services/ClienteService.js';
import ApiResponse from '../utils/apiResponse.js';
import AutomacaoEngine from '../services/AutomacaoEngine.js';
import { createClienteSchema } from '../validations/ClienteValidation.js';

class ClienteController {
    async create(req, res, next) {
        try {
            // Passa o usuário da requisição
            const cliente = await clienteService.createCliente(req.body, req.user);
            AutomacaoEngine.dispararEvento('novo_cliente', req.user?.empresa_id_override ?? req.user?.empresa_id, { cliente });
            new ApiResponse(res).success(201, cliente, 'Cliente criado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async getAll(req, res, next) {
        try {
            const filters = {
                bairro: req.query.bairro
            };
            
            // Passa o usuário
            const clientes = await clienteService.getAllClientes(filters, req.user);
            new ApiResponse(res).success(200, clientes);
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            // Passa o usuário
            const cliente = await clienteService.getClienteById(req.params.id, req.user);
            new ApiResponse(res).success(200, cliente);
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            // Passa o usuário
            const cliente = await clienteService.updateCliente(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, cliente, 'Cliente atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            // Passa o usuário
            await clienteService.deleteCliente(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Cliente deletado com sucesso');
        } catch (error) {
            next(error);
        }
    }
}

export default new ClienteController();