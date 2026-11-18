import test from 'node:test';
import assert from 'node:assert/strict';
import {
    configuracaoAgendamentoPorNome,
    horarioPertenceConfiguracao,
    validarConfiguracaoHorario,
} from '../src/services/AgendamentoConfiguracaoService.js';
import migrationIntervalo from '../migrations/20260901101500-add-intervalo-min-agendamento-configuracoes.cjs';

test('as três empresas Dom Ferraz usam a mesma grade de 40 minutos', () => {
    for (const nome of ['Dom Ferraz - Manaíra', 'Dom Ferraz - Miramar', 'Dom Ferraz - Sapé']) {
        const configuracao = configuracaoAgendamentoPorNome(nome);
        assert.equal(configuracao.personalizada, true);
        assert.equal(configuracao.marca, 'dom-ferraz');
        assert.equal(configuracao.horaInicio, '09:00');
        assert.equal(configuracao.horaFim, '19:00');
        assert.equal(configuracao.intervaloMin, 40);
    }
});

test('a grade Dom Ferraz aceita apenas inícios de 40 em 40 minutos', () => {
    const configuracao = configuracaoAgendamentoPorNome('Dom Ferraz - Manaíra');
    assert.equal(horarioPertenceConfiguracao('09:00', 30, configuracao), true);
    assert.equal(horarioPertenceConfiguracao('09:40', 30, configuracao), true);
    assert.equal(horarioPertenceConfiguracao('10:20', 30, configuracao), true);
    assert.equal(horarioPertenceConfiguracao('09:30', 30, configuracao), false);
    assert.equal(horarioPertenceConfiguracao('18:20', 40, configuracao), true);
    assert.equal(horarioPertenceConfiguracao('18:20', 60, configuracao), false);
});

test('outras empresas preservam a agenda já existente', () => {
    const configuracao = configuracaoAgendamentoPorNome('Outra empresa');
    assert.equal(configuracao.personalizada, false);
    assert.equal(horarioPertenceConfiguracao('09:17', 30, configuracao), true);
});

test('a empresa pode escolher início, fim e intervalo sem perder a configuração atual', () => {
    const configuracao = configuracaoAgendamentoPorNome('Dom Ferraz - Sapé');
    assert.deepEqual(
        validarConfiguracaoHorario({ horaInicio: '08:20', horaFim: '18:20', intervaloMin: 30 }, configuracao),
        { horaInicio: '08:20', horaFim: '18:20', intervaloMin: 30 },
    );
    assert.deepEqual(
        validarConfiguracaoHorario({ horaInicio: '08:20', horaFim: '18:20' }, configuracao),
        { horaInicio: '08:20', horaFim: '18:20', intervaloMin: 40 },
    );
    assert.throws(
        () => validarConfiguracaoHorario({ horaInicio: '18:00', horaFim: '17:00' }, configuracao),
        /posterior/,
    );
    assert.throws(
        () => validarConfiguracaoHorario({ horaInicio: '09:00', horaFim: '09:20' }, configuracao),
        /40 minutos/,
    );
    assert.throws(
        () => validarConfiguracaoHorario({ horaInicio: '09:00', horaFim: '19:00', intervaloMin: 25 }, configuracao),
        /intervalo válido/,
    );
});

test('migration do intervalo é aditiva, repetível e não reescreve configurações atuais', async () => {
    const tabela = { id: {}, empresa_id: {}, hora_inicio: {}, hora_fim: {} };
    const chamadas = [];
    const queryInterface = {
        sequelize: {
            async transaction() {
                return { async commit() {}, async rollback() {} };
            },
            async query(sql) {
                chamadas.push(String(sql));
                return [[], []];
            },
        },
        async describeTable() { return tabela; },
        async addColumn(_nomeTabela, nomeColuna, definicao) {
            chamadas.push(`add:${nomeColuna}`);
            tabela[nomeColuna] = definicao;
        },
    };

    await migrationIntervalo.up(queryInterface, { INTEGER: 'INTEGER' });
    await migrationIntervalo.up(queryInterface, { INTEGER: 'INTEGER' });

    assert.equal(chamadas.filter((chamada) => chamada === 'add:intervalo_min').length, 1);
    assert.equal(tabela.intervalo_min.allowNull, true);
    assert.equal(Object.hasOwn(tabela, 'hora_inicio'), true);
    assert.equal(Object.hasOwn(tabela, 'hora_fim'), true);
});
