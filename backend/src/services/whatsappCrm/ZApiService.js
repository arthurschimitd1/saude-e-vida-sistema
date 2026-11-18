/**
 * Z-API — camada de comunicação com o WhatsApp (https://developer.z-api.io).
 * Credenciais são por empresa (WhatsappConfig), não por variável de ambiente —
 * cada clínica conecta sua própria instância Z-API.
 */
import axios from 'axios';
import { decryptCredential } from '../../utils/credentialCrypto.js';

const ZAPI_BASE = 'https://api.z-api.io';

function credencial(value) {
    if (!value) return null;
    try {
        return decryptCredential(value);
    } catch {
        return value;
    }
}

function montarUrl(config, endpoint) {
    if (!config?.zapi_instance_id || !config?.zapi_token) {
        throw new Error('Z-API não configurada para esta empresa (instance_id/token ausentes)');
    }
    return `${ZAPI_BASE}/instances/${config.zapi_instance_id}/token/${credencial(config.zapi_token)}/${endpoint}`;
}

function montarHeaders(config) {
    const headers = { 'Content-Type': 'application/json' };
    if (config?.zapi_client_token) headers['Client-Token'] = credencial(config.zapi_client_token);
    return headers;
}

// Nunca devolve a mensagem bruta do Axios: ela pode conter a URL completa da
// Z-API e, consequentemente, o token da instância.
function erroSeguro(error) {
    const resposta = error?.response?.data;
    const detalhe = resposta?.message || resposta?.error || resposta?.errorMessage;
    if (typeof detalhe === 'string' && detalhe.trim()) return detalhe.slice(0, 300);
    if (error?.code === 'ECONNABORTED') return 'A Z-API demorou mais que o esperado para responder';
    if (error?.response?.status) return `A Z-API recusou a operação (HTTP ${error.response.status})`;
    return 'Não foi possível comunicar com a Z-API';
}

class ZApiService {
    async configurarWebhooks(config, { recebimento, status }) {
        const headers = montarHeaders(config);
        const base = montarUrl(config, '');
        const requisicoes = [
            axios.put(`${base}update-webhook-received`, { value: recebimento }, { headers, timeout: 15000 }),
            axios.put(`${base}update-webhook-message-status`, { value: status }, { headers, timeout: 15000 }),
            axios.put(`${base}update-notify-sent-by-me`, { notifySentByMe: true }, { headers, timeout: 15000 }),
        ];
        const resultados = await Promise.allSettled(requisicoes);
        return {
            configurado: resultados[0].status === 'fulfilled' && resultados[1].status === 'fulfilled',
            erros: resultados
                .filter((resultado) => resultado.status === 'rejected')
                .map((resultado) => erroSeguro(resultado.reason)),
        };
    }

    async enviarTexto(config, { phone, message }) {
        const { data } = await axios.post(
            montarUrl(config, 'send-text'),
            { phone, message },
            { headers: montarHeaders(config), timeout: 20000 }
        );
        return data;
    }

    // Edita de verdade uma mensagem de texto já entregue no WhatsApp (editMessageId
    // relaciona com o messageId da mensagem original) — exige webhook configurado.
    async editarTexto(config, { phone, message, editMessageId }) {
        const { data } = await axios.post(
            montarUrl(config, 'send-text'),
            { phone, message, editMessageId },
            { headers: montarHeaders(config), timeout: 20000 }
        );
        return data;
    }

    async enviarImagem(config, { phone, image, caption }) {
        const { data } = await axios.post(
            montarUrl(config, 'send-image'),
            { phone, image, caption },
            { headers: montarHeaders(config), timeout: 30000 }
        );
        return data;
    }

    async enviarDocumento(config, { phone, document, fileName, extensao = 'pdf' }) {
        const { data } = await axios.post(
            montarUrl(config, `send-document/${extensao}`),
            { phone, document, fileName },
            { headers: montarHeaders(config), timeout: 30000 }
        );
        return data;
    }

    async enviarAudio(config, { phone, audio }) {
        const { data } = await axios.post(
            montarUrl(config, 'send-audio'),
            { phone, audio },
            { headers: montarHeaders(config), timeout: 30000 }
        );
        return data;
    }

    async statusInstancia(config) {
        try {
            const { data } = await axios.get(
                montarUrl(config, 'status'),
                { headers: montarHeaders(config), timeout: 10000 }
            );
            return data; // { connected, error, smartphoneConnected }
        } catch (err) {
            return { connected: false, error: erroSeguro(err), smartphoneConnected: false };
        }
    }


    mensagemErro(error) {
        return erroSeguro(error);
    }
}

export default new ZApiService();
