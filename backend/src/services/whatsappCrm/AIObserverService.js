/**
 * IA observadora do WhatsApp CRM — lê o histórico de uma conversa e devolve um
 * resumo interno + sugestões (etiquetas, estágio e assunto). Nunca responde
 * ao cliente e nunca aplica estágio/assunto sozinha — só sugere;
 * quem decide é o atendente. Etiquetas sugeridas entram com
 * status='sugerida' (mesmo fluxo de aceitar/rejeitar já usado no painel).
 *
 * Groq (API compatível com OpenAI), mesmo padrão de services/crm/GeminiService.js.
 */
import axios from 'axios';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import WhatsappEtiqueta from '../../models/WhatsappEtiqueta.js';
import WhatsappClienteEtiqueta from '../../models/WhatsappClienteEtiqueta.js';
import configService from './ConfigService.js';
import conversaService from './ConversaService.js';
import catalogoService from './CatalogoService.js';
import clienteCrmService from './ClienteCrmService.js';
import ApiError from '../../utils/apiError.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey() {
    const key = (process.env.WHATSAPP_CRM_GROQ_API_KEY ?? '').trim();
    if (!key) throw new Error('WHATSAPP_CRM_GROQ_API_KEY não configurada no ambiente');
    return key;
}

class AIObserverService {
    async analisarConversa(conversaId, user) {
        const config = await configService.buscar(user);
        if (!config?.ia_ativa) {
            throw new ApiError(400, 'Ative a IA nas Configurações do WhatsApp CRM antes de usar esta função');
        }

        const conversa = await conversaService.buscarPorId(conversaId, user);
        const limite = Math.max((config.ia_max_contexto ?? 10) * 4, 20);
        const mensagens = await WhatsappMensagem.findAll({
            where: { conversa_id: conversa.id },
            order: [['criado_em', 'DESC']],
            limit: limite,
        });
        mensagens.reverse();
        if (mensagens.length === 0) throw new ApiError(400, 'Conversa ainda não tem mensagens para analisar');

        const [etiquetasCatalogo, estagioCatalogo, motivoCatalogo] = await Promise.all([
            WhatsappEtiqueta.findAll({ where: { empresa_id: conversa.empresa_id }, order: [['nome', 'ASC']] }),
            catalogoService.listar('estagio', user),
            catalogoService.listar('motivo_clinico', user),
        ]);

        const transcricao = mensagens.map(m => {
            const quem = m.direcao === 'recebida' ? (conversa.nome_contato || conversa.telefone) : 'Atendimento';
            const conteudo = m.conteudo_texto || `[${m.tipo}]`;
            return `${quem}: ${conteudo}`;
        }).join('\n');

        const resultado = await this._chamarGroq({
            config, transcricao,
            etiquetas: etiquetasCatalogo.map(e => e.nome),
            estagios: estagioCatalogo.map(e => ({ chave: e.chave, nome: e.nome })),
            motivos: motivoCatalogo.map(m => ({ chave: m.chave, nome: m.nome })),
        });

        await conversa.update({ resumo_ia: resultado.resumo ?? null });

        const etiquetasCriadas = [];
        if (Array.isArray(resultado.etiquetas_sugeridas) && conversa.cliente_id) {
            const crm = await clienteCrmService._obterOuCriarCrm(conversa.cliente_id, conversa.empresa_id);
            const jaVinculadas = await WhatsappClienteEtiqueta.findAll({ where: { cliente_crm_id: crm.id } });
            for (const nomeSugerido of resultado.etiquetas_sugeridas) {
                const etiqueta = etiquetasCatalogo.find(e => e.nome.toLowerCase() === String(nomeSugerido).toLowerCase().trim());
                if (!etiqueta) continue;
                if (jaVinculadas.some(v => v.etiqueta_id === etiqueta.id)) continue;
                const vinculo = await WhatsappClienteEtiqueta.create({
                    cliente_crm_id: crm.id, etiqueta_id: etiqueta.id, status: 'sugerida', sugerida_por_ia: true,
                });
                etiquetasCriadas.push({ ...vinculo.toJSON(), etiqueta });
            }
        }

        const estagioSugerido = resultado.estagio_sugerido && estagioCatalogo.some(e => e.chave === resultado.estagio_sugerido)
            ? estagioCatalogo.find(e => e.chave === resultado.estagio_sugerido) : null;
        const motivoSugerido = resultado.motivo_sugerido && motivoCatalogo.some(m => m.chave === resultado.motivo_sugerido)
            ? motivoCatalogo.find(m => m.chave === resultado.motivo_sugerido) : null;

        return {
            resumo: resultado.resumo ?? null,
            etiquetas_sugeridas: etiquetasCriadas,
            estagio_sugerido: estagioSugerido,
            motivo_sugerido: motivoSugerido,
        };
    }

