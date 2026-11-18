import maiaService from '../services/MaiaService.js';
import ApiResponse from '../utils/apiResponse.js';

class MaiaController {
    async chat(req, res, next) {
        try {
            const resposta = await maiaService.responder(req.body, req.user);
            new ApiResponse(res).success(200, resposta);
        } catch (error) {
            next(error);
        }
    }

    async confirmar(req, res, next) {
        try {
            const resposta = await maiaService.confirmar(req.body?.token, req.user);
            new ApiResponse(res).success(201, resposta);
        } catch (error) {
            next(error);
        }
    }
}

export default new MaiaController();
