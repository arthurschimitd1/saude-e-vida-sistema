import logService from '../../services/whatsappCrm/LogService.js';
import ApiResponse from '../../utils/apiResponse.js';

class LogController {
    async listar(req, res, next) {
        try {
            const { pagina, tamanho } = req.query;
            const data = await logService.listar({ pagina, tamanho }, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }
}

export default new LogController();
