import mensagemService from '../../services/whatsappCrm/MensagemService.js';
import ApiResponse from '../../utils/apiResponse.js';
import ApiError from '../../utils/apiError.js';

class MensagemController {
    async listar(req, res, next) {
        try {
            const data = await mensagemService.listarPorConversa(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (err) { next(err); }
    }

    async enviar(req, res, next) {
        try {
            const { texto } = req.body;
            if (req.file) {
                const tipo = req.body.tipo; // 'imagem' | 'documento' | 'audio'
                const data = await mensagemService.enviarMidia(req.params.id, {
                    tipo,
                    buffer: req.file.buffer,
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    caption: texto,
                }, req.user);
                return new ApiResponse(res).success(201, data, 'Mídia enviada');
            }
            if (!texto) throw new ApiError(400, 'Informe o texto da mensagem ou anexe uma mídia');
            const data = await mensagemService.enviarTexto(req.params.id, texto, req.user);
            new ApiResponse(res).success(201, data, 'Mensagem enviada');
        } catch (err) { next(err); }
    }

    async editar(req, res, next) {
        try {
            const data = await mensagemService.editar(req.params.id, req.params.mensagemId, req.body.texto, req.user);
            new ApiResponse(res).success(200, data, 'Mensagem editada');
        } catch (err) { next(err); }
    }

    async reenviar(req, res, next) {
        try {
            const data = await mensagemService.reenviar(req.params.id, req.params.mensagemId, req.user);
            new ApiResponse(res).success(200, data, 'Mensagem reenviada');
        } catch (err) { next(err); }
    }

    async transcrever(req, res, next) {
        try {
            const data = await mensagemService.transcrever(req.params.id, req.params.mensagemId, req.user);
            new ApiResponse(res).success(200, data, 'Áudio transcrito');
        } catch (err) { next(err); }
    }
}

export default new MensagemController();
