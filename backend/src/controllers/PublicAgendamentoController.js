import agendamentoService from '../services/AgendamentoService.js';
import {
    PublicAgendamentoScopeError,
    resolveDomFerrazScope,
    resolveSkyBarbeariaScope,
} from '../services/PublicAgendamentoScopeService.js';

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const phoneVariants = (value) => {
    let digits = onlyDigits(value);
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
        digits = digits.slice(2);
    }

    const variants = new Set([digits]);
    if (digits.length === 11 && digits[2] === '9') {
        variants.add(`${digits.slice(0, 2)}${digits.slice(3)}`);
    } else if (digits.length === 10) {
        variants.add(`${digits.slice(0, 2)}9${digits.slice(2)}`);
    }
    return variants;
};

const phonesMatch = (first, second) => {
    const expected = phoneVariants(first);
    return [...phoneVariants(second)].some((phone) => expected.has(phone));
};

async function scopeFromRequest(req) {
    return req.baseUrl.includes('/sky-barbearia')
        ? resolveSkyBarbeariaScope(req.params.empresaSlug)
        : resolveDomFerrazScope(req.params.empresaSlug);
}

function sendError(res, error, fallback = 'Não foi possível processar a solicitação.') {
    const status = error?.status || error?.statusCode || 500;
    return res.status(status).json({ error: error?.message || fallback });
}

export const bloqueiosComoOcupacoesPublicas = (bloqueios = []) => bloqueios.flatMap((bloqueio) => {
    const diaInteiro = bloqueio.diaInteiro || !bloqueio.horaInicio || !bloqueio.horaFim;
    const [horaInicio, minutoInicio] = diaInteiro ? [0, 0] : bloqueio.horaInicio.split(':').map(Number);
    const [horaFim, minutoFim] = diaInteiro ? [24, 0] : bloqueio.horaFim.split(':').map(Number);
    const inicio = horaInicio * 60 + minutoInicio;
    const fim = horaFim * 60 + minutoFim;
    const inicios = new Set([inicio]);
    for (let minuto = inicio + 30; minuto + 30 <= fim; minuto += 30) inicios.add(minuto);
    inicios.add(Math.max(inicio, fim - 30));
    return [...inicios].sort((a, b) => a - b).map((minuto) => {
        const duracao = Math.min(30, fim - minuto);
        return {
            id: `bloqueio-${bloqueio.recorrente ? 'recorrente-' : ''}${bloqueio.id}-${minuto}`,
            colaboradorId: String(bloqueio.colaboradorId),
            data: bloqueio.data,
            horario: `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`,
            status: 'bloqueado',
            servicoId: null,
            servicoNome: bloqueio.motivo || 'Horário indisponível',
            duracaoMin: duracao,
        };
    });
});

export const listarProfissionaisPublicos = async (req, res) => {
    try {
        const scope = await scopeFromRequest(req);
        const lista = await agendamentoService.listarColaboradores(scope.user);
        res.json(lista
            .filter((colaborador) => !scope.unidadeId || String(colaborador.unidadeId) === String(scope.unidadeId))
            .map((colaborador) => ({
            id: colaborador.id,
            name: colaborador.usuarioNome,
            color: colaborador.cor || '#C6A15B',
            avatarUrl: colaborador.avatarUrl || null,
            avatarPosition: colaborador.avatarPosition || '50% 50%',
        })));
    } catch (error) {
        sendError(res, error, 'Não foi possível carregar os profissionais.');
    }
};

export const listarServicosPublicos = async (req, res) => {
    try {
        const scope = await scopeFromRequest(req);
        const lista = await agendamentoService.listarServicos(scope.user, {
            colaboradorId: req.query.colaboradorId,
            unidadeId: scope.unidadeId ?? req.query.unidadeId,
        });
        res.json(lista.map((servico) => ({
            id: servico.id,
            name: servico.nome,
            duration: servico.duracaoMin,
            durationLabel: formatDurationLabel(servico.duracaoMin),
            price: servico.preco,
            priceLabel: servico.precoTexto || undefined,
            color: servico.cor || '#C6A15B',
        })));
    } catch (error) {
        sendError(res, error, 'Não foi possível carregar os serviços.');
    }
};

