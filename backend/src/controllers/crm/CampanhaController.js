import campanhaService from '../../services/crm/CampanhaService.js';
import ApiResponse from '../../utils/apiResponse.js';

class CampanhaController {
    async listar(req, res, next) {
        try {
            const data = await campanhaService.listar(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async buscarPorId(req, res, next) {
        try {
            const data = await campanhaService.buscarPorId(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async criar(req, res, next) {
        try {
            const data = await campanhaService.criar(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Campanha criada com sucesso');
        } catch (err) { next(err); }
    }

    async atualizar(req, res, next) {
        try {
            const data = await campanhaService.atualizar(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Campanha atualizada com sucesso');
        } catch (err) { next(err); }
    }

    async deletar(req, res, next) {
        try {
            await campanhaService.deletar(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Campanha removida com sucesso');
        } catch (err) { next(err); }
    }

    async buscarEmpresas(req, res, next) {
        try {
            const { segment, city, state, radius, pagetoken, limit } = req.body;
            const result = await campanhaService.buscarEmpresasGooglePlaces(
                req.params.id,
                { segment, city, state, radius, pagetoken, limit },
                req.user
            );
            new ApiResponse(res).success(200, result, `${result.salvos} empresa(s) encontradas e salvas`);
        } catch (err) { next(err); }
    }

    async importarPlanilha(req, res, next) {
        try {
            if (!req.file) throw new Error('Nenhum arquivo enviado');
            const result = await campanhaService.importarProspectsPlanilha(req.params.id, req.file.buffer, req.user);
            new ApiResponse(res).success(200, result, `${result.importados} prospect(s) importado(s), ${result.ignorados} ignorado(s) por duplicidade`);
        } catch (err) { next(err); }
    }
}

export default new CampanhaController();
