import assert from 'node:assert/strict';
import test from 'node:test';

import agendamentoService, { filtrarRecorrenciasComExcecao } from '../src/services/AgendamentoService.js';
import AgendamentoBloqueio from '../src/models/AgendamentoBloqueio.js';
import AgendamentoBloqueioRecorrente from '../src/models/AgendamentoBloqueioRecorrente.js';
import AgendamentoBloqueioRecorrenteExcecao from '../src/models/AgendamentoBloqueioRecorrenteExcecao.js';
import AgendamentoColaborador from '../src/models/AgendamentoColaborador.js';
import migration from '../migrations/20260901183000-enable-multiple-agenda-blocks.cjs';

test('uma exceção remove apenas a ocorrência correspondente da recorrência', () => {
    const recorrencias = [{ id: 10 }, { id: 11 }];
    const resultado = filtrarRecorrenciasComExcecao(recorrencias, [{ recorrente_id: 10 }]);
    assert.deepEqual(resultado, [{ id: 11 }]);
});

test('cada bloqueio avulso do mesmo dia é criado como registro independente', async () => {
    const originais = {
        findColaborador: AgendamentoColaborador.findOne,
        createBloqueio: AgendamentoBloqueio.create,
    };
    const criados = [];
    AgendamentoColaborador.findOne = async () => ({ id: 4 });
    AgendamentoBloqueio.create = async (dados) => {
        const registro = { id: criados.length + 1, ...dados };
        criados.push(registro);
        return registro;
    };

    try {
        const usuario = { tipo: 'EMPRESA', empresa_id: 2 };
        await agendamentoService.bloquearDia({ colaboradorId: 4, data: '2026-09-01', diaInteiro: false, horaInicio: '12:00', horaFim: '13:00' }, usuario);
        await agendamentoService.bloquearDia({ colaboradorId: 4, data: '2026-09-01', diaInteiro: false, horaInicio: '15:00', horaFim: '16:00' }, usuario);
        assert.equal(criados.length, 2);
        assert.deepEqual(criados.map((item) => item.hora_inicio), ['12:00', '15:00']);
    } finally {
        AgendamentoColaborador.findOne = originais.findColaborador;
        AgendamentoBloqueio.create = originais.createBloqueio;
    }
});

test('remover só uma data cria exceção sem apagar a recorrência', async () => {
    const originais = {
        findRecorrencia: AgendamentoBloqueioRecorrente.findOne,
        destroyRecorrencia: AgendamentoBloqueioRecorrente.destroy,
        findOrCreateExcecao: AgendamentoBloqueioRecorrenteExcecao.findOrCreate,
    };
    let excecaoCriada = null;
    let recorrenciasApagadas = 0;
    AgendamentoBloqueioRecorrente.findOne = async () => ({
        id: 7,
        data_inicio: '2026-09-01',
        data_fim: null,
        dias_semana: [2],
    });
    AgendamentoBloqueioRecorrente.destroy = async () => { recorrenciasApagadas += 1; };
    AgendamentoBloqueioRecorrenteExcecao.findOrCreate = async (dados) => { excecaoCriada = dados; return [{}, true]; };

    try {
        await agendamentoService.desbloquearDia({ colaboradorId: 4, data: '2026-09-01', recorrenteId: 7, somenteOcorrencia: true }, { tipo: 'EMPRESA', empresa_id: 2 });
        assert.equal(recorrenciasApagadas, 0);
        assert.deepEqual(excecaoCriada.where, { recorrente_id: 7, data: '2026-09-01' });
        assert.deepEqual(excecaoCriada.defaults, { empresa_id: 2, colaborador_id: 4 });
    } finally {
        AgendamentoBloqueioRecorrente.findOne = originais.findRecorrencia;
        AgendamentoBloqueioRecorrente.destroy = originais.destroyRecorrencia;
        AgendamentoBloqueioRecorrenteExcecao.findOrCreate = originais.findOrCreateExcecao;
    }
});

test('migration libera múltiplos bloqueios e cria exceções recorrentes de forma aditiva', async () => {
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
    assert.ok(consultas.some((sql) => sql.includes('DROP CONSTRAINT')));
    assert.ok(consultas.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_consulta')));
    assert.ok(consultas.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS agendamento_bloqueios_recorrentes_excecoes')));
    assert.ok(consultas.some((sql) => sql.includes('UNIQUE (recorrente_id, data)')));
    assert.equal(consultas.some((sql) => /DELETE FROM agendamento_bloqueios\b/.test(sql)), false);
    assert.equal(consultas.some((sql) => /UPDATE agendamento_bloqueios\b/.test(sql)), false);
});
