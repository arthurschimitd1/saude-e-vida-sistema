import dashboardService from '../../services/whatsappCrm/DashboardService.js';
import ApiResponse from '../../utils/apiResponse.js';

class DashboardController {
    async resumo(req, res, next) {
        try {
            const data = await dashboardService.resumo(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }
}

export default new DashboardController();
