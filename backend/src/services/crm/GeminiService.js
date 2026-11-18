/**
 * Groq API — geração de scripts comerciais modernos via LLM.
 * Modelo: llama-3.3-70b-versatile. Compatível com OpenAI format.
 */
import axios from 'axios';

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function getApiKey() {
    const key = (process.env.GROQ_API_KEY ?? '').trim();
    if (!key) throw new Error('GROQ_API_KEY não configurada no ambiente');
    return key;
}

const TIPOS_SCRIPT = {
    primeiro_contato:   'Primeiro Contato',
    followup:           'Follow-up (sem resposta)',
    reativacao:         'Reativação de Lead',
    convite_reuniao:    'Convite para Reunião',
    proposta_comercial: 'Apresentação de Proposta',
    recuperacao_lead:   'Última Tentativa',
};

const ESTILOS_VARIACAO = [
    {
        nome: 'Direto e objetivo',
        instrucao: 'Vai direto ao ponto. Primeira frase é o gancho, segunda é o valor, terceira é o CTA. Sem rodeios.',
    },
    {
        nome: 'Consultivo e empático',
        instrucao: 'Demonstra que entende o dia a dia do cliente. Menciona uma dor específica do segmento antes de apresentar a solução.',
    },
    {
        nome: 'Curioso e provocativo',
        instrucao: 'Começa com uma pergunta que gera reflexão sobre um problema ou oportunidade que o cliente provavelmente não estava pensando.',
    },
    {
        nome: 'Social proof',
        instrucao: 'Menciona que outros estabelecimentos do mesmo segmento já usam a solução. Usa prova social para gerar confiança sem citar nomes.',
    },
    {
        nome: 'Oferta de valor imediato',
        instrucao: 'Oferece algo de valor gratuito logo de início (diagnóstico, demonstração, conteúdo). Não vende — atrai.',
    },
];

/**
 * Gera variações de script comercial para WhatsApp usando Groq.
 */
export async function gerarScripts({ segment, product, objective, script_type = 'primeiro_contato', variacoes = 3 }) {
    const key      = getApiKey();
    const tipoDesc = TIPOS_SCRIPT[script_type] ?? script_type;
    const estilos  = ESTILOS_VARIACAO.slice(0, variacoes);

    const systemPrompt = `Você é um especialista em vendas consultivas B2B/B2C no Brasil com 15 anos de experiência.
Domina técnicas modernas: SPIN Selling, Challenger Sale, social selling e copywriting para WhatsApp.
Conhece profundamente o comportamento do consumidor brasileiro.

REGRAS ABSOLUTAS:
- Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON
- Mensagens de WhatsApp: curtas, conversacionais, humanas
- Nunca pareça robótico ou vendedor genérico
- Nunca mencione preços
- Nunca use linguagem corporativa ("prezado", "venho por meio deste")
- Use 0 a 2 emojis por mensagem, somente quando amplificam o sentido
- Máximo 280 caracteres por mensagem principal
- CTA sempre claro e com baixo atrito ("Quer ver como funciona?" em vez de "Entre em contato")`;

    const estilosDesc = estilos.map((e, i) =>
        `Variação ${i + 1} — ${e.nome}: ${e.instrucao}`
    ).join('\n');

    const userPrompt = `Crie ${variacoes} variações de mensagem WhatsApp para:

CONTEXTO:
- Quem vai receber: ${segment}
- O que estamos vendendo: ${product}
- Objetivo da mensagem: ${objective}
- Tipo de abordagem: ${tipoDesc}

ESTILOS (um por variação):
${estilosDesc}

FORMATO DE SAÍDA (JSON exato, sem nada fora):
{
  "scripts": [
    {
      "titulo": "Nome do estilo",
      "conteudo": "Mensagem principal aqui",
      "dica": "Uma dica rápida de quando usar esse script"
    }
  ]
}`;

    const { data } = await axios.post(
        GROQ_URL,
        {
            model:       GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt   },
            ],
            temperature:  0.85,
            max_tokens:   2048,
            top_p:        0.95,
        },
        {
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${key}`,
            },
            timeout: 35000,
        }
    );

    const text  = data?.choices?.[0]?.message?.content ?? '';
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Groq não retornou JSON válido');

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.scripts ?? [];
}

/**
 * Gera versões semanticamente equivalentes de uma mensagem de campanha.
 * Dados objetivos devem permanecer idênticos para evitar alterações na oferta.
 */
export async function gerarVariacoesMensagem(mensagem, quantidade = 5) {
    const key = getApiKey();
    const original = String(mensagem || '').trim().slice(0, 2000);
    const total = Math.max(2, Math.min(Number(quantidade) || 5, 10));
    if (!original) return [];

    const { data } = await axios.post(
        GROQ_URL,
        {
            model: GROQ_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Você adapta mensagens comerciais para WhatsApp em português do Brasil.
Responda APENAS com JSON válido no formato {"variacoes":["..."]}.
Crie versões naturais e realmente distintas, mas preserve rigorosamente intenção, fatos, preços, datas, percentuais, nomes, links, telefones, cupons e condições da mensagem original.
Não invente benefícios, urgência, descontos ou promessas. Não acrescente saudações com nomes que não foram fornecidos.
Use no máximo 2 emojis por versão. Cada versão deve ter tamanho semelhante ao original.`,
                },
                {
                    role: 'user',
                    content: `Crie ${total} variações desta mensagem:\n\n${original}`,
                },
            ],
            temperature: 0.8,
            max_tokens: 2200,
            top_p: 0.9,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            timeout: 35000,
        }
    );

    const text = data?.choices?.[0]?.message?.content ?? '';
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Groq não retornou variações válidas');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.variacoes)) return [];
    const normalizeProtected = (value) => String(value).toLowerCase().replace(/\s+/g, '').replace(/[()[\]]/g, '');
    const protectedTokens = (original.match(/https?:\/\/\S+|www\.\S+|R\$\s*\d[\d.,]*|\b\d[\d.,/:-]*%?/gi) || [])
        .map((token) => token.replace(/[.;!?)]+$/, ''));
    return [...new Set(parsed.variacoes
        .map((item) => String(item || '').trim())
        .filter((item) => item && item !== original && protectedTokens.every((token) => normalizeProtected(item).includes(normalizeProtected(token))))
        .map((item) => item.slice(0, 2000)))]
        .slice(0, total);
}

