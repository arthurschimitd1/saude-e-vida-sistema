const normalizarNome = (valor) => String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

export const ehDomFerrazSape = (nomeEmpresa) =>
    normalizarNome(nomeEmpresa) === 'domferrazsape';

export const deveNotificarAgendamentoWhatsapp = (nomeEmpresa, preferenciaNotificacao) =>
    ehDomFerrazSape(nomeEmpresa) || preferenciaNotificacao !== false;

export const montarMensagemAgendamentoWhatsapp = (agendamento, { confirmado = false, dataFormatada } = {}) => {
    const primeiroNome = agendamento.cliente_nome?.trim().split(/\s+/)[0] || 'cliente';
    const detalhes = [
        `Data: ${dataFormatada ?? agendamento.data}`,
        `Horário: ${agendamento.horario}`,
        agendamento.servico_nome ? `Serviço: ${agendamento.servico_nome}` : null,
    ].filter(Boolean);

    if (confirmado) {
        return [
            `Olá, ${primeiroNome}! 👋`,
            '',
            'Seu agendamento está confirmado. ✅',
            ...detalhes,
        ].join('\n');
    }

    return [
        `Olá, ${primeiroNome}! 👋`,
        '',
        `Você confirma seu agendamento para ${dataFormatada ?? agendamento.data}, às ${agendamento.horario}?`,
        agendamento.servico_nome ? `Serviço: ${agendamento.servico_nome}` : null,
        '',
        'Responda *SIM* para confirmar ou *NÃO* caso precise reagendar.',
    ].filter((linha) => linha !== null).join('\n');
};
