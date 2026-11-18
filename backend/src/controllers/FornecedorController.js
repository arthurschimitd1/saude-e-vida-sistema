import fornecedorService from '../services/FornecedorService.js';
import ApiResponse from '../utils/apiResponse.js';

class FornecedorController {
    async listar(req, res, next) {
        try {
            const fornecedores = await fornecedorService.listar(
                { busca: req.query.busca?.trim() },
                req.user
            );
            new ApiResponse(res).success(200, fornecedores);
        } catch (error) {
            next(error);
        }
    }

    async buscarPorId(req, res, next) {
        try {
            const fornecedor = await fornecedorService.buscarPorId(req.params.id, req.user);
            new ApiResponse(res).success(200, fornecedor);
        } catch (error) {
            next(error);
        }
    }

    async listarSugestoesXml(req, res, next) {
        try {
            const sugestoes = await fornecedorService.listarSugestoesXml(req.user);
            new ApiResponse(res).success(200, sugestoes);
        } catch (error) {
            next(error);
        }
    }

    async criar(req, res, next) {
        try {
            const fornecedor = await fornecedorService.criar(req.body, req.user);
            new ApiResponse(res).success(201, fornecedor, 'Fornecedor criado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async atualizar(req, res, next) {
        try {
            const fornecedor = await fornecedorService.atualizar(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, fornecedor, 'Fornecedor atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async excluir(req, res, next) {
        try {
            await fornecedorService.excluir(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Fornecedor excluído com sucesso');
        } catch (error) {
            next(error);
        }
    }
}

export default new FornecedorController();
