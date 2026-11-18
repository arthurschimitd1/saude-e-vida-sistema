import crypto from 'crypto';
import axios from 'axios';
import { decryptCredential } from '../../utils/credentialCrypto.js';

const GRAPH_BASE = 'https://graph.facebook.com';

function credencial(value) {
    if (!value) return null;
    try { return decryptCredential(value); } catch { return value; }
}

function versao(config) {
    const candidata = String(config?.meta_api_version || process.env.META_WHATSAPP_API_VERSION || 'v23.0').trim();
    return /^v\d+\.\d+$/.test(candidata) ? candidata : 'v23.0';
}

function token(config) {
    const accessToken = credencial(config?.meta_access_token);
    if (!accessToken) throw new Error('Access Token da Meta não configurado para esta empresa.');
    return accessToken;
}

function headers(config) {
    const accessToken = token(config);
    return { Authorization: `Bearer ${accessToken}` };
}

function appSecretProof(config) {
    const accessToken = token(config);
    const appSecret = credencial(config?.meta_app_secret);
    return appSecret ? crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex') : null;
}

function erroSeguro(error, operacao) {
    const detalhe = error?.response?.data?.error?.message || error?.response?.data?.error?.error_user_msg || error?.message;
    const mensagem = typeof detalhe === 'string' && detalhe.trim() ? detalhe.trim().slice(0, 300) : 'a Meta não respondeu corretamente';
    const wrapped = new Error(`Não foi possível ${operacao}: ${mensagem}`);
    wrapped.status = error?.response?.status >= 400 && error.response.status < 500 ? 422 : 502;
    return wrapped;
}

class MetaWhatsAppService {
    _url(config, resource) {
        return `${GRAPH_BASE}/${versao(config)}/${resource}`;
    }

    _params(config, params = {}) {
        const proof = appSecretProof(config);
        return proof ? { ...params, appsecret_proof: proof } : params;
    }

    async testarConexao(config) {
        if (!config?.meta_phone_number_id) throw new Error('Informe o Phone Number ID da Meta antes de testar.');
        try {
            const response = await axios.get(this._url(config, config.meta_phone_number_id), {
                headers: headers(config),
                params: this._params(config, {
                    fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput',
                }),
                timeout: 15000,
            });
            return response.data;
        } catch (error) {
            throw erroSeguro(error, 'validar a conexão com a Meta');
        }
    }

    async enviarTexto(config, { to, text }) {
        const telefone = String(to || '').replace(/\D/g, '');
        if (!telefone) throw new Error('O telefone do contato não é válido para a Meta.');
        if (!String(text || '').trim()) throw new Error('A mensagem não pode ficar vazia.');
        try {
            const response = await axios.post(this._url(config, `${config.meta_phone_number_id}/messages`), {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: telefone,
                type: 'text',
                text: { preview_url: false, body: String(text) },
            }, {
                headers: { ...headers(config), 'Content-Type': 'application/json' },
                params: this._params(config),
                timeout: 20000,
            });
            return response.data;
        } catch (error) {
            throw erroSeguro(error, 'enviar a mensagem pela Meta');
        }
    }
}

export default new MetaWhatsAppService();
