export const normalizarServicosInclusos = (servicos) => {
    if (!Array.isArray(servicos)) return null;
    const validos = servicos
        .map(item => ({
            servico_id: String(item?.servico_id ?? item?.servicoId ?? '').trim() || null,
            servico_nome: String(item?.servico_nome ?? item?.servicoNome ?? '').trim(),
            quantidade: Math.floor(Number(item?.quantidade ?? 0))
        }))
        .filter(item => item.servico_nome && item.quantidade > 0);
    if (!validos.length) return null;

    // O mesmo serviço pode chegar repetido por chamadas concorrentes ou por
    // dados legados. O último item representa a edição mais recente e mantém
    // o comportamento já usado pela tela de recorrências.
    const semDuplicatas = new Map();
    validos.forEach(item => {
        const chave = item.servico_id || `nome:${normalizarNomeServico(item.servico_nome)}`;
        semDuplicatas.set(chave, item);
    });
    return [...semDuplicatas.values()];
};

export const normalizarNomeServico = (valor) => String(valor ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export const servicoInclusoCorresponde = (servico, referencia) => {
    const servicoId = String(servico?.id ?? servico?.servico_id ?? '').trim();
    const referenciaId = String(referencia?.servico_id ?? referencia?.servicoId ?? referencia?.id ?? '').trim();
    // Quando os dois lados têm ID, o vínculo explícito é a fonte de verdade.
    // O nome só é usado para manter compatibilidade com registros legados sem ID.
    if (servicoId && referenciaId) return servicoId === referenciaId;
    return Boolean(
        (servico?.nome ?? servico?.servico_nome)
        && normalizarNomeServico(referencia?.servico_nome ?? referencia?.servicoNome ?? referencia?.nome)
            === normalizarNomeServico(servico?.nome ?? servico?.servico_nome),
    );
};

export const montarStatusFranquia = ({ limite, utilizadosAntes, servicoNome, recorrenciaId }) => {
    const quantidade = Math.max(0, Math.floor(Number(limite) || 0));
    const usadosAntes = Math.max(0, Math.floor(Number(utilizadosAntes) || 0));
    const usoAtual = usadosAntes + 1;
    const excedente = usoAtual > quantidade;
    return {
        recorrencia_id: recorrenciaId,
        servico_nome: servicoNome,
        limite,
        utilizados_antes: usadosAntes,
        utilizados: usoAtual,
        restantes: Math.max(quantidade - usoAtual, 0),
        excedente,
        mensagem: excedente
            ? `${servicoNome}: ${usoAtual}º uso no mês; a franquia inclui ${quantidade}. Cobrar este atendimento à parte.`
            : `${servicoNome}: ${usoAtual} de ${quantidade} usos no mês; restam ${Math.max(quantidade - usoAtual, 0)}.`
    };
};

const dataCivil = (valor) => String(valor ?? '').slice(0, 10);

const servicosDoAgendamento = (agendamento) => {
    if (Array.isArray(agendamento?.servicos) && agendamento.servicos.length) {
        return agendamento.servicos.map(servico => ({
            id: String(servico?.id ?? servico?.servicoId ?? servico?.servico_id ?? '').trim() || null,
            nome: String(servico?.nome ?? servico?.name ?? servico?.servicoNome ?? servico?.servico_nome ?? '').trim(),
        }));
    }
    return [{
        id: String(agendamento?.servico_id ?? agendamento?.servicoId ?? '').trim() || null,
        nome: String(agendamento?.servico_nome ?? agendamento?.servicoNome ?? '').trim(),
    }].filter(servico => servico.id || servico.nome);
};

const recorrenciaValidaNaData = (recorrencia, data) => {
    const inicio = dataCivil(recorrencia?.dataInicio ?? recorrencia?.data_inicio);
    const fim = dataCivil(recorrencia?.dataFim ?? recorrencia?.data_fim);
    return recorrencia?.ativo !== false && (!inicio || inicio <= data) && (!fim || fim >= data);
};

const vemAntes = (anterior, atual) => {
    const chaveAnterior = `${dataCivil(anterior.data)}T${String(anterior.horario ?? '').slice(0, 5)}#${String(anterior.id).padStart(12, '0')}`;
    const chaveAtual = `${dataCivil(atual.data)}T${String(atual.horario ?? '').slice(0, 5)}#${String(atual.id).padStart(12, '0')}`;
    return chaveAnterior < chaveAtual;
};

export const calcularBeneficiosRecorrencia = (agendamentos = [], recorrencias = []) => {
    const mapa = new Map();
    const consumos = agendamentos.filter(agendamento =>
        ['confirmado', 'em_atendimento', 'finalizado'].includes(agendamento.status)
    );

    for (const agendamento of agendamentos) {
        if (!agendamento?.id || agendamento.status === 'cancelado' || agendamento.status === 'reagendado') continue;
        const data = dataCivil(agendamento.data);
        const clienteId = Number(agendamento.cliente_id ?? agendamento.clienteId);
        if (!data || !clienteId) continue;

        const beneficios = servicosDoAgendamento(agendamento).flatMap(servico => {
            const candidatos = recorrencias
                .filter(recorrencia => Number(recorrencia.cliente_id ?? recorrencia.clienteId) === clienteId)
                .filter(recorrencia => recorrenciaValidaNaData(recorrencia, data))
                .map(recorrencia => ({
                    recorrencia,
                    franquia: (Array.isArray(recorrencia.servicosInclusos) ? recorrencia.servicosInclusos : [])
                        .find(item => servicoInclusoCorresponde(servico, item)),
                }))
                .filter(item => item.franquia)
                .sort((a, b) => dataCivil(b.recorrencia.dataInicio).localeCompare(dataCivil(a.recorrencia.dataInicio)));
            const escolhido = candidatos[0];
            if (!escolhido) return [];

            const utilizadosAntes = consumos.filter(consumo => {
                if (Number(consumo.cliente_id ?? consumo.clienteId) !== clienteId) return false;
                if (dataCivil(consumo.data).slice(0, 7) !== data.slice(0, 7)) return false;
                if (!vemAntes(consumo, agendamento)) return false;
                if (!recorrenciaValidaNaData(escolhido.recorrencia, dataCivil(consumo.data))) return false;
                return servicosDoAgendamento(consumo).some(item => servicoInclusoCorresponde(servico, item));
            }).length;
            const status = montarStatusFranquia({
                limite: escolhido.franquia.quantidade,
                utilizadosAntes,
                servicoNome: escolhido.franquia.servico_nome,
                recorrenciaId: escolhido.recorrencia.id,
            });
            return [{
                ...status,
                servico_id: servico.id,
                coberto: !status.excedente,
            }];
        });

        if (!beneficios.length) continue;
        const primeiro = beneficios[0];
        const coberto = beneficios.some(beneficio => beneficio.coberto);
        mapa.set(String(agendamento.id), {
            ...primeiro,
            servicos: beneficios,
            coberto,
            excedente: beneficios.every(beneficio => beneficio.excedente),
            mensagem: beneficios.map(beneficio => beneficio.mensagem).join(' '),
        });
    }
    return mapa;
};
