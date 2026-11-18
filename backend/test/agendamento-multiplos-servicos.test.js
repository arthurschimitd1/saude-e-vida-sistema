import assert from 'node:assert/strict';
import test from 'node:test';

import agendamentoService, {
    extrairIdsServicosAgendamento,
    resumirServicosAgendamento,
} from '../src/services/AgendamentoService.js';
import vendaService from '../src/services/VendaService.js';
import Agendamento from '../src/models/Agendamento.js';
import AgendamentoColaborador from '../src/models/AgendamentoColaborador.js';
import AgendamentoServico from '../src/models/AgendamentoServico.js';
import AgendamentoServicoUnidade from '../src/models/AgendamentoServicoUnidade.js';
import VendaItem from '../src/models/VendaItem.js';
import Service from '../src/models/Service.js';
import migration from '../migrations/20260901193000-add-multiple-services-to-appointments.cjs';

test('múltiplos serviços somam preço e duração sem perder compatibilidade com o primeiro serviço', () => {
    const resumo = resumirServicosAgendamento([
        { id: 'corte', nome: 'Corte', preco: 45, duracaoMin: 40 },
        { id: 'pezinho', nome: 'Pezinho', preco: 15, duracaoMin: 20 },
    ]);

    assert.equal(resumo.servicoId, 'corte');
    assert.equal(resumo.servicoNome, 'Corte + Pezinho');
    assert.equal(resumo.servicoPreco, 60);
    assert.equal(resumo.servicoDuracaoMin, 60);
    assert.deepEqual(resumo.servicos.map((servico) => servico.id), ['corte', 'pezinho']);
});

test('IDs duplicados são normalizados e o payload antigo continua aceito', () => {
    assert.deepEqual(extrairIdsServicosAgendamento({ servicoIds: ['corte', 'corte', 'barba'] }), ['corte', 'barba']);
    assert.deepEqual(extrairIdsServicosAgendamento({ servicoId: 'corte' }), ['corte']);
});

test('soma usa preço e duração efetivos da unidade, sem confiar nos valores enviados pela landing', async () => {
    const original = agendamentoService.obterServicoParaUnidade;
    agendamentoService.obterServicoParaUnidade = async (_empresaId, id) => ({
        servico: { id, nome: id === 'corte' ? 'Corte' : 'Pezinho', preco: id === 'corte' ? 50 : 20, duracao_min: id === 'corte' ? 40 : 20 },
        configuracao: null,
    });

    try {
        const resumo = await agendamentoService.resolverServicosParaUnidade(3, ['corte', 'pezinho'], 7);
        assert.equal(resumo.servicoPreco, 70);
        assert.equal(resumo.servicoDuracaoMin, 60);
    } finally {
        agendamentoService.obterServicoParaUnidade = original;
    }
});

test('caixa aceita os dois serviços do mesmo agendamento na mesma venda', async () => {
    const originais = {
        agendamento: Agendamento.findOne,
        vendaItem: VendaItem.findOne,
        servico: AgendamentoServico.findOne,
        colaborador: AgendamentoColaborador.findOne,
    };
    const consultasVenda = [];
    Agendamento.findOne = async () => ({
        id: 91,
        empresa_id: 3,
        colaborador_id: 7,
        servico_id: 'corte',
        servicos: [{ id: 'corte' }, { id: 'pezinho' }],
        status: 'confirmado',
    });
    VendaItem.findOne = async ({ where }) => {
        consultasVenda.push(where);
        return null;
    };
    AgendamentoServico.findOne = async ({ where }) => ({ id: where.id, comissao_valor: 0 });
    AgendamentoColaborador.findOne = async () => ({ id: 7, usuario_id: null });

    try {
        const corte = await vendaService.resolverServicoAgenda(
            { agendamento_id: 91, servico_id: 'corte' },
            3,
            {},
            501,
        );
        const pezinho = await vendaService.resolverServicoAgenda(
            { agendamento_id: 91, servico_id: 'pezinho' },
            3,
            {},
            501,
        );

        assert.equal(corte.servico.id, 'corte');
        assert.equal(pezinho.servico.id, 'pezinho');
        assert.equal(consultasVenda.length, 2);
        assert.ok(consultasVenda.every((where) => where.agendamento_id === 91 && where.venda_id));
    } finally {
        Agendamento.findOne = originais.agendamento;
        VendaItem.findOne = originais.vendaItem;
        AgendamentoServico.findOne = originais.servico;
        AgendamentoColaborador.findOne = originais.colaborador;
    }
});

