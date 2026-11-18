// Valores padrão com os quais toda empresa começa (mesmas chaves do antigo
// enum fixo, pra não quebrar dados já gravados). O usuário pode editar,
// remover ou adicionar novos itens livremente a partir daqui.

export const SEED_ESTAGIO = [
    { chave: 'novo_lead', nome: 'Novo Lead', cor: '#3b82f6' },
    { chave: 'primeiro_contato', nome: 'Primeiro Contato', cor: '#0ea5e9' },
    { chave: 'em_negociacao', nome: 'Em Negociação', cor: '#f59e0b' },
    { chave: 'consulta_agendada', nome: 'Reunião Agendada', cor: '#8b5cf6' },
    { chave: 'consulta_realizada', nome: 'Reunião Realizada', cor: '#6366f1' },
    { chave: 'protocolo_apresentado', nome: 'Proposta Apresentada', cor: '#ec4899' },
    { chave: 'fechou', nome: 'Fechou', cor: '#22c55e' },
    { chave: 'em_tratamento', nome: 'Em Andamento', cor: '#14b8a6' },
    { chave: 'concluido', nome: 'Concluído', cor: '#059669' },
    { chave: 'lead_perdido', nome: 'Lead Perdido', cor: '#ef4444' },
    { chave: 'lead_desqualificado', nome: 'Lead Desqualificado', cor: '#94a3b8' },
];

export const SEED_MOTIVO_CLINICO = [
    { chave: 'orcamento', nome: 'Orçamento', cor: '#f59e0b' },
    { chave: 'produto', nome: 'Produto', cor: '#0ea5e9' },
    { chave: 'servico', nome: 'Serviço', cor: '#8b5cf6' },
    { chave: 'suporte', nome: 'Suporte', cor: '#14b8a6' },
    { chave: 'financeiro', nome: 'Financeiro', cor: '#22c55e' },
    { chave: 'reclamacao', nome: 'Reclamação', cor: '#ef4444' },
    { chave: 'outro', nome: 'Outro', cor: '#94a3b8' },
];

// Catálogo opcional de profissionais responsáveis. Cada empresa define a
// própria equipe; não cadastramos nomes de outra operação como padrão.
export const SEED_PROFISSIONAL = [
];

export const SEEDS = {
    estagio: SEED_ESTAGIO,
    motivo_clinico: SEED_MOTIVO_CLINICO,
    profissional: SEED_PROFISSIONAL,
};

export const TIPOS_VALIDOS = Object.keys(SEEDS);

// Etiquetas padrão de acompanhamento de lead novo — indicam há quanto tempo o
// primeiro contato aconteceu sem resposta/avanço, pra não perder o SLA de
// atendimento. Diferente do catálogo de estágio/motivo, aqui a lista do
// usuário nunca começa vazia: garantimos que essas 3 sempre existam (ver
// EtiquetaService._garantirEtiquetasPadrao), sem impedir que o usuário crie
// outras por conta própria.
export const SEED_ETIQUETAS_PADRAO = [
    { nome: 'Novo Lead - 24h', cor: '#3b82f6' },
    { nome: 'Novo Lead - 48h', cor: '#f59e0b' },
    { nome: 'Novo Lead - 72h', cor: '#ef4444' },
];
