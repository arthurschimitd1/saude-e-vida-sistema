/**
 * Transcrição de áudio via Whisper, usando o endpoint OpenAI-compatible da
 * Groq (mesma chave já usada pela IA observadora do WhatsApp CRM —
 * WHATSAPP_CRM_GROQ_API_KEY — não precisa de credencial nova).
 */
import axios from 'axios';
import FormData from 'form-data';
import ApiError from '../../utils/apiError.js';

const GROQ_TRANSCRICAO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

class TranscricaoService {
    async transcreverUrl(audioUrl) {
        const apiKey = process.env.WHATSAPP_CRM_GROQ_API_KEY;
        if (!apiKey) throw new ApiError(400, 'Transcrição indisponível: WHATSAPP_CRM_GROQ_API_KEY não configurada');

        const { data: audioBuffer } = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });

        const form = new FormData();
        form.append('file', Buffer.from(audioBuffer), { filename: 'audio.ogg' });
        form.append('model', 'whisper-large-v3');
        form.append('language', 'pt');
        form.append('response_format', 'json');

        const { data } = await axios.post(GROQ_TRANSCRICAO_URL, form, {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
            timeout: 30000,
        });
        return data?.text?.trim() || '[não foi possível transcrever]';
    }
}

export default new TranscricaoService();
