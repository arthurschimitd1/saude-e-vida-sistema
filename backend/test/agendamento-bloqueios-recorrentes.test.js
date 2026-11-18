import assert from 'node:assert/strict';
import test from 'node:test';

import {
    diaSemanaDataCivil,
    regraRecorrenteAplicaNaData,
} from '../src/services/AgendamentoService.js';
import migration from '../migrations/20260901143000-create-agendamento-bloqueios-recorrentes.cjs';
import { bloqueiosComoOcupacoesPublicas } from '../src/controllers/PublicAgendamentoController.js';

test('identifica o dia da semana sem deslocamento de fuso horário', () => {
    assert.equal(diaSemanaDataCivil('2026-09-01'), 2);
    assert.equal(diaSemanaDataCivil('2026-09-06'), 0);
    assert.equal(diaSemanaDataCivil('data-invalida'), null);
});

test('bloqueio semanal vale apenas nos dias e no período configurados', () => {
    const regra = {
        data_inicio: '2026-09-01',
        data_fim: '2026-09-30',
        dias_semana: [1, 2, 3, 4, 5],
    };

    assert.equal(regraRecorrenteAplicaNaData(regra, '2026-09-01'), true);
    assert.equal(regraRecorrenteAplicaNaData(regra, '2026-09-05'), false);
    assert.equal(regraRecorrenteAplicaNaData(regra, '2026-10-01'), false);
    assert.equal(regraRecorrenteAplicaNaData(regra, '2026-08-31'), false);
});

test('bloqueio sem data final continua válido nas semanas futuras', () => {
    const regra = {
        data_inicio: '2026-09-01',
        data_fim: null,
        dias_semana: [2],
    };

    assert.equal(regraRecorrenteAplicaNaData(regra, '2027-09-07'), true);
    assert.equal(regraRecorrenteAplicaNaData(regra, '2027-09-08'), false);
});

test('landing recebe períodos recorrentes e bloqueios de dia inteiro como horários ocupados', () => {
    const periodo = bloqueiosComoOcupacoesPublicas([{
        id: 8,
        colaboradorId: 4,
        data: '2026-09-01',
        diaInteiro: false,
        horaInicio: '12:00',
        horaFim: '13:00',
        motivo: 'Almoço',
        recorrente: true,
    }]);
    assert.deepEqual(periodo.map((item) => item.horario), ['12:00', '12:30']);
    assert.ok(periodo.every((item) => item.id.startsWith('bloqueio-recorrente-8-')));

    const diaInteiro = bloqueiosComoOcupacoesPublicas([{
        id: 9,
        colaboradorId: 4,
        data: '2026-09-02',
        diaInteiro: true,
        horaInicio: null,
        horaFim: null,
    }]);
    assert.equal(diaInteiro.length, 48);
    assert.equal(diaInteiro[0].horario, '00:00');
    assert.equal(diaInteiro.at(-1).horario, '23:30');
});

test('migration cria estrutura aditiva e índice de consulta sem alterar bloqueios atuais', async () => {
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
    assert.ok(consultas.some((sql) => sql.includes('pg_advisory_xact_lock')));
    assert.ok(consultas.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS agendamento_bloqueios_recorrentes')));
    assert.ok(consultas.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_recorrentes_consulta')));
    assert.equal(consultas.some((sql) => /UPDATE agendamento_bloqueios\b/.test(sql)), false);
    assert.equal(consultas.some((sql) => /ALTER TABLE agendamento_bloqueios\b/.test(sql)), false);
});