/**
 * Analisa sinais comerciais de uma conversa sem decidir etapas irreversíveis do funil.
 */
export async function analisarQualificacaoLead(mensagens) {
    const key = getApiKey();
    const historico = (Array.isArray(mensagens) ? mensagens : [])
        .slice(-20)
        .map((item) => `${item.direction === 'in' ? 'LEAD' : 'EMPRESA'}: ${String(item.content || '').trim()}`)
        .filter((item) => !item.endsWith(':'))
        .join('\n')
        .slice(0, 10000);
    if (!historico) throw new Error('Conversa sem conteúdo para qualificação');

    const { data } = await axios.post(
        GROQ_URL,
        {
            model: GROQ_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Você qualifica leads comerciais a partir de conversas reais de WhatsApp.
Responda APENAS com JSON válido: {"score":0,"temperatura":"Frio","intencao":"neutro","tags":[],"resumo":""}.
O score deve ser de 0 a 100 e considerar SOMENTE sinais demonstrados pelo lead, nunca o texto enviado pela empresa.
Temperaturas permitidas: Frio, Morno, Quente, Muito Quente.
Intenções permitidas: negativo, neutro, interessado, oportunidade.
Sinais fortes: pedir preço/proposta, demonstração, reunião, prazo ou explicar uma necessidade concreta.
Resposta educada sem interesse explícito não é lead quente. Recusa, pedido para parar ou número errado é negativo.
Use no máximo 3 tags curtas e um resumo factual de até 160 caracteres. Não invente contexto.`,
                },
                { role: 'user', content: historico },
            ],
            temperature: 0.1,
            max_tokens: 450,
            response_format: { type: 'json_object' },
        },
        {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            timeout: 12000,
        },
    );

    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const temperaturas = ['Frio', 'Morno', 'Quente', 'Muito Quente'];
    const intencoes = ['negativo', 'neutro', 'interessado', 'oportunidade'];
    return {
        score,
        temperatura: temperaturas.includes(parsed.temperatura) ? parsed.temperatura : score >= 81 ? 'Muito Quente' : score >= 61 ? 'Quente' : score >= 31 ? 'Morno' : 'Frio',
        intencao: intencoes.includes(parsed.intencao) ? parsed.intencao : 'neutro',
        tags: [...new Set((Array.isArray(parsed.tags) ? parsed.tags : []).map((tag) => String(tag).trim().slice(0, 30)).filter(Boolean))].slice(0, 3),
        resumo: String(parsed.resumo || '').trim().slice(0, 160),
    };
}
