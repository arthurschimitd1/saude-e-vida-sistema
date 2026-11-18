import scriptService from '../../services/crm/ScriptService.js';
import ApiResponse from '../../utils/apiResponse.js';

class ScriptController {
    async listar(req, res, next) {
        try {
            const { campaign_id, script_type } = req.query;
            const data = await scriptService.listar({ campaign_id, script_type }, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await scriptService.criar(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Script criado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizar(req, res, next) {
        try {
            const data = await scriptService.atualizar(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Script atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async deletar(req, res, next) {
        try {
            await scriptService.deletar(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Script removido com sucesso');
        } catch (err) { next(err); }
    }

    async gerar(req, res, next) {
        try {
            const data = await scriptService.gerar(req.body, req.user);
            new ApiResponse(res).success(200, data, 'Scripts gerados com sucesso');
        } catch (err) { next(err); }
    }
}

export default new ScriptController();