export const obterConfiguracaoPublica = async (req, res) => {
    try {
        const scope = await scopeFromRequest(req);
        const configuracao = await agendamentoService.obterConfiguracao(scope.user);
        res.json(configuracao);
    } catch (error) {
        sendError(res, error, 'Não foi possível carregar os horários de agendamento.');
    }
};

export const listarAgendamentosPublicos = async (req, res) => {
    if (!req.query.colaboradorId) {
        return res.status(400).json({ error: 'colaboradorId é obrigatório.' });
    }

    try {
        const scope = await scopeFromRequest(req);
        const lista = await agendamentoService.listarAgendamentos({ ...req.query, unidadeId: scope.unidadeId ?? req.query.unidadeId }, scope.user);
        const bloqueios = req.query.inicio && req.query.inicio === req.query.fim
            ? await agendamentoService.listarBloqueios({ data: req.query.inicio, colaboradorId: req.query.colaboradorId }, scope.user)
            : [];
        const periodosBloqueados = bloqueiosComoOcupacoesPublicas(bloqueios);
        res.json([...lista, ...periodosBloqueados]);
    } catch (error) {
        sendError(res, error, 'Não foi possível carregar os agendamentos.');
    }
};

export const listarBloqueiosPublicos = async (req, res) => {
    if (!req.query.colaboradorId) {
        return res.status(400).json({ error: 'colaboradorId é obrigatório.' });
    }

    try {
        const scope = await scopeFromRequest(req);
        const lista = await agendamentoService.listarBloqueios(req.query, scope.user);
        // A landing atual trata qualquer item como dia inteiro. Períodos são
        // representados como ocupações em /agendamentos para manter compatibilidade.
        res.json(req.query.includePeriods === '1' ? lista : lista.filter((bloqueio) => bloqueio.diaInteiro));
    } catch (error) {
        sendError(res, error, 'Não foi possível carregar os bloqueios.');
    }
};

export const consultarClientePublico = async (req, res) => {
    const phone = onlyDigits(req.query.phone);
    if (!phone) return res.status(400).json({ error: 'phone é obrigatório.' });

    try {
        const scope = await scopeFromRequest(req);
        const clientes = await agendamentoService.listarClientes(scope.user);
        const cliente = clientes.find((item) => phonesMatch(item.telefone, phone));
        if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });

        res.json({
            id: cliente.id,
            name: cliente.nome,
            phone: cliente.telefone,
            email: cliente.email,
            birthDate: cliente.nascimento,
        });
    } catch (error) {
        sendError(res, error, 'Não foi possível buscar o cliente.');
    }
};

export const criarAgendamentoPublico = async (req, res) => {
    const data = req.body || {};
    if (!data.colaboradorId || !data.clienteNome || !data.data || !data.horario) {
        return res.status(400).json({
            error: 'colaboradorId, clienteNome, data e horario são obrigatórios.',
        });
    }

    try {
        const scope = await scopeFromRequest(req);
        const agendamento = await agendamentoService.criarAgendamento({
            colaboradorId: data.colaboradorId,
            // A unidade só é aceita depois de validada dentro da empresa resolvida.
            unidadeId: scope.unidadeId ?? data.unidadeId,
            clienteId: data.clienteId,
            clienteNome: data.clienteNome,
            clienteTelefone: data.clienteTelefone,
            clienteEmail: data.clienteEmail,
            clienteNascimento: data.clienteNascimento,
            servicoId: data.servicoId,
            servicoIds: data.servicoIds,
            servicos: data.servicos,
            servicoNome: data.servicoNome,
            data: data.data,
            horario: data.horario,
            observacao: data.observacao,
            // O formulário público nunca confirma nem altera o status.
            status: 'aguardando',
        }, scope.user);

        res.status(201).json({
            id: agendamento.id,
            status: agendamento.status,
            data: agendamento.data,
            horario: agendamento.horario,
        });
    } catch (error) {
        sendError(res, error, 'Não foi possível criar o agendamento.');
    }
};

function formatDurationLabel(minutes) {
    const value = Number(minutes || 0);
    if (!value) return '';
    if (value < 60) return `${value} minutos`;
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${hours}h${rest}min` : `${hours}h`;
}

export { PublicAgendamentoScopeError };
