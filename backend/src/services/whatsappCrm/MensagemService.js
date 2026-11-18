import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import conversaService from './ConversaService.js';
import configService from './ConfigService.js';
import zApiService from './ZApiService.js';
import metaWhatsAppService from './MetaWhatsAppService.js';
import transcricaoService from './TranscricaoService.js';
import CloudinaryService from '../../utils/CloudinaryService.js';
import ApiError from '../../utils/apiError.js';

const previewPorTipo = { texto: (c) => c, imagem: () => '📷 Imagem', documento: () => '📄 Documento', audio: () => '🎵 Áudio' };

class MensagemService {
    async listarPorConversa(conversaId, user) {
        const conversa = await conversaService.buscarPorId(conversaId, user);
        return WhatsappMensagem.findAll({ where: { conversa_id: conversa.id }, order: [['criado_em', 'ASC']] });
    }

    async _configDaConversa(user) {
        const config = await configService.buscar(user);
        const metaDisponivel = config?.meta_ativo && config?.meta_phone_number_id && config?.meta_access_token;
        const zapiDisponivel = config?.zapi_instance_id && config?.zapi_token;
        if (!metaDisponivel && !zapiDisponivel) {
            throw new ApiError(400, 'Configure a Z-API ou ative a Meta Cloud API antes de enviar mensagens');
        }
        return config;
    }

    async _registrarEAtualizarConversa(conversa, dadosMensagem) {
        const mensagem = await WhatsappMensagem.create(dadosMensagem);
        const preview = (previewPorTipo[dadosMensagem.tipo] ?? previewPorTipo.texto)(dadosMensagem.conteudo_texto ?? '');
        await conversa.update({
            ultima_mensagem_preview: preview?.slice(0, 250),
            ultima_mensagem_em: new Date(),
            ultima_mensagem_direcao: 'enviada',
        });
        return mensagem;
    }

    async enviarTexto(conversaId, texto, user, { origem = null } = {}) {
        const conversa = await conversaService.buscarPorId(conversaId, user);
        const config = await this._configDaConversa(user);
        const metaAtiva = Boolean(config.meta_ativo && config.meta_phone_number_id && config.meta_access_token);

        let resposta;
        let status = 'enviada';
        try {
            resposta = metaAtiva
                ? await metaWhatsAppService.enviarTexto(config, { to: conversa.telefone, text: texto })
                : await zApiService.enviarTexto(config, { phone: conversa.telefone, message: texto });
        } catch (err) {
            status = 'falha';
            resposta = { error: metaAtiva ? err.message : zApiService.mensagemErro(err) };
        }

        return this._registrarEAtualizarConversa(conversa, {
            conversa_id: conversa.id,
            empresa_id: conversa.empresa_id,
            direcao: 'enviada',
            tipo: 'texto',
            conteudo_texto: texto,
            zapi_message_id: metaAtiva ? (resposta?.messages?.[0]?.id ?? null) : (resposta?.messageId ?? null),
            status,
            enviado_por_user_id: user?.id ?? null,
            origem,
        });
    }

    async enviarMidia(conversaId, { tipo, buffer, originalname, mimetype, caption }, user) {
        if (!['imagem', 'documento', 'audio'].includes(tipo)) throw new ApiError(400, 'Tipo de mídia inválido');

        const conversa = await conversaService.buscarPorId(conversaId, user);
        const config = await this._configDaConversa(user);
        if (config.meta_ativo && config.meta_phone_number_id && config.meta_access_token) throw new ApiError(400, 'O envio de mídia pela Meta Cloud API ainda não está habilitado; mensagens de texto já estão prontas.');

        const upload = await CloudinaryService.uploadFile(buffer, originalname, 'whatsapp-crm');
        const url = upload.secure_url;

        let zapiResp;
        let status = 'enviada';
        try {
            if (tipo === 'imagem') {
                zapiResp = await zApiService.enviarImagem(config, { phone: conversa.telefone, image: url, caption });
            } else if (tipo === 'documento') {
                const extensao = (originalname.split('.').pop() || 'pdf').toLowerCase();
                zapiResp = await zApiService.enviarDocumento(config, { phone: conversa.telefone, document: url, fileName: originalname, extensao });
            } else {
                zapiResp = await zApiService.enviarAudio(config, { phone: conversa.telefone, audio: url });
            }
        } catch (err) {
            status = 'falha';
            zapiResp = { error: zApiService.mensagemErro(err) };
        }

        return this._registrarEAtualizarConversa(conversa, {
            conversa_id: conversa.id,
            empresa_id: conversa.empresa_id,
            direcao: 'enviada',
            tipo,
            conteudo_texto: caption ?? null,
            midia_url: url,
            midia_nome: originalname,
            midia_mime: mimetype,
            zapi_message_id: zapiResp?.messageId ?? null,
            status,
            enviado_por_user_id: user?.id ?? null,
        });
    }

