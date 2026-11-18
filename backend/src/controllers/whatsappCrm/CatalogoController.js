import catalogoService from '../../services/whatsappCrm/CatalogoService.js';
import ApiResponse from '../../utils/apiResponse.js';

class CatalogoController {
    async listar(req, res, next) {
        try {
            const data = await catalogoService.listar(req.params.tipo, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await catalogoService.criar(req.params.tipo, req.body, req.user);
            new ApiResponse(res).success(201, data, 'Item criado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizar(req, res, next) {
        try {
            const data = await catalogoService.atualizar(req.params.tipo, req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Item atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async remover(req, res, next) {
        try {
            const data = await catalogoService.remover(req.params.tipo, req.params.id, req.user);
            new ApiResponse(res).success(200, data, 'Item removido com sucesso');
        } catch (err) { next(err); }
    }
}

export default new CatalogoController();
