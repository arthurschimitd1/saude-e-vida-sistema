import conversaService from '../../services/whatsappCrm/ConversaService.js';
import aiObserverService from '../../services/whatsappCrm/AIObserverService.js';
import ApiResponse from '../../utils/apiResponse.js';

class ConversaController {
    async listar(req, res, next) {
        try {
            const { status, busca, estagio, motivo_clinico, profissional, etiqueta_id, responsavel_id } = req.query;
            const data = await conversaService.listar({ status, busca, estagio, motivo_clinico, profissional, etiqueta_id, responsavel_id }, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async iniciar(req, res, next) {
        try {
            const data = await conversaService.iniciarConversa(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Conversa iniciada com sucesso');
        } catch (err) { next(err); }
    }

    async buscarPorId(req, res, next) {
        try {
            const data = await conversaService.buscarPorId(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async atualizarStatus(req, res, next) {
        try {
            const data = await conversaService.atualizarStatus(req.params.id, req.body.status, req.user);
            new ApiResponse(res).success(200, data, 'Status atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async atribuirResponsavel(req, res, next) {
        try {
            const data = await conversaService.atribuirResponsavel(req.params.id, req.body.responsavel_id, req.user);
            new ApiResponse(res).success(200, data, 'Responsável atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async marcarComoLida(req, res, next) {
        try {
            const data = await conversaService.marcarComoLida(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async renomear(req, res, next) {
        try {
            const data = await conversaService.renomearContato(req.params.id, req.body.nome_contato, req.user);
            new ApiResponse(res).success(200, data, 'Contato renomeado com sucesso');
        } catch (err) { next(err); }
    }

    async analisarComIA(req, res, next) {
        try {
            const data = await aiObserverService.analisarConversa(req.params.id, req.user);
            new ApiResponse(res).success(200, data, 'Análise da IA concluída');
        } catch (err) { next(err); }
    }

    async avaliarAgendamento(req, res, next) {
        try {
            const data = await aiObserverService.avaliarIntencaoAgendamento(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }
}

export default new ConversaController();
