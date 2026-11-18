import clienteCrmService from '../../services/whatsappCrm/ClienteCrmService.js';
import ApiResponse from '../../utils/apiResponse.js';

class ClienteCrmController {
    async buscarPorTelefone(req, res, next) {
        try {
            const data = await clienteCrmService.buscarPorTelefone(req.params.telefone, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async adicionarObservacao(req, res, next) {
        try {
            const data = await clienteCrmService.adicionarObservacao(req.params.id, req.body.observacao, req.user);
            new ApiResponse(res).success(200, data, 'Observação salva com sucesso');
        } catch (err) { next(err); }
    }

    async adicionarEtiqueta(req, res, next) {
        try {
            const data = await clienteCrmService.adicionarEtiqueta(req.params.id, req.body, req.user);
            new ApiResponse(res).success(201, data, 'Etiqueta adicionada com sucesso');
        } catch (err) { next(err); }
    }

    async atualizarEstagio(req, res, next) {
        try {
            const data = await clienteCrmService.atualizarEstagio(req.params.id, req.body.estagio, req.user);
            new ApiResponse(res).success(200, data, 'Estágio atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizarMotivoClinico(req, res, next) {
        try {
            const data = await clienteCrmService.atualizarMotivoClinico(req.params.id, req.body.motivo_clinico, req.user);
            new ApiResponse(res).success(200, data, 'Assunto atualizado com sucesso');
        } catch (err) { next(err); }
    }

    async atualizarProfissional(req, res, next) {
        try {
            const data = await clienteCrmService.atualizarProfissional(req.params.id, req.body.profissional, req.user);
            new ApiResponse(res).success(200, data, 'Profissional responsável atualizado com sucesso');
        } catch (err) { next(err); }
    }
}

export default new ClienteCrmController();
