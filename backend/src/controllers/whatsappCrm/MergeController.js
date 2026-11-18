import mergeService from '../../services/whatsappCrm/MergeService.js';
import ApiResponse from '../../utils/apiResponse.js';

// Merge na tela (opção B): o atendente vê os palpites de "estes dois são a mesma
// pessoa?" e confirma/descarta. Nada é juntado automático.
class MergeController {
    async listarPendentes(req, res, next) {
        try {
            const data = await mergeService.listarPendentes(req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async confirmar(req, res, next) {
        try {
            const data = await mergeService.confirmar(req.params.id, req.user);
            new ApiResponse(res).success(200, data, 'Contatos juntados com sucesso');
        } catch (err) { next(err); }
    }

    async descartar(req, res, next) {
        try {
            const data = await mergeService.descartar(req.params.id, req.user);
            new ApiResponse(res).success(200, data, 'Sugestão descartada');
        } catch (err) { next(err); }
    }

    // Busca contatos (nome/telefone) pra a telinha de "juntar na mão".
    async buscar(req, res, next) {
        try {
            const data = await mergeService.buscarContatos(req.query.q, req.user, req.query.excluir);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    // Junção MANUAL: o atendente escolheu duas conversas e mandou juntar.
    async manual(req, res, next) {
        try {
            const { conversa_a, conversa_b } = req.body || {};
            const data = await mergeService.fundirManual(conversa_a, conversa_b, req.user);
            new ApiResponse(res).success(200, data, 'Contatos juntados com sucesso');
        } catch (err) { next(err); }
    }
}

export default new MergeController();
