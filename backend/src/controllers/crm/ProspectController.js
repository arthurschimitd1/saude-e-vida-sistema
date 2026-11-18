import prospectService from '../../services/crm/ProspectService.js';
import ApiResponse from '../../utils/apiResponse.js';

class ProspectController {
    async listar(req, res, next) {
        try {
            const { campaign_id, status, search } = req.query;
            const data = await prospectService.listar({ campaign_id, status, search }, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async buscarPorId(req, res, next) {
        try {
            const data = await prospectService.buscarPorId(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await prospectService.criar(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Prospect criado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizar(req, res, next) {
        try {
            const data = await prospectService.atualizar(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Prospect atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizarStatus(req, res, next) {
        try {
            const { status } = req.body;
            const data = await prospectService.atualizarStatus(req.params.id, status, req.user);
            new ApiResponse(res).success(200, data, 'Status atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async deletar(req, res, next) {
        try {
            await prospectService.deletar(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Prospect removido com sucesso');
        } catch (err) { next(err); }
    }

    async enriquecer(req, res, next) {
        try {
            const data = await prospectService.enriquecer(req.params.id, req.user);
            new ApiResponse(res).success(200, data, `${data.enriched.length} campo(s) enriquecido(s)`);
        } catch (err) { next(err); }
    }
}

export default new ProspectController();
