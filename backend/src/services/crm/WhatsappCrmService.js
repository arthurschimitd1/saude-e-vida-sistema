import axios from 'axios';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { Op } from 'sequelize';
import CrmWhatsappConfig from '../../models/CrmWhatsappConfig.js';
import CrmWhatsappConversa from '../../models/CrmWhatsappConversa.js';
import CrmWhatsappMensagem from '../../models/CrmWhatsappMensagem.js';
import CrmProspect from '../../models/CrmProspect.js';
import CrmInteracao from '../../models/CrmInteracao.js';
import Cliente from '../../models/Cliente.js';
import User from '../../models/UserModel.js';
import sequelize from '../../config/database.js';
import { decryptCredential, encryptCredential } from '../../utils/credentialCrypto.js';
import { empresaParaGravar } from '../../utils/empresaScope.js';
import ApiError from '../../utils/apiError.js';
import { analisarQualificacaoLead, gerarVariacoesMensagem } from './GeminiService.js';

const ZAPI_URL = 'https://api.z-api.io/instances';

function getEmpresaId(user) {
    const empresaId = empresaParaGravar(user);
    if (!empresaId) throw new Error('Selecione uma empresa para acessar o WhatsApp CRM');
    return empresaId;
}

function normalizePhone(value) {
    const phone = String(value || '').replace(/@.+$/, '').replace(/\D/g, '');
    if (!phone) return '';
    return phone.startsWith('55') ? phone : `55${phone}`;
}

function localPhone(value) {
    const phone = String(value || '').replace(/@.+$/, '').replace(/\D/g, '');
    return phone.startsWith('55') && [12, 13].includes(phone.length) ? phone.slice(2) : phone;
}

function phoneVariants(value) {
    const local = localPhone(value);
    if (!local) return [];
    const variants = new Set([local, `55${local}`]);
    if (local.length === 10) variants.add(`${local.slice(0, 2)}9${local.slice(2)}`);
    if (local.length === 11 && local[2] === '9') variants.add(`${local.slice(0, 2)}${local.slice(3)}`);
    return [...variants].flatMap((phone) => phone.startsWith('55') ? [phone] : [phone, `55${phone}`]);
}

function webhookPhone(payload) {
    const candidates = [
        payload.phone,
        payload.connectedPhone,
        payload.phoneConnected,
        payload.participantPhone,
        payload.sender?.phone,
        payload.sender?.id,
        payload.senderId,
        payload.chatId,
        payload.to,
        payload.from,
        payload.owner,
    ];
    return normalizePhone(candidates.find((item) => normalizePhone(item)));
}

function webhookFromMe(payload) {
    return payload.fromMe === true
        || payload.fromMe === 'true'
        || payload.fromApi === true
        || payload.fromApi === 'true'
        || payload.senderType === 'me'
        || payload.owner === true
        || payload.owner === 'true'
        || payload.direction === 'out';
}

function configCredentials(config) {
    try {
        return {
            instanceId: config.instance_id,
            token: decryptCredential(config.token_encrypted),
            clientToken: decryptCredential(config.client_token_encrypted),
        };
    } catch {
        throw new ApiError(409, 'As credenciais da Z-API precisam ser salvas novamente para esta empresa');
    }
}

function zapiClient(config) {
    const credentials = configCredentials(config);
    return {
        credentials,
        client: axios.create({
            baseURL: `${ZAPI_URL}/${encodeURIComponent(credentials.instanceId)}/token/${encodeURIComponent(credentials.token)}`,
            headers: { 'Client-Token': credentials.clientToken, 'Content-Type': 'application/json' },
            timeout: 15000,
        }),
    };
}

function payloadDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && Number.isNaN(Number(value))) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return new Date();
    return new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp);
}

function messageContent(payload) {
    if (payload.text?.message || payload.text?.text) {
        return { type: 'text', content: payload.text.message || payload.text.text, mediaUrl: null };
    }

    const mediaTypes = ['image', 'audio', 'video', 'document', 'sticker'];
    for (const type of mediaTypes) {
        const media = payload[type];
        if (!media) continue;
        return {
            type,
            content: media.caption || media.fileName || media.filename || `[${type}]`,
            mediaUrl: media.imageUrl || media.audioUrl || media.videoUrl || media.documentUrl || media.stickerUrl || media.url || null,
        };
    }

    const interactive = payload.buttonsResponseMessage || payload.listResponseMessage || payload.buttonReply || payload.listReply;
    if (interactive) {
        return { type: 'text', content: interactive.message || interactive.title || interactive.selectedDisplayText || interactive.displayText || interactive.buttonText || '[resposta interativa]', mediaUrl: null };
    }
    if (payload.reaction?.value || payload.reaction?.emoji) {
        return { type: 'reaction', content: payload.reaction.value || payload.reaction.emoji, mediaUrl: null };
    }
    if (payload.location) {
        const { latitude, longitude, name, address } = payload.location;
        return { type: 'location', content: name || address || `${latitude}, ${longitude}`, mediaUrl: null };
    }
    if (payload.contact) return { type: 'contact', content: payload.contact.displayName || payload.contact.name || 'Contato', mediaUrl: null };
    const textValue = payload.message?.text
        || payload.message?.message
        || payload.message?.body
        || payload.message
        || payload.body
        || payload.caption
        || payload.content
        || payload.messageContent
        || payload.lastMessage
        || '';
    return { type: 'text', content: typeof textValue === 'string' ? textValue : '', mediaUrl: null };
}

function unwrapWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    for (const key of ['data', 'payload', 'event']) {
        const nested = payload[key];
        if (nested && typeof nested === 'object' && (nested.type || nested.phone || nested.messageId)) return nested;
    }
    return payload;
}

function collectMessagePayloads(source) {
    if (!source || typeof source !== 'object') return [];
    const candidates = [
        source.messages,
        source.msgs,
        source.lastMessages,
        source.recentMessages,
        source.chatMessages,
        source.data?.messages,
        source.data?.msgs,
    ];
    const messages = candidates.find((item) => Array.isArray(item));
    if (messages) return messages;

    const single = source.lastMessage || source.message || source.last_message;
    if (single && typeof single === 'object') return [single];
    if (typeof single === 'string') return [{ ...source, text: { message: single } }];
    return [];
}

function zapiMessageExternalId(message, conversation) {
    const explicitId = message.messageId || message.zaapId || message.id || message._id || message.key?.id;
    if (explicitId) return String(explicitId);

    const content = messageContent(message).content || '';
    const timestamp = message.momment || message.timestamp || message.createdAt || message.created || conversation.last_message_at || '';
    if (!content && !timestamp) return null;
    return `zapi-sync:${conversation.phone}:${timestamp}:${crypto.createHash('sha1').update(content).digest('hex').slice(0, 16)}`;
}

function zapiMessageSentAt(message, fallbackDate = null) {
    return payloadDate(message.momment || message.timestamp || message.time || message.createdAt || message.created || fallbackDate || Date.now());
}

function hasReadableMessage(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (messageContent(payload).content) return true;
    return ['image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction'].some((key) => Boolean(payload[key]));
}

function fallbackQualification(messages) {
    const inbound = messages.filter((item) => item.direction === 'in').map((item) => String(item.content || '').toLowerCase()).join(' ');
    const negative = /não tenho interesse|nao tenho interesse|não quero|nao quero|pare de|remov[ae]|número errado|numero errado|não me mande|nao me mande/.test(inbound);
    const meeting = /reuni[aã]o|demonstra[cç][aã]o|agenda|agendar|marcar um hor[aá]rio|pode me ligar/.test(inbound);
    const commercial = /pre[cç]o|valor|proposta|or[cç]amento|quanto custa|condi[cç][oõ]es|plano|contrato/.test(inbound);
    const interest = /tenho interesse|me interessa|quero saber|como funciona|pode explicar|me manda|gostaria|vamos conversar/.test(inbound);
    const score = negative ? 5 : meeting ? 90 : commercial ? 78 : interest ? 62 : inbound.trim() ? 30 : 0;
    return {
        score,
        temperatura: score >= 81 ? 'Muito Quente' : score >= 61 ? 'Quente' : score >= 31 ? 'Morno' : 'Frio',
        intencao: negative ? 'negativo' : meeting || commercial ? 'oportunidade' : interest ? 'interessado' : 'neutro',
        tags: negative ? ['Sem interesse'] : meeting ? ['Lead quente', 'Reunião'] : commercial ? ['Lead quente', 'Pediu proposta'] : interest ? ['Interessado'] : [],
        resumo: negative ? 'O contato demonstrou que não deseja continuar a conversa.' : meeting ? 'O contato demonstrou intenção de avançar para uma conversa ou demonstração.' : commercial ? 'O contato pediu informações comerciais.' : interest ? 'O contato demonstrou interesse inicial.' : 'Ainda não há sinal comercial suficiente.',
    };
}

