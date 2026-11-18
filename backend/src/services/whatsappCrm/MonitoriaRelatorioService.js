/**
 * Relatório diário de monitoria por IA — 1x por dia (por empresa), varre as
 * conversas das últimas 24h e devolve um raio-x da qualidade do atendimento:
 * pontos principais, objeções, condução correta, pontos de melhoria e
 * sugestões de argumento. Mesmo padrão de chamada Groq do AIObserverService.
 */
import axios from 'axios';
import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import configService from './ConfigService.js';
import ApiError from '../../utils/apiError.js';
import { empresaParaGravar } from '../../utils/empresaScope.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey() {
    const key = (process.env.WHATSAPP_CRM_GROQ_API_KEY ?? '').trim();
    if (!key) throw new Error('WHATSAPP_CRM_GROQ_API_KEY não configurada no ambiente');
    return key;
}

const CARGOS_GESTAO = ['Dono', 'Gerente', 'Administrador'];
function ehGestor(user) {
    return user?.tipo === 'MASTER' || CARGOS_GESTAO.includes(user?.cargo);
}

class MonitoriaRelatorioService {
    async buscarUltimo(user) {
        if (!ehGestor(user)) throw new ApiError(403, 'Só perfis de gestão podem acessar o relatório de monitoria');
        const empresa_id = empresaParaGravar(user);
        const [relatorio] = await sequelize.query(
            'SELECT * FROM whatsapp_relatorios_monitoria WHERE empresa_id = :empresa_id ORDER BY data DESC LIMIT 1',
            { replacements: { empresa_id }, type: sequelize.QueryTypes.SELECT }
        );
        return relatorio ?? null;
    }

    async gerarOuBuscarDeHoje(user) {
        if (!ehGestor(user)) throw new ApiError(403, 'Só perfis de gestão podem gerar o relatório de monitoria');

        const config = await configService.buscar(user);
        if (!config?.ia_ativa) {
            throw new ApiError(400, 'Ative a IA nas Configurações do WhatsApp CRM antes de usar esta função');
        }

        const empresa_id = empresaParaGravar(user);
        const hoje = new Date().toISOString().split('T')[0];

        // UNIQUE(empresa_id, data) garante 1x/dia — se já existe, devolve o que já
        // tem em vez de gastar tokens gerando de novo.
        const [existente] = await sequelize.query(
            'SELECT * FROM whatsapp_relatorios_monitoria WHERE empresa_id = :empresa_id AND data = :hoje',
            { replacements: { empresa_id, hoje }, type: sequelize.QueryTypes.SELECT }
        );
        if (existente) return existente;

        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Limita a quantidade de conversas analisadas — num dia muito movimentado
        // a transcrição completa estourava o limite de tamanho de requisição da
        // Groq (erro 413). O relatório é um raio-x qualitativo, não precisa
        // cobrir 100% do volume pra ser útil.
        const conversas = await WhatsappConversa.findAll({
            where: { empresa_id, ultima_mensagem_em: { [Op.gte]: desde } },
            order: [['ultima_mensagem_em', 'DESC']],
            limit: 40,
        });

        if (conversas.length === 0) {
            throw new ApiError(400, 'Nenhuma conversa nas últimas 24h pra gerar relatório');
        }

        const transcricoes = [];
        for (const conversa of conversas) {
            const mensagens = await WhatsappMensagem.findAll({
                where: { conversa_id: conversa.id, criado_em: { [Op.gte]: desde } },
                order: [['criado_em', 'ASC']],
                limit: 25,
            });
            if (mensagens.length === 0) continue;
            const linhas = mensagens.map(m => {
                const quem = m.direcao === 'recebida' ? (conversa.nome_contato || conversa.telefone) : 'Atendimento';
                const conteudo = (m.conteudo_texto || `[${m.tipo}]`).slice(0, 300);
                return `${quem}: ${conteudo}`;
            }).join('\n');
            transcricoes.push(`--- Conversa com ${conversa.nome_contato || conversa.telefone} ---\n${linhas}`);
        }

        if (transcricoes.length === 0) {
            throw new ApiError(400, 'Nenhuma mensagem nas últimas 24h pra gerar relatório');
        }

        const conteudo = await this._chamarGroq({ config, transcricoes });

        await sequelize.query(
            `INSERT INTO whatsapp_relatorios_monitoria (empresa_id, data, conteudo, gerado_por, criado_em)
             VALUES (:empresa_id, :hoje, :conteudo, :gerado_por, NOW())
             ON CONFLICT (empresa_id, data) DO NOTHING`,
            { replacements: { empresa_id, hoje, conteudo: JSON.stringify(conteudo), gerado_por: user?.id ?? null } }
        );

        const [salvo] = await sequelize.query(
            'SELECT * FROM whatsapp_relatorios_monitoria WHERE empresa_id = :empresa_id AND data = :hoje',
            { replacements: { empresa_id, hoje }, type: sequelize.QueryTypes.SELECT }
        );
        return salvo;
    }

    async _chamarGroq({ config, transcricoes }) {
        const key = getApiKey();
        const modelo = config.ia_modelo || 'llama-3.3-70b-versatile';

        // Groq tem limite de tamanho de requisição — corta transcrições muito
        // grandes em vez de estourar o limite (erro 413) e falhar o relatório inteiro.
        const textoCompleto = transcricoes.join('\n\n').slice(0, 16000);

        const systemPrompt = `Você é um analista de qualidade de atendimento ao cliente de uma empresa.
Vai receber a transcrição de várias conversas de WhatsApp das últimas 24h
entre atendentes e clientes/leads. Sua função é gerar um raio-x consolidado
do atendimento do período pra gestão, SEM citar nomes de clientes (só
descreva situações, de forma anônima).

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.`;

        const userPrompt = `CONVERSAS DAS ÚLTIMAS 24H:
${textoCompleto}

Analise todas as conversas acima e devolva um JSON exatamente neste formato:
{
  "pontos_principais": ["ponto 1", "ponto 2", "..."],
  "objecoes": ["objeção levantada 1", "..."],
  "condutas_corretas": ["boa prática identificada 1", "..."],
  "pontos_melhoria": ["ponto de melhoria 1", "..."],
  "sugestoes_argumentos": ["sugestão de argumento pra vencer uma objeção 1", "..."]
}
Cada lista deve ter só itens com evidência real nas conversas — se não houver nada relevante pra alguma categoria, devolva lista vazia.`;

        const { data } = await axios.post(
            GROQ_URL,
            {
                model: modelo,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 2048,
            },
            {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                timeout: 45000,
            }
        );

        const texto = data?.choices?.[0]?.message?.content ?? '';
        const limpo = texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = limpo.match(/\{[\s\S]*\}/);
        if (!match) throw new ApiError(502, 'IA não retornou um relatório válido — tente novamente');

        try {
            const resultado = JSON.parse(match[0]);
            const listaOuVazia = (v) => Array.isArray(v) ? v.map(String) : [];
            return {
                pontos_principais: listaOuVazia(resultado.pontos_principais),
                objecoes: listaOuVazia(resultado.objecoes),
                condutas_corretas: listaOuVazia(resultado.condutas_corretas),
                pontos_melhoria: listaOuVazia(resultado.pontos_melhoria),
                sugestoes_argumentos: listaOuVazia(resultado.sugestoes_argumentos),
            };
        } catch {
            throw new ApiError(502, 'IA não retornou um relatório válido — tente novamente');
        }
    }
}

export default new MonitoriaRelatorioService();
