import historicoPagamentoService from '../services/HistoricoPagamento.service.js';
import ApiResponse from '../utils/apiResponse.js';

class HistoricoPagamentoController {
    
    async getHistorico(req, res, next) {
        try {
            const { recorrenciaId } = req.params;
            
            // ✅ Gerar pendências automaticamente
            await historicoPagamentoService.gerarPagamentosPendentes(recorrenciaId, req.user);
            
            // Buscar histórico atualizado
            const historico = await historicoPagamentoService.getHistoricoByRecorrenciaId(recorrenciaId, req.user);
            new ApiResponse(res).success(200, historico);
        } catch (error) {
            next(error);
        }
    }
}

export default new HistoricoPagamentoController();
