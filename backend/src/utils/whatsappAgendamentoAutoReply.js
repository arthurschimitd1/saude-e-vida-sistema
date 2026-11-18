export const DOM_FERRAZ_LANDING_URL = 'https://domferraz.com.br';

export const AUTOMACAO_AGENDAMENTO_PADRAO = Object.freeze({
    ativa: false,
    mensagem: 'Olá! Para escolher a unidade, o profissional, os serviços e o melhor horário, faça seu agendamento por aqui:\n{{link}}',
    cooldown_horas: 168,
});

const normalizar = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const CHAVES_DOM_FERRAZ = new Set([
    'dom ferraz manaira',
    'dom ferraz miramar',
    'dom ferraz sape',
]);

const PADROES_INTENCAO = [
    /\bagend(?:ar|a|amento|amentos|ado|ada|ei|ou)?\b/,
    /\b(?:marcar|marca|marcando)\b.{0,45}\b(?:horario|corte|barba|servico|atendimento)\b/,
    /\b(?:horario|corte|barba|servico|atendimento)\b.{0,45}\b(?:marcar|marca|marcando)\b/,
    /\b(?:tem|ha|possui|existe)\b.{0,35}\b(?:horario|vaga|disponibilidade)\b/,
    /\b(?:qual|quais)\b.{0,25}\b(?:horario|horarios|disponibilidade)\b/,
    /\b(?:horario|horarios|vaga|vagas)\b.{0,30}\b(?:disponivel|disponiveis|livre|livres|hoje|amanha)\b/,
];

const PADROES_EXCLUSAO = [
    /\b(?:cancelar|cancela|cancelamento|desmarcar|desmarca)\b.{0,45}\b(?:agendamento|horario|corte|barba|servico|atendimento)\b/,
    /\b(?:agendamento|horario|corte|barba|servico|atendimento)\b.{0,45}\b(?:cancelar|cancela|cancelamento|desmarcar|desmarca)\b/,
    /\bnao\b.{0,20}\b(?:quero|vou|posso)\b.{0,20}\bagend(?:ar|amento)?\b/,
];

export const ehEmpresaDomFerraz = (nome) => CHAVES_DOM_FERRAZ.has(normalizar(nome));

export const detectarIntencaoAgendamento = (texto) => {
    const entrada = normalizar(texto);
    if (!entrada) return false;
    if (PADROES_EXCLUSAO.some((padrao) => padrao.test(entrada))) return false;
    return PADROES_INTENCAO.some((padrao) => padrao.test(entrada));
};

export const normalizarConfiguracaoAutomacao = (value) => {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const cooldownInformado = Number(raw.cooldown_horas);
    const cooldown_horas = Number.isFinite(cooldownInformado)
        ? Math.min(2160, Math.max(1, Math.round(cooldownInformado)))
        : AUTOMACAO_AGENDAMENTO_PADRAO.cooldown_horas;
    const mensagem = String(raw.mensagem ?? AUTOMACAO_AGENDAMENTO_PADRAO.mensagem).trim().slice(0, 2000)
        || AUTOMACAO_AGENDAMENTO_PADRAO.mensagem;

    return {
        ativa: raw.ativa === true,
        mensagem,
        cooldown_horas,
    };
};

export const montarMensagemAgendamento = (config) => {
    const normalizada = normalizarConfiguracaoAutomacao(config);
    const comLink = normalizada.mensagem.replace(/\{\{\s*link\s*\}\}/gi, DOM_FERRAZ_LANDING_URL);
    return comLink.includes(DOM_FERRAZ_LANDING_URL)
        ? comLink
        : `${comLink}\n${DOM_FERRAZ_LANDING_URL}`;
};