class WhatsappCrmService {
    async getConfig(user) {
        const empresaId = getEmpresaId(user);
        const config = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId } });
        if (!config) return { configured: false, provider: 'zapi' };
        return {
            configured: true,
            provider: config.provider,
            instance_id: config.instance_id,
            active: config.active,
            webhook_url: this.webhookUrl(config),
        };
    }

    async saveConfig(data, user) {
        const empresaId = getEmpresaId(user);
        const instanceId = String(data.instance_id || '').trim();
        const token = String(data.token || '').trim();
        const clientToken = String(data.client_token || '').trim();
        const existing = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId } });
        if (!instanceId || (!token && !existing?.token_encrypted) || (!clientToken && !existing?.client_token_encrypted)) {
            throw new Error('Informe a instância, o token e o Client-Token da Z-API');
        }
        const values = {
            empresa_id: empresaId,
            provider: 'zapi',
            instance_id: instanceId,
            token_encrypted: token ? encryptCredential(token) : existing.token_encrypted,
            client_token_encrypted: clientToken ? encryptCredential(clientToken) : existing.client_token_encrypted,
            webhook_secret: existing?.webhook_secret || crypto.randomBytes(24).toString('hex'),
            active: true,
        };
        const status = await this.checkStatusFromConfig(values);
        if (!status.reachable) {
            throw new ApiError(400, status.detail ? `Z-API recusou as credenciais: ${status.detail}` : 'Não foi possível validar as credenciais informadas na Z-API');
        }
        const config = existing ? await existing.update(values) : await CrmWhatsappConfig.create(values);
        const webhookConfigured = await this.configureWebhooks(config);
        return { ...(await this.getConfig(user)), status, webhook_configured: webhookConfigured };
    }

    webhookUrl(config) {
        const base = String(process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
        return base ? `${base}/api/crm/whatsapp/webhook/${encodeURIComponent(config.instance_id)}/${config.webhook_secret}` : null;
    }

    async checkStatusFromConfig(config) {
        try {
            const { client } = zapiClient(config);
            const { data } = await client.get('/status');
            return { credentials_valid: true, reachable: true, connected: Boolean(data?.connected), smartphone_connected: Boolean(data?.smartphoneConnected), detail: data?.error || null };
        } catch (error) {
            const credentialsInvalid = error.statusCode === 409 || error.status === 409;
            return {
                credentials_valid: !credentialsInvalid,
                reachable: false,
                connected: credentialsInvalid ? null : false,
                smartphone_connected: credentialsInvalid ? null : false,
                detail: error.response?.data?.message || error.message,
            };
        }
    }

    async getStatus(user) {
        const empresaId = getEmpresaId(user);
        const config = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId, active: true } });
        if (!config) return { configured: false, connected: false, provider: 'zapi' };
        return { configured: true, provider: 'zapi', ...(await this.checkStatusFromConfig(config)) };
    }

    async configureWebhooks(config) {
        const webhookUrl = this.webhookUrl(config);
        if (!webhookUrl?.startsWith('https://')) return false;
        try {
            const { client } = zapiClient(config);
            const required = await Promise.allSettled([
                client.put('/update-webhook-received', { value: webhookUrl }),
                client.put('/update-webhook-delivery', { value: webhookUrl }),
                client.put('/update-notify-sent-by-me', { notifySentByMe: true }),
            ]);

            const optional = await Promise.allSettled([
                client.put('/update-webhook-message-status', { value: webhookUrl }),
                client.put('/update-webhook-connected', { value: webhookUrl }),
                client.put('/update-webhook-disconnected', { value: webhookUrl }),
                client.put('/update-every-webhooks', { value: webhookUrl, notifySentByMe: true }),
            ]);

            [...required, ...optional]
                .filter((result) => result.status === 'rejected')
                .forEach((result) => console.error('Erro ao configurar webhook da Z-API:', result.reason?.response?.data || result.reason?.message || result.reason));

            return required.every((result) => result.status === 'fulfilled');
        } catch (error) {
            console.error('Erro ao configurar webhooks da Z-API:', error.response?.data || error.message);
            return false;
        }
    }

    async getQrCode(user) {
        const empresaId = getEmpresaId(user);
        const config = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId, active: true } });
        if (!config) throw new Error('Configure a integração Z-API antes de gerar o QR Code');
        const { client } = zapiClient(config);
        let qrValue = '';
        try {
            const { data } = await client.get('/qr-code/image');
            qrValue = typeof data === 'string' ? data : data?.value || '';
        } catch {
            const { data } = await client.get('/qr-code');
            qrValue = typeof data === 'string' ? data : data?.value || '';
        }
        if (!qrValue) throw new Error('A Z-API não retornou um QR Code. Verifique se a instância já está conectada');
        const value = String(qrValue).trim();
        if (value.startsWith('data:image/')) return { value };

        const pngBase64 = value.replace(/\s/g, '');
        if (pngBase64.startsWith('iVBORw0KGgo')) {
            return { value: `data:image/png;base64,${pngBase64}` };
        }

        return { value: await QRCode.toDataURL(value, { width: 360, margin: 2, errorCorrectionLevel: 'M' }) };
    }

    async syncChats(user) {
        const empresaId = getEmpresaId(user);
        const config = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId, active: true } });
        if (!config) throw new Error('Configure a integração Z-API antes de sincronizar conversas');
        const webhookConfigured = await this.configureWebhooks(config);
        const { client } = zapiClient(config);
        const { data } = await client.get('/chats', { params: { page: 1, pageSize: 100 } });
        const chats = Array.isArray(data) ? data : data?.chats || [];
        let imported = 0;
        for (const chat of chats) {
            if (chat.isGroup || chat.isNewsletter || chat.isBroadcast) continue;
            const phone = normalizePhone(chat.phone || chat.id);
            if (!phone) continue;
            const lastMessageAt = chat.lastMessageTime ? payloadDate(chat.lastMessageTime) : null;
            const [conversation, created] = await CrmWhatsappConversa.findOrCreate({
                where: { empresa_id: empresaId, phone },
                defaults: {
                    empresa_id: empresaId,
                    phone,
                    name: chat.name || chat.chatName || phone,
                    avatar_url: chat.profileThumbnail || chat.image || null,
                    status: 'aberto',
                    tags: [],
                    unread_count: Number(chat.unread || chat.messagesUnread || 0),
                    last_message_at: lastMessageAt,
                },
            });
            if (!created) {
                await conversation.update({
                    name: chat.name || chat.chatName || conversation.name,
                    avatar_url: chat.profileThumbnail || chat.image || conversation.avatar_url,
                    unread_count: Math.max(conversation.unread_count, Number(chat.unread || chat.messagesUnread || 0)),
                    last_message_at: lastMessageAt || conversation.last_message_at,
                });
            }
            await this.importMessagesFromPayload(conversation, chat);
            imported += 1;
        }
        return { imported, webhook_configured: webhookConfigured };
    }

    async importMessagesFromPayload(conversation, payload) {
        const messages = collectMessagePayloads(payload);
        let imported = 0;
        for (const item of messages) {
            const externalId = zapiMessageExternalId(item, conversation);
            if (!externalId) continue;
            const exists = await CrmWhatsappMensagem.findOne({
                where: { empresa_id: conversation.empresa_id, external_id: externalId },
                attributes: ['id'],
            });
            if (exists) continue;

            const content = messageContent(item);
            const fromMe = item.fromMe === true || item.fromMe === 'true' || item.fromApi === true || item.direction === 'out';
            await CrmWhatsappMensagem.create({
                empresa_id: conversation.empresa_id,
                conversa_id: conversation.id,
                external_id: externalId,
                direction: fromMe ? 'out' : 'in',
                type: content.type,
                content: content.content,
                media_url: content.mediaUrl,
                status: fromMe ? 'enviada' : 'recebida',
                sent_at: zapiMessageSentAt(item, conversation.last_message_at),
                raw_payload: item,
            });
            imported += 1;
        }
        return imported;
    }

    async hydrateConversationMessages(conversation, config = null) {
        const activeConfig = config || await CrmWhatsappConfig.findOne({ where: { empresa_id: conversation.empresa_id, active: true } });
        if (!activeConfig) return 0;
        try {
            const { client } = zapiClient(activeConfig);
            const { data } = await client.get(`/chats/${encodeURIComponent(conversation.phone)}`);
            return this.importMessagesFromPayload(conversation, data);
        } catch (error) {
            console.warn('Não foi possível importar mensagens do chat Z-API:', error.response?.data || error.message);
            return 0;
        }
    }

    async listConversations({ status, search } = {}, user) {
        const empresaId = getEmpresaId(user);
        const where = { empresa_id: empresaId };
        if (status && status !== 'todos') where.status = status;
        if (search) {
            const term = String(search).trim();
            const digits = term.replace(/\D/g, '');
            const phoneTerm = normalizePhone(term);
            const [clients, prospects] = await Promise.all([
                Cliente.findAll({
                    where: {
                        empresa_id: empresaId,
                        [Op.or]: [
                            { nomeCompleto: { [Op.iLike]: `%${term}%` } },
                            ...(digits ? [{ telefone: { [Op.iLike]: `%${digits}%` } }] : []),
                        ],
                    },
                    attributes: ['id', 'telefone'],
                }),
                CrmProspect.findAll({
                    where: {
                        empresa_id: empresaId,
                        [Op.or]: [
                            { company_name: { [Op.iLike]: `%${term}%` } },
                            { responsible_name: { [Op.iLike]: `%${term}%` } },
                            ...(digits ? [{ phone: { [Op.iLike]: `%${digits}%` } }] : []),
                        ],
                    },
                    attributes: ['id'],
                }),
            ]);
            where[Op.or] = [
                { name: { [Op.iLike]: `%${term}%` } },
                sequelize.where(sequelize.cast(sequelize.col('tags'), 'TEXT'), { [Op.iLike]: `%${term}%` }),
                ...(phoneTerm ? [{ phone: { [Op.iLike]: `%${phoneTerm}%` } }] : []),
                ...(clients.length ? [{ cliente_id: { [Op.in]: clients.map((item) => item.id) } }] : []),
                ...clients.flatMap((item) => phoneVariants(item.telefone).map((phone) => ({ phone }))),
                ...(prospects.length ? [{ prospect_id: { [Op.in]: prospects.map((item) => item.id) } }] : []),
            ];
        }
        const conversations = await CrmWhatsappConversa.findAll({ where, order: [['last_message_at', 'DESC'], ['updated_at', 'DESC']] });
        const ids = conversations.map((item) => item.id);
        const userIds = [...new Set(conversations.map((item) => item.assigned_user_id).filter(Boolean))];
        const clientIds = [...new Set(conversations.map((item) => item.cliente_id).filter(Boolean))];
        const prospectIds = [...new Set(conversations.map((item) => item.prospect_id).filter(Boolean))];
        const conversationPhones = [...new Set(conversations.flatMap((item) => phoneVariants(item.phone)))];
        const clientWhere = [];
        if (clientIds.length) clientWhere.push({ id: { [Op.in]: clientIds } });
        if (conversationPhones.length) {
            clientWhere.push(sequelize.where(
                sequelize.fn('regexp_replace', sequelize.col('telefone'), '[^0-9]', '', 'g'),
                { [Op.in]: conversationPhones },
            ));
        }
        const [messages, assignedUsers, clients, prospects] = await Promise.all([
            ids.length ? CrmWhatsappMensagem.findAll({
                where: { empresa_id: empresaId, conversa_id: { [Op.in]: ids } },
                order: [['sent_at', 'DESC']],
            }) : [],
            userIds.length ? User.findAll({ where: { id: { [Op.in]: userIds }, empresa_id: empresaId }, attributes: ['id', 'nomeCompleto', 'avatar_url'] }) : [],
            clientWhere.length ? Cliente.findAll({
                where: { empresa_id: empresaId, [Op.or]: clientWhere },
                attributes: ['id', 'nomeCompleto', 'telefone'],
            }) : [],
            prospectIds.length ? CrmProspect.findAll({
                where: { empresa_id: empresaId, id: { [Op.in]: prospectIds } },
                attributes: ['id', 'lead_score', 'status'],
            }) : [],
        ]);
        const latest = new Map();
        for (const message of messages) if (!latest.has(message.conversa_id)) latest.set(message.conversa_id, message);
        const usersById = new Map(assignedUsers.map((item) => [item.id, item.toJSON()]));
        const clientsById = new Map(clients.map((item) => [item.id, item.nomeCompleto]));
        const clientsByPhone = new Map(clients.map((item) => [localPhone(item.telefone), item.nomeCompleto]));
        const prospectsById = new Map(prospects.map((item) => [item.id, item.toJSON()]));
        return conversations.map((conversation) => {
            const clientName = clientsById.get(conversation.cliente_id) || clientsByPhone.get(localPhone(conversation.phone)) || null;
            const prospect = prospectsById.get(conversation.prospect_id) || null;
            return {
                ...conversation.toJSON(),
                client_name: clientName,
                lead_score: prospect?.lead_score ?? null,
                lead_status: prospect?.status ?? null,
                assigned_user: usersById.get(conversation.assigned_user_id) || null,
                last_message: latest.get(conversation.id)?.toJSON() || null,
            };
        });
    }

    async listAgents(user) {
        const empresaId = getEmpresaId(user);
        return User.findAll({
            where: { empresa_id: empresaId, status: 'ativo' },
            attributes: ['id', 'nomeCompleto', 'cargo', 'avatar_url'],
            order: [['nomeCompleto', 'ASC']],
        });
    }

    async createConversation(data, user) {
        const empresaId = getEmpresaId(user);
        const phone = normalizePhone(data.phone);
        if (phone.length < 12) throw new Error('Informe um WhatsApp válido com DDD');
        const prospect = data.prospect_id ? await CrmProspect.findOne({ where: { id: data.prospect_id, empresa_id: empresaId } }) : null;
        const [conversation, created] = await CrmWhatsappConversa.findOrCreate({
            where: { empresa_id: empresaId, phone },
            defaults: {
                empresa_id: empresaId,
                prospect_id: prospect?.id || null,
                phone,
                name: String(data.name || prospect?.responsible_name || prospect?.company_name || phone).trim(),
                status: 'aberto',
                tags: [],
            },
        });
        if (!created && data.name) await conversation.update({ name: String(data.name).trim() });
        return conversation;
    }

    async getMessages(conversationId, user) {
        const empresaId = getEmpresaId(user);
        const conversation = await CrmWhatsappConversa.findOne({ where: { id: conversationId, empresa_id: empresaId } });
        if (!conversation) throw new Error('Conversa não encontrada');
        const currentCount = await CrmWhatsappMensagem.count({ where: { conversa_id: conversation.id, empresa_id: empresaId } });
        if (currentCount === 0 || conversation.unread_count > 0) {
            await this.hydrateConversationMessages(conversation);
        }
        await conversation.update({ unread_count: 0 });
        return CrmWhatsappMensagem.findAll({ where: { conversa_id: conversation.id, empresa_id: empresaId }, order: [['sent_at', 'ASC']] });
    }

    async sendText(conversationId, content, user) {
        const empresaId = getEmpresaId(user);
        const message = String(content || '').trim();
        if (!message) throw new Error('Digite uma mensagem');
        const [conversation, config] = await Promise.all([
            CrmWhatsappConversa.findOne({ where: { id: conversationId, empresa_id: empresaId } }),
            CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId, active: true } }),
        ]);
        if (!conversation) throw new Error('Conversa não encontrada');
        if (!config) throw new Error('Configure a integração Z-API antes de enviar mensagens');

        const { client } = zapiClient(config);
        const { data } = await client.post('/send-text', { phone: conversation.phone, message });
        const sentAt = new Date();
        const saved = await CrmWhatsappMensagem.create({
            empresa_id: empresaId,
            conversa_id: conversation.id,
            external_id: data?.messageId || data?.zaapId || data?.id || null,
            direction: 'out',
            type: 'text',
            content: message,
            status: 'enviada',
            sent_by: user.id,
            sent_at: sentAt,
        });
        await conversation.update({ last_message_at: sentAt, status: conversation.status === 'resolvido' ? 'aberto' : conversation.status });
        return saved;
    }

    async sendTextToPhone(phoneValue, content, user, cliente = null) {
        const empresaId = getEmpresaId(user);
        const phone = normalizePhone(phoneValue);
        const message = String(content || '').trim();
        if (phone.length < 12) throw new ApiError(400, 'O cliente não possui um WhatsApp válido');
        if (!message) throw new ApiError(400, 'A mensagem do cupom está vazia');
        const config = await CrmWhatsappConfig.findOne({ where: { empresa_id: empresaId, active: true } });
        if (!config) throw new ApiError(409, 'Configure e conecte o WhatsApp CRM antes de enviar cupons');
        const { client } = zapiClient(config);
        const { data } = await client.post('/send-text', { phone, message });
        const [conversation] = await CrmWhatsappConversa.findOrCreate({
            where: { empresa_id: empresaId, phone },
            defaults: { empresa_id: empresaId, cliente_id: cliente?.id || null, phone, name: cliente?.nomeCompleto || phone, status: 'aberto', tags: [] },
        });
        if (cliente?.id && !conversation.cliente_id) await conversation.update({ cliente_id: cliente.id });
        const sentAt = new Date();
        const saved = await CrmWhatsappMensagem.create({
            empresa_id: empresaId,
            conversa_id: conversation.id,
            external_id: data?.messageId || data?.zaapId || data?.id || null,
            direction: 'out',
            type: 'text',
            content: message,
            status: 'enviada',
            sent_by: user.id,
            sent_at: sentAt,
        });
        await conversation.update({ last_message_at: sentAt, status: conversation.status === 'resolvido' ? 'aberto' : conversation.status });
        return saved;
    }

    async updateConversation(conversationId, values, user) {
        const empresaId = getEmpresaId(user);
        const conversation = await CrmWhatsappConversa.findOne({ where: { id: conversationId, empresa_id: empresaId } });
        if (!conversation) throw new Error('Conversa não encontrada');
        const allowed = {};
        if (['aberto', 'aguardando', 'resolvido'].includes(values.status)) allowed.status = values.status;
        if (values.assigned_user_id !== undefined) {
            const assignedUserId = values.assigned_user_id ? Number(values.assigned_user_id) : null;
            if (assignedUserId) {
                const assignedUser = await User.findOne({ where: { id: assignedUserId, empresa_id: empresaId, status: 'ativo' } });
                if (!assignedUser) throw new ApiError(400, 'Responsável não encontrado nesta empresa');
            }
            allowed.assigned_user_id = assignedUserId;
        }
        if (values.tags !== undefined) {
            if (!Array.isArray(values.tags)) throw new ApiError(400, 'Tags inválidas');
            allowed.tags = [...new Set(values.tags
                .map((tag) => String(tag).trim())
                .filter(Boolean)
                .map((tag) => tag.slice(0, 30)))]
                .slice(0, 12);
        }
        return conversation.update(allowed);
    }

    async bulkSend({ conversation_ids: conversationIds, content, vary_with_ai: varyWithAi = true }, user) {
        const empresaId = getEmpresaId(user);
        const ids = [...new Set((Array.isArray(conversationIds) ? conversationIds : []).map(Number).filter(Number.isInteger))];
        const message = String(content || '').trim();
        if (!message) throw new ApiError(400, 'Digite a mensagem do disparo');
        if (!ids.length) throw new ApiError(400, 'Selecione pelo menos uma conversa');
        if (ids.length > 20) throw new ApiError(400, 'Selecione no máximo 20 conversas por disparo');

        const conversations = await CrmWhatsappConversa.findAll({ where: { id: { [Op.in]: ids }, empresa_id: empresaId } });
        if (conversations.length !== ids.length) throw new ApiError(400, 'Uma ou mais conversas não pertencem à empresa selecionada');

        let aiWarning = null;
        let variations = [];
        if (varyWithAi && conversations.length > 1) {
            try {
                variations = await gerarVariacoesMensagem(message, Math.min(conversations.length - 1, 9));
            } catch (error) {
                aiWarning = error.message || 'Não foi possível gerar variações com IA';
            }
        }
        const messagePool = [message, ...variations];

        const results = [];
        for (let index = 0; index < conversations.length; index += 3) {
            const batch = conversations.slice(index, index + 3);
            const batchResults = await Promise.all(batch.map(async (conversation, batchIndex) => {
                try {
                    const messageIndex = index + batchIndex;
                    await this.sendText(conversation.id, messagePool[messageIndex % messagePool.length], user);
                    return { conversation_id: conversation.id, success: true };
                } catch (error) {
                    return { conversation_id: conversation.id, success: false, error: error.message };
                }
            }));
            results.push(...batchResults);
            if (index + 3 < conversations.length) await new Promise((resolve) => setTimeout(resolve, 350));
        }
        return {
            total: results.length,
            sent: results.filter((item) => item.success).length,
            failed: results.filter((item) => !item.success).length,
            ai_variations_used: variations.length > 0,
            variations_generated: variations.length,
            ai_warning: aiWarning,
            results,
        };
    }

    async sendProspectsBatch({ prospect_ids: prospectIds, mensagens }, user) {
        const empresaId = getEmpresaId(user);
        const ids = [...new Set((Array.isArray(prospectIds) ? prospectIds : []).map(Number).filter(Number.isInteger))];
        if (!ids.length) throw new ApiError(400, 'Selecione pelo menos um lead');
        if (!Array.isArray(mensagens) || !mensagens.length) throw new ApiError(400, 'Adicione pelo menos uma mensagem');
        const templates = mensagens.map((item) => String(item).trim()).filter(Boolean);
        if (!templates.length) throw new ApiError(400, 'Adicione pelo menos uma mensagem válida');
        const prospects = await CrmProspect.findAll({ where: { id: { [Op.in]: ids }, empresa_id: empresaId } });
        if (prospects.length !== ids.length) throw new ApiError(400, 'Um ou mais leads não pertencem à empresa selecionada');

        const resultados = [];
        for (const prospect of prospects) {
            if (!prospect?.phone) {
                resultados.push({ empresa: prospect?.company_name || 'Sem nome', status: 'sem_telefone' });
                continue;
            }

            try {
                const conversation = await this.createConversation({
                    name: prospect.responsible_name || prospect.company_name,
                    phone: prospect.phone,
                    prospect_id: prospect.id,
                }, user);
                const template = templates[Math.floor(Math.random() * templates.length)];
                const message = template
                    .replace(/\{empresa\}/gi, prospect.company_name || '')
                    .replace(/\{cidade\}/gi, prospect.city || '');
                await this.sendText(conversation.id, message, user);
                resultados.push({ empresa: prospect.company_name, status: 'enviado' });
            } catch (error) {
                resultados.push({ empresa: prospect.company_name, status: 'erro', erro: error.message });
            }
        }

        return resultados;
    }

    async qualifyConversation(conversation) {
        if (!conversation.prospect_id) return null;
        const prospect = await CrmProspect.findOne({
            where: { id: conversation.prospect_id, empresa_id: conversation.empresa_id },
        });
        if (!prospect) return null;

        const messages = await CrmWhatsappMensagem.findAll({
            where: { empresa_id: conversation.empresa_id, conversa_id: conversation.id },
            attributes: ['direction', 'content'],
            order: [['sent_at', 'DESC']],
            limit: 20,
        });
        const history = messages.reverse().map((item) => item.toJSON());
        let qualification = fallbackQualification(history);
        try {
            qualification = await analisarQualificacaoLead(history);
        } catch (error) {
            console.warn('Qualificação Groq indisponível; aplicada análise local:', error.message);
        }

        const automaticTags = new Set(['Lead frio', 'Lead morno', 'Lead quente', 'Lead muito quente', 'Sem interesse', 'Interessado', 'Pediu proposta', 'Reunião']);
        const currentTags = Array.isArray(conversation.tags) ? conversation.tags : [];
        const temperatureTag = `Lead ${qualification.temperatura.toLowerCase()}`;
        const tags = [...new Set([
            ...currentTags.filter((tag) => !automaticTags.has(tag)),
            temperatureTag,
            ...qualification.tags,
        ])].slice(0, 12);
        const prospectValues = { lead_score: qualification.score };
        if (qualification.score >= 61 && ['Novo', 'Contatado', 'Sem Resposta'].includes(prospect.status)) {
            prospectValues.status = 'Interessado';
        }

        await Promise.all([
            conversation.update({ tags }),
            prospect.update(prospectValues),
            CrmInteracao.create({
                prospect_id: prospect.id,
                user_id: null,
                empresa_id: conversation.empresa_id,
                interaction_type: 'whatsapp_qualification',
                content: JSON.stringify({ ...qualification, conversa_id: conversation.id }),
            }),
        ]);
        return qualification;
    }

    async receiveWebhook(instanceId, secret, rawPayload) {
        const config = await CrmWhatsappConfig.findOne({ where: { instance_id: instanceId, webhook_secret: secret, active: true } });
        if (!config) return null;
        const payload = unwrapWebhookPayload(rawPayload);
        const phone = webhookPhone(payload);
        if (!phone || payload.isGroup || payload.isNewsletter || payload.broadcast || String(payload.chatId || '').includes('@g.us')) return null;

        const externalId = payload.messageId || payload.zaapId || payload.id || null;
        if (externalId) {
            const exists = await CrmWhatsappMensagem.findOne({ where: { empresa_id: config.empresa_id, external_id: externalId } });
            if (exists) return exists;
        }
        const message = messageContent(payload);
        const fromMe = webhookFromMe(payload);
        const sentAt = payload.momment ? payloadDate(payload.momment) : new Date();
        const variants = phoneVariants(phone);
        let conversation = await CrmWhatsappConversa.findOne({
            where: { empresa_id: config.empresa_id, phone: { [Op.in]: variants } },
        });
        let prospect = null;
        let client = null;
        if (!conversation) {
            [prospect, client] = await Promise.all([
                CrmProspect.findOne({
                    where: {
                        empresa_id: config.empresa_id,
                        [Op.and]: sequelize.where(
                            sequelize.fn('regexp_replace', sequelize.col('phone'), '[^0-9]', '', 'g'),
                            { [Op.in]: variants },
                        ),
                    },
                }),
                Cliente.findOne({
                    where: {
                        empresa_id: config.empresa_id,
                        [Op.and]: sequelize.where(
                            sequelize.fn('regexp_replace', sequelize.col('telefone'), '[^0-9]', '', 'g'),
                            { [Op.in]: variants },
                        ),
                    },
                }),
            ]);
            conversation = await CrmWhatsappConversa.create({
                empresa_id: config.empresa_id,
                prospect_id: prospect?.id || null,
                cliente_id: client?.id || null,
                phone,
                name: client?.nomeCompleto || prospect?.responsible_name || prospect?.company_name || payload.senderName || payload.chatName || phone,
                status: 'aberto',
                tags: [],
                unread_count: 0,
                last_message_at: sentAt,
            });
        } else if (!conversation.prospect_id) {
            prospect = await CrmProspect.findOne({
                where: {
                    empresa_id: config.empresa_id,
                    [Op.and]: sequelize.where(
                        sequelize.fn('regexp_replace', sequelize.col('phone'), '[^0-9]', '', 'g'),
                        { [Op.in]: variants },
                    ),
                },
            });
            if (prospect) await conversation.update({ prospect_id: prospect.id });
        }
        const saved = await CrmWhatsappMensagem.create({
            empresa_id: config.empresa_id,
            conversa_id: conversation.id,
            external_id: externalId,
            direction: fromMe ? 'out' : 'in',
            type: message.type,
            content: message.content,
            media_url: message.mediaUrl,
            status: fromMe ? 'enviada' : 'recebida',
            sent_at: sentAt,
            raw_payload: rawPayload,
        });
        await conversation.update({
            name: payload.senderName || payload.chatName || conversation.name,
            last_message_at: sentAt,
            status: fromMe ? conversation.status : 'aberto',
            unread_count: fromMe ? conversation.unread_count : conversation.unread_count + 1,
        });
        if (!fromMe && conversation.prospect_id) await this.qualifyConversation(conversation);
        return saved;
    }

    async handleWebhook(instanceId, secret, payload) {
        if (Array.isArray(payload)) {
            return Promise.all(payload.map((item) => this.handleWebhook(instanceId, secret, item)));
        }
        payload = unwrapWebhookPayload(payload);
        const config = await CrmWhatsappConfig.findOne({ where: { instance_id: instanceId, webhook_secret: secret, active: true } });
        if (!config) {
            console.warn('Webhook Z-API ignorado: configuração não encontrada para a instância informada.');
            return null;
        }
        if (payload.instanceId && String(payload.instanceId).toLowerCase() !== String(instanceId).toLowerCase()) {
            console.warn('Webhook Z-API com instanceId divergente:', { pathInstanceId: instanceId, payloadInstanceId: payload.instanceId });
            return null;
        }

        if (payload.type === 'MessageStatusCallback') {
            const ids = Array.isArray(payload.ids) ? payload.ids : [payload.messageId || payload.zaapId].filter(Boolean);
            if (ids.length) {
                await CrmWhatsappMensagem.update(
                    { status: String(payload.status || 'enviada').toLowerCase() },
                    { where: { empresa_id: config.empresa_id, external_id: { [Op.in]: ids } } },
                );
            }
            return { type: payload.type };
        }

        if (payload.type === 'DeliveryCallback') {
            const externalId = payload.messageId || payload.zaapId;
            if (externalId) {
                await CrmWhatsappMensagem.update(
                    { status: payload.error ? 'erro' : 'enviada' },
                    { where: { empresa_id: config.empresa_id, external_id: externalId } },
                );
            }
            return { type: payload.type };
        }

        if (payload.type && payload.type !== 'ReceivedCallback' && !hasReadableMessage(payload)) return { type: payload.type, ignored: true };
        return this.receiveWebhook(instanceId, secret, payload);
    }
}

export default new WhatsappCrmService();
