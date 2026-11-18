import etiquetaService from '../../services/whatsappCrm/EtiquetaService.js';
import ApiResponse from '../../utils/apiResponse.js';

class EtiquetaController {
    async listar(req, res, next) {
        try {
            const data = await etiquetaService.listar(req.user, req.query.tipo || 'etiqueta');
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await etiquetaService.criar(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Etiqueta criada com sucesso');
        } catch (err) { next(err); }
    }

    async atualizar(req, res, next) {
        try {
            const data = await etiquetaService.atualizar(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Etiqueta atualizada com sucesso');
        } catch (err) { next(err); }
    }

    async remover(req, res, next) {
        try {
            const data = await etiquetaService.remover(req.params.id, req.user);
            new ApiResponse(res).success(200, data, 'Etiqueta removida com sucesso');
        } catch (err) { next(err); }
    }

    async aceitarSugestao(req, res, next) {
        try {
            const data = await etiquetaService.aceitarSugestao(req.params.vinculoId, req.user);
            new ApiResponse(res).success(200, data, 'Sugestão aceita');
        } catch (err) { next(err); }
    }

    async removerDoCliente(req, res, next) {
        try {
            const data = await etiquetaService.removerDoCliente(req.params.vinculoId, req.user);
            new ApiResponse(res).success(200, data, 'Etiqueta removida do cliente');
        } catch (err) { next(err); }
    }
}

export default new EtiquetaController();