    // Edita de verdade a mensagem já entregue no WhatsApp do paciente, via
    // editMessageId da Z-API (precisa do zapi_message_id que só existe em
    // mensagens de texto enviadas com sucesso por nós).
    async editar(conversaId, mensagemId, novoTexto, user) {
        const conversa = await conversaService.buscarPorId(conversaId, user);
        const mensagem = await WhatsappMensagem.findOne({ where: { id: mensagemId, conversa_id: conversa.id } });
        if (!mensagem) throw new ApiError(404, 'Mensagem não encontrada');
        if (mensagem.direcao !== 'enviada' || mensagem.tipo !== 'texto') {
            throw new ApiError(400, 'Só é possível editar mensagens de texto enviadas por nós');
        }
        if (!mensagem.zapi_message_id) throw new ApiError(400, 'Essa mensagem não pode ser editada (falhou no envio original)');

        const config = await this._configDaConversa(user);
        if (config.meta_ativo && config.meta_phone_number_id && config.meta_access_token) throw new ApiError(400, 'A edição de mensagens ainda não é suportada pela Meta Cloud API.');
        await zApiService.editarTexto(config, { phone: conversa.telefone, message: novoTexto, editMessageId: mensagem.zapi_message_id });

        await mensagem.update({ conteudo_texto: novoTexto, editado_em: new Date() });

        const ultima = await WhatsappMensagem.findOne({ where: { conversa_id: conversa.id }, order: [['criado_em', 'DESC']] });
        if (ultima?.id === mensagem.id) {
            await conversa.update({ ultima_mensagem_preview: novoTexto.slice(0, 250) });
        }
        return mensagem;
    }

    async reenviar(conversaId, mensagemId, user) {
        const conversa = await conversaService.buscarPorId(conversaId, user);
        const mensagem = await WhatsappMensagem.findOne({ where: { id: mensagemId, conversa_id: conversa.id } });
        if (!mensagem) throw new ApiError(404, 'Mensagem não encontrada');
        if (mensagem.direcao !== 'enviada' || mensagem.status !== 'falha') {
            throw new ApiError(400, 'Somente mensagens com falha podem ser reenviadas');
        }

        const config = await this._configDaConversa(user);
        const metaAtiva = Boolean(config.meta_ativo && config.meta_phone_number_id && config.meta_access_token);
        let resposta;
        try {
            if (mensagem.tipo === 'texto' && metaAtiva) {
                resposta = await metaWhatsAppService.enviarTexto(config, { to: conversa.telefone, text: mensagem.conteudo_texto });
            } else if (mensagem.tipo === 'texto') {
                resposta = await zApiService.enviarTexto(config, { phone: conversa.telefone, message: mensagem.conteudo_texto });
            } else if (mensagem.tipo === 'imagem') {
                resposta = await zApiService.enviarImagem(config, { phone: conversa.telefone, image: mensagem.midia_url, caption: mensagem.conteudo_texto });
            } else if (mensagem.tipo === 'documento') {
                const extensao = (mensagem.midia_nome?.split('.').pop() || 'pdf').toLowerCase();
                resposta = await zApiService.enviarDocumento(config, { phone: conversa.telefone, document: mensagem.midia_url, fileName: mensagem.midia_nome || `documento.${extensao}`, extensao });
            } else if (mensagem.tipo === 'audio') {
                resposta = await zApiService.enviarAudio(config, { phone: conversa.telefone, audio: mensagem.midia_url });
            } else {
                throw new ApiError(400, 'Tipo de mensagem não suportado para reenvio');
            }
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(502, metaAtiva ? error.message : zApiService.mensagemErro(error));
        }

        await mensagem.update({
            status: 'enviada',
            zapi_message_id: metaAtiva ? (resposta?.messages?.[0]?.id ?? null) : (resposta?.messageId ?? null),
            enviado_por_user_id: user?.id ?? mensagem.enviado_por_user_id,
        });
        await conversa.update({ ultima_mensagem_em: new Date(), ultima_mensagem_direcao: 'enviada' });
        return mensagem;
    }

    // Transcreve um áudio (recebido ou enviado) via Whisper (Groq) — leitura
    // rápida pro atendente sem precisar ouvir o áudio inteiro.
    async transcrever(conversaId, mensagemId, user) {
        const conversa = await conversaService.buscarPorId(conversaId, user);
        const mensagem = await WhatsappMensagem.findOne({ where: { id: mensagemId, conversa_id: conversa.id } });
        if (!mensagem) throw new ApiError(404, 'Mensagem não encontrada');
        if (mensagem.tipo !== 'audio' || !mensagem.midia_url) throw new ApiError(400, 'Essa mensagem não é um áudio');
        if (mensagem.transcricao) return mensagem;

        const texto = await transcricaoService.transcreverUrl(mensagem.midia_url);
        await mensagem.update({ transcricao: texto });
        return mensagem;
    }
}

export default new MensagemService();
