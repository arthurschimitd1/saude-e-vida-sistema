import crypto from 'crypto';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import webhookService from './WebhookService.js';
import { decryptCredential } from '../../utils/credentialCrypto.js';

function credencial(value) {
    if (!value) return null;
    try { return decryptCredential(value); } catch { return value; }
}

function assinaturaValida(config, rawBody, recebido) {
    const appSecret = credencial(config?.meta_app_secret);
    if (!appSecret) return false;
    const esperado = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody || '').digest('hex')}`;
    const a = Buffer.from(String(recebido || ''));
    const b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizarMensagem(mensagem, nomeContato) {
    const base = {
        phone: mensagem.from,
        messageId: mensagem.id,
        fromMe: false,
        senderName: nomeContato || mensagem.from,
        chatName: nomeContato || mensagem.from,
    };
    if (mensagem.type === 'text') return { ...base, text: { message: mensagem.text?.body || '' } };
    if (mensagem.type === 'image') return { ...base, image: { caption: mensagem.image?.caption || null } };
    if (mensagem.type === 'video') return { ...base, video: { caption: mensagem.video?.caption || null } };
    if (mensagem.type === 'audio') return { ...base, audio: {} };
    if (mensagem.type === 'document') return { ...base, document: { fileName: mensagem.document?.filename || null } };
    if (mensagem.type === 'location') return { ...base, location: mensagem.location || {} };
    if (mensagem.type === 'contacts') return { ...base, contacts: mensagem.contacts || [] };
    if (mensagem.type === 'reaction') return { ...base, text: { message: `Reação: ${mensagem.reaction?.emoji || '👍'}` } };
    return { ...base, text: { message: `[${mensagem.type || 'mensagem'} recebida pela Meta]` } };
}

class MetaWebhookService {
    validarAssinatura(config, rawBody, assinatura) {
        return assinaturaValida(config, rawBody, assinatura);
    }

    async processar(config, payload) {
        const resumo = { mensagens: 0, status: 0, ignorados: 0, conversas: [] };
        for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
            if (config.meta_business_account_id && String(entry.id) !== String(config.meta_business_account_id)) {
                resumo.ignorados += 1;
                continue;
            }
            for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
                if (change.field !== 'messages') {
                    resumo.ignorados += 1;
                    continue;
                }
                const value = change.value || {};
                if (config.meta_phone_number_id && value.metadata?.phone_number_id && String(value.metadata.phone_number_id) !== String(config.meta_phone_number_id)) {
                    resumo.ignorados += 1;
                    continue;
                }
                const contatos = new Map((value.contacts || []).map((contato) => [String(contato.wa_id), contato.profile?.name || contato.wa_id]));
                for (const mensagem of value.messages || []) {
                    if (!mensagem.from || !mensagem.id) {
                        resumo.ignorados += 1;
                        continue;
                    }
                    const resultado = await webhookService.processarMensagemRecebida(
                        config.empresa_id,
                        normalizarMensagem(mensagem, contatos.get(String(mensagem.from))),
                    );
                    resumo.mensagens += resultado?.duplicada ? 0 : 1;
                    if (resultado?.conversaId) resumo.conversas.push(resultado.conversaId);
                }
                const statuses = value.statuses || [];
                if (statuses.length) {
                    const mapa = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falha' };
                    for (const status of statuses) {
                        if (status.id && mapa[status.status]) {
                            await WhatsappMensagem.update(
                                { status: mapa[status.status] },
                                { where: { empresa_id: config.empresa_id, zapi_message_id: status.id } },
                            );
                        }
                    }
                    resumo.status += statuses.length;
                }
            }
        }
        resumo.conversas = [...new Set(resumo.conversas)];
        return resumo;
    }
}

export default new MetaWebhookService();