    // Só é chamado depois que o gatilho barato de palavra-chave (frontend,
    // GATILHOS_AGENDAMENTO) já bateu — é um filtro caro, então só roda pra
    // quem já passou no filtro barato. Confirma se a conversa realmente fechou
    // um agendamento com data/horário, em vez de abrir o popup pra qualquer
    // menção solta de "agendar"/"confirmado".
    async avaliarIntencaoAgendamento(conversaId, user) {
        const config = await configService.buscar(user);
        if (!config?.ia_ativa) {
            throw new ApiError(400, 'Ative a IA nas Configurações do WhatsApp CRM antes de usar esta função');
        }

        const conversa = await conversaService.buscarPorId(conversaId, user);
        // Janela curta e recente de propósito (diferente do resumo geral,
        // que usa uma janela bem maior): clientes com histórico de vários
        // agendamentos anteriores confundiam a IA, que às vezes pegava um
        // horário já resolvido de dias atrás em vez do combinado agora.
        const mensagens = await WhatsappMensagem.findAll({
            where: { conversa_id: conversa.id },
            order: [['criado_em', 'DESC']],
            limit: 12,
        });
        mensagens.reverse();
        if (mensagens.length === 0) return { agendamento_confirmado: false, data_detectada: null, horario_detectado: null };

        const transcricao = mensagens.map(m => {
            const quem = m.direcao === 'recebida' ? (conversa.nome_contato || conversa.telefone) : 'Atendimento';
            const conteudo = m.conteudo_texto || `[${m.tipo}]`;
            return `${quem}: ${conteudo}`;
        }).join('\n');

        // Data da mensagem mais recente — sem isso a IA não tem como resolver
        // datas relativas/parciais ("dia 07/08", "segunda-feira") pro ano certo.
        const dataReferencia = mensagens[mensagens.length - 1]?.criado_em ?? new Date();

        return this._chamarGroqAgendamento({ config, transcricao, dataReferencia });
    }

    async _chamarGroqAgendamento({ config, transcricao, dataReferencia }) {
        const key = getApiKey();
        const modelo = config.ia_modelo || 'llama-3.3-70b-versatile';
        const hojeISO = new Date(dataReferencia).toISOString().split('T')[0];

        const systemPrompt = `Você é um assistente interno de uma empresa que lê conversas de
WhatsApp entre atendente e cliente. NUNCA responde ao cliente — sua única
função é decidir se um compromisso foi REALMENTE combinado
(com data E horário específicos), pra decidir se abre um formulário de
confirmação pro atendente. Não considere combinado só porque a palavra
"agendar"/"confirmar" apareceu — a conversa precisa ter data e horário
concretos acertados entre as partes.

Hoje é ${hojeISO}. Use essa data como referência pra resolver datas
relativas ou parciais mencionadas na conversa (ex.: "segunda-feira",
"amanhã", "dia 07/08" sem ano) — sempre calcule a próxima ocorrência a
partir de hoje, nunca invente um ano diferente. Se não der pra calcular uma
data exata em formato YYYY-MM-DD com confiança, devolva "data_detectada": null
(nunca escreva a data por extenso ou parcial no campo).

IMPORTANTE: clientes recorrentes podem ter mencionado outros compromissos
já resolvidos em mensagens mais antigas dessa mesma janela. Ignore-os —
considere só a confirmação de data/horário mais RECENTE (mais perto do
final da conversa). Se a última troca sobre agendamento não tiver data E
horário claros, responda false mesmo que apareçam datas/horários antigos
mais acima na conversa.

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.`;

        const userPrompt = `CONVERSA (mais antiga primeiro):
${transcricao}

Analise a conversa acima e devolva um JSON exatamente neste formato:
{
  "agendamento_confirmado": true ou false,
  "data_detectada": "YYYY-MM-DD ou null",
  "horario_detectado": "HH:mm ou null"
}
Só marque "agendamento_confirmado": true se houver evidência clara de data E horário combinados de verdade. Na dúvida, responda false. "data_detectada" só pode ser null ou uma data exata no formato YYYY-MM-DD — nunca um texto descritivo.`;

        const { data } = await axios.post(
            GROQ_URL,
            {
                model: modelo,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                max_tokens: 256,
            },
            {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                timeout: 20000,
            }
        );

        const texto = data?.choices?.[0]?.message?.content ?? '';
        const limpo = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = limpo.match(/\{[\s\S]*\}/);
        if (!match) return { agendamento_confirmado: false, data_detectada: null, horario_detectado: null };

        try {
            const resultado = JSON.parse(match[0]);
            // Defesa extra além do prompt: só aceita data/horário se vierem no
            // formato esperado — se a IA "inventar" um texto descritivo em vez de
            // YYYY-MM-DD/HH:mm, ignora o campo (fica null) em vez de propagar pro
            // formulário um valor que quebraria o seletor de data no frontend.
            const dataValida = typeof resultado.data_detectada === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(resultado.data_detectada);
            const horarioValido = typeof resultado.horario_detectado === 'string' && /^\d{1,2}:\d{2}$/.test(resultado.horario_detectado);
            return {
                agendamento_confirmado: resultado.agendamento_confirmado === true,
                data_detectada: dataValida ? resultado.data_detectada : null,
                horario_detectado: horarioValido ? resultado.horario_detectado : null,
            };
        } catch {
            return { agendamento_confirmado: false, data_detectada: null, horario_detectado: null };
        }
    }

