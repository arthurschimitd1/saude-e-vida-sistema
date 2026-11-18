import configService from '../../services/whatsappCrm/ConfigService.js';
import ApiResponse from '../../utils/apiResponse.js';

class ConfigController {
    async buscar(req, res, next) {
        try {
            const data = await configService.buscar(req.user);
            new ApiResponse(res).success(200, configService.publico(data));
        } catch (err) { next(err); }
    }

    async salvar(req, res, next) {
        try {
            const data = await configService.salvar(req.body, req.user);
            new ApiResponse(res).success(200, configService.publico(data), 'Configurações salvas com sucesso');
        } catch (err) { next(err); }
    }

    async testar(req, res, next) {
        try {
            const data = await configService.testar(req.user);
            new ApiResponse(res).success(200, data, data.mensagem);
        } catch (err) { next(err); }
    }

    async testarMeta(req, res, next) {
        try {
            const data = await configService.testarMeta(req.user);
            new ApiResponse(res).success(200, data, data.mensagem);
        } catch (err) { next(err); }
    }
}

export default new ConfigController();
