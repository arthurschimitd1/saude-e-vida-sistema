import interacaoService from '../../services/crm/InteracaoService.js';
import ApiResponse from '../../utils/apiResponse.js';

class InteracaoController {
    async listar(req, res, next) {
        try {
            const data = await interacaoService.listarPorProspect(req.query.prospect_id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await interacaoService.criar(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Interação registrada');
        } catch (err) { next(err); }
    }

    async deletar(req, res, next) {
        try {
            await interacaoService.deletar(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Interação removida');
        } catch (err) { next(err); }
    }
}

export default new InteracaoController();