    async _chamarGroq({ config, transcricao, etiquetas, estagios, motivos }) {
        const key = getApiKey();
        const modelo = config.ia_modelo || 'llama-3.3-70b-versatile';
        const temperatura = Number(config.ia_temperatura ?? 0.3);

        const systemPrompt = `Você é um assistente interno de análise de conversas de WhatsApp de uma empresa.
NUNCA responde ao cliente — sua única função é ler a conversa e ajudar o atendente com um resumo e sugestões.
${config.ia_personalidade ? `Personalidade/tom esperado: ${config.ia_personalidade}` : ''}
${config.ia_regras_comerciais ? `Regras comerciais do negócio: ${config.ia_regras_comerciais}` : ''}
${config.ia_prompt_base ? `Instruções adicionais da empresa: ${config.ia_prompt_base}` : ''}

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.`;

        const userPrompt = `CONVERSA (mais antiga primeiro):
${transcricao}

ETIQUETAS DISPONÍVEIS NO CATÁLOGO (só sugira destas, pelo nome exato): ${etiquetas.join(', ') || '(nenhuma cadastrada)'}
ESTÁGIOS DISPONÍVEIS (sugira pela chave): ${estagios.map(e => `${e.chave} (${e.nome})`).join(', ')}
ASSUNTOS DISPONÍVEIS (sugira pela chave): ${motivos.map(m => `${m.chave} (${m.nome})`).join(', ')}

Analise a conversa acima e devolva um JSON exatamente neste formato:
{
  "resumo": "resumo curto e objetivo da conversa até agora, em 2-4 frases, focado no que o atendente precisa saber",
  "etiquetas_sugeridas": ["nome exato de etiqueta do catálogo", "..."],
  "estagio_sugerido": "chave do estágio ou null",
  "motivo_sugerido": "chave do assunto ou null"
}
Só sugira etiquetas/estágio/motivo se houver evidência clara na conversa. Se não houver evidência suficiente, devolva listas vazias e null.`;

        const { data } = await axios.post(
            GROQ_URL,
            {
                model: modelo,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: Number.isFinite(temperatura) ? temperatura : 0.3,
                max_tokens: 1024,
            },
            {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                timeout: 30000,
            }
        );

        const texto = data?.choices?.[0]?.message?.content ?? '';
        const limpo = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = limpo.match(/\{[\s\S]*\}/);
        if (!match) throw new ApiError(502, 'IA não retornou um resultado válido — tente novamente');

        try {
            return JSON.parse(match[0]);
        } catch {
            throw new ApiError(502, 'IA não retornou um resultado válido — tente novamente');
        }
    }
}

export default new AIObserverService();
