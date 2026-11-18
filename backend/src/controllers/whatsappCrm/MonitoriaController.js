import monitoriaRelatorioService from '../../services/whatsappCrm/MonitoriaRelatorioService.js';
import ApiResponse from '../../utils/apiResponse.js';

class MonitoriaController {
    async buscarUltimoRelatorio(req, res, next) {
        try {
            const data = await monitoriaRelatorioService.buscarUltimo(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async gerarRelatorio(req, res, next) {
        try {
            const data = await monitoriaRelatorioService.gerarOuBuscarDeHoje(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }
}

export default new MonitoriaController();