test('edição da venda aceita serviço ativo adicional da mesma empresa e unidade', async () => {
    const originais = {
        agendamento: Agendamento.findOne,
        vendaItem: VendaItem.findOne,
        servico: AgendamentoServico.findOne,
        servicoUnidade: AgendamentoServicoUnidade.findOne,
        colaborador: AgendamentoColaborador.findOne,
    };
    Agendamento.findOne = async () => ({
        id: 91,
        empresa_id: 3,
        unidade_id: 8,
        colaborador_id: 7,
        servico_id: 'corte',
        servicos: [{ id: 'corte' }],
        status: 'finalizado',
    });
    VendaItem.findOne = async () => null;
    AgendamentoServico.findOne = async ({ where }) => {
        assert.equal(where.id, 'barba');
        assert.equal(where.empresa_id, 3);
        assert.equal(where.ativo, true);
        return { id: 'barba', comissao_valor: 0 };
    };
    AgendamentoServicoUnidade.findOne = async ({ where }) => {
        assert.deepEqual(where, { empresa_id: 3, unidade_id: 8, servico_id: 'barba' });
        return { ativo: true };
    };
    AgendamentoColaborador.findOne = async () => ({ id: 7, usuario_id: null });

    try {
        await assert.rejects(
            vendaService.resolverServicoAgenda(
                { agendamento_id: 91, servico_id: 'barba' }, 3, {}, 501,
            ),
            /Serviço divergente do agendamento/,
        );

        const adicional = await vendaService.resolverServicoAgenda(
            { agendamento_id: 91, servico_id: 'barba' },
            3,
            {},
            501,
            { permitirServicoAdicional: true },
        );
        assert.equal(adicional.servico.id, 'barba');
        assert.equal(adicional.agendamento.id, 91);
    } finally {
        Agendamento.findOne = originais.agendamento;
        VendaItem.findOne = originais.vendaItem;
        AgendamentoServico.findOne = originais.servico;
        AgendamentoServicoUnidade.findOne = originais.servicoUnidade;
        AgendamentoColaborador.findOne = originais.colaborador;
    }
});

test('edição da venda rejeita serviço adicional desativado na unidade', async () => {
    const originais = {
        agendamento: Agendamento.findOne,
        vendaItem: VendaItem.findOne,
        servico: AgendamentoServico.findOne,
        servicoUnidade: AgendamentoServicoUnidade.findOne,
        colaborador: AgendamentoColaborador.findOne,
    };
    Agendamento.findOne = async () => ({
        id: 91,
        empresa_id: 3,
        unidade_id: 8,
        colaborador_id: 7,
        servico_id: 'corte',
        servicos: [{ id: 'corte' }],
        status: 'finalizado',
    });
    VendaItem.findOne = async () => null;
    AgendamentoServico.findOne = async () => ({ id: 'barba', ativo: true, comissao_valor: 0 });
    AgendamentoServicoUnidade.findOne = async () => ({ ativo: false });
    AgendamentoColaborador.findOne = async () => ({ id: 7, usuario_id: null });

    try {
        await assert.rejects(
            vendaService.resolverServicoAgenda(
                { agendamento_id: 91, servico_id: 'barba' },
                3,
                {},
                501,
                { permitirServicoAdicional: true },
            ),
            /não está disponível na unidade/,
        );
    } finally {
        Agendamento.findOne = originais.agendamento;
        VendaItem.findOne = originais.vendaItem;
        AgendamentoServico.findOne = originais.servico;
        AgendamentoServicoUnidade.findOne = originais.servicoUnidade;
        AgendamentoColaborador.findOne = originais.colaborador;
    }
});

test('serviço direto do caixa é limitado ao catálogo ativo da empresa', async () => {
    const original = Service.findOne;
    let whereRecebido;
    Service.findOne = async ({ where }) => {
        whereRecebido = where;
        return { id: 12, empresa_id: 3, name: 'Corte', ativo: true };
    };
    try {
        const servico = await vendaService.resolverServicoCatalogo(
            { catalogo_servico_id: 12 }, 3, {},
        );
        assert.equal(servico.name, 'Corte');
        assert.deepEqual(whereRecebido, { id: 12, empresa_id: 3, ativo: true });
        assert.equal(await vendaService.resolverServicoCatalogo({}, 3, {}), null);
    } finally {
        Service.findOne = original;
    }
});

test('caixa aceita serviço ativo do catálogo da agenda sem exigir agendamento', async () => {
    const original = AgendamentoServico.findOne;
    let whereRecebido;
    AgendamentoServico.findOne = async ({ where }) => {
        whereRecebido = where;
        return { id: 'corte', empresa_id: 3, nome: 'Corte', ativo: true };
    };
    try {
        const servico = await vendaService.resolverServicoAgendaCatalogo(
            { agendamento_servico_catalogo_id: 'corte' }, 3, {},
        );
        assert.equal(servico.nome, 'Corte');
        assert.deepEqual(whereRecebido, { id: 'corte', empresa_id: 3, ativo: true });
        assert.equal(await vendaService.resolverServicoAgendaCatalogo({}, 3, {}), null);
    } finally {
        AgendamentoServico.findOne = original;
    }
});

test('migration adiciona snapshots e permite itens distintos do mesmo agendamento', async () => {
    const consultas = [];
    let commits = 0;
    const transaction = {
        async commit() { commits += 1; },
        async rollback() { throw new Error('rollback inesperado'); },
    };
    const queryInterface = {
        sequelize: {
            async transaction() { return transaction; },
            async query(sql) { consultas.push(String(sql).replace(/\s+/g, ' ').trim()); },
        },
    };

    await migration.up(queryInterface);

    assert.equal(commits, 1);
    assert.ok(consultas.some((sql) => sql.includes("ADD COLUMN IF NOT EXISTS servicos JSONB NOT NULL DEFAULT '[]'::jsonb")));
    assert.ok(consultas.some((sql) => sql.includes('ON venda_itens (agendamento_id, agendamento_servico_id)')));
    assert.equal(consultas.some((sql) => /DELETE FROM agendamentos|UPDATE agendamentos/.test(sql)), false);
});
