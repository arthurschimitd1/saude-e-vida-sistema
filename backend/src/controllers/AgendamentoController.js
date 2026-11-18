import agendamentoService from '../services/AgendamentoService.js';

export const obterConfiguracaoAgenda = async (req, res) => {
    try { res.json(await agendamentoService.obterConfiguracao(req.user)); }
    catch (error) { res.status(500).json({ error: error.message }); }
};

export const salvarConfiguracaoAgenda = async (req, res) => {
    try { res.json(await agendamentoService.salvarConfiguracao(req.body, req.user)); }
    catch (error) { res.status(error.message?.includes('permissão') ? 403 : 400).json({ error: error.message }); }
};

export const listarUnidades = async (req, res) => {
    try { res.json(await agendamentoService.listarUnidades(req.user)); }
    catch (error) { res.status(500).json({ error: error.message }); }
};

export const criarUnidade = async (req, res) => {
    try { res.status(201).json(await agendamentoService.criarUnidade(req.body, req.user)); }
    catch (error) { res.status(400).json({ error: error.message }); }
};

export const atualizarUnidade = async (req, res) => {
    try { res.json(await agendamentoService.atualizarUnidade(req.params.id, req.body, req.user)); }
    catch (error) { res.status(400).json({ error: error.message }); }
};

export const excluirUnidade = async (req, res) => {
    try { await agendamentoService.excluirUnidade(req.params.id, req.user); res.status(204).end(); }
    catch (error) { res.status(400).json({ error: error.message }); }
};

export const listarColaboradores = async (req, res) => {
    try {
        const lista = await agendamentoService.listarColaboradores(req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const criarColaborador = async (req, res) => {
    try {
        const colaborador = await agendamentoService.criarColaborador(req.body, req.user);
        res.status(201).json(colaborador);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const atualizarColaborador = async (req, res) => {
    try { res.json(await agendamentoService.atualizarColaborador(req.params.id, req.body, req.user)); }
    catch (error) { res.status(400).json({ error: error.message }); }
};

export const excluirColaborador = async (req, res) => {
    try {
        await agendamentoService.excluirColaborador(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const listarAgendamentos = async (req, res) => {
    try {
        const lista = await agendamentoService.listarAgendamentos(req.query, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const criarAgendamento = async (req, res) => {
    try {
        const agendamento = await agendamentoService.criarAgendamento(req.body, req.user);
        res.status(201).json(agendamento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const atualizarAgendamento = async (req, res) => {
    try {
        const agendamento = await agendamentoService.atualizarAgendamento(req.params.id, req.body, req.user);
        res.json(agendamento);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const excluirAgendamento = async (req, res) => {
    try {
        await agendamentoService.excluirAgendamento(req.params.id, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const listarClientesAgenda = async (req, res) => {
    try {
        const lista = await agendamentoService.listarClientes(req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const listarServicosAgenda = async (req, res) => {
    try {
        const lista = await agendamentoService.listarServicos(req.user, {
            colaboradorId: req.query.colaboradorId,
            unidadeId: req.query.unidadeId,
            incluirInativos: req.query.incluirInativos === '1',
        });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const criarServicoAgenda = async (req, res) => {
    try {
        const servico = await agendamentoService.criarServico(req.body, req.user);
        res.status(201).json(servico);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const atualizarServicoAgenda = async (req, res) => {
    try {
        const servico = await agendamentoService.atualizarServico(req.params.id, req.body, req.user);
        res.json(servico);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const excluirServicoAgenda = async (req, res) => {
    try {
        await agendamentoService.excluirServico(req.params.id, req.user, {
            unidadeId: req.query.unidadeId,
        });
        res.status(204).end();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const listarBloqueios = async (req, res) => {
    try {
        const lista = await agendamentoService.listarBloqueios(req.query, req.user);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const bloquearDia = async (req, res) => {
    try {
        const bloqueio = await agendamentoService.bloquearDia(req.body, req.user);
        res.status(201).json(bloqueio);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const atualizarBloqueio = async (req, res) => {
    try {
        const bloqueio = await agendamentoService.atualizarBloqueio(req.body, req.user);
        res.json(bloqueio);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const desbloquearDia = async (req, res) => {
    try {
        await agendamentoService.desbloquearDia(req.body, req.user);
        res.status(204).end();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
