import dashboardService from '../../services/crm/DashboardService.js';
import ApiResponse from '../../utils/apiResponse.js';

class DashboardController {
    async obterIndicadores(req, res, next) {
        try {
            const data = await dashboardService.obterIndicadores(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }
}

export default new DashboardController();
