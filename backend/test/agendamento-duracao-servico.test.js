import assert from 'node:assert/strict';
import test from 'node:test';

import { duracaoEfetivaAgendamento } from '../src/services/AgendamentoService.js';
import migration from '../migrations/20260901170000-add-servico-duracao-min-agendamentos.cjs';

test('agendamento preserva a duração salva mesmo se o catálogo tiver outro valor', () => {
    const agendamento = { servico_id: 'corte', servico_duracao_min: 60 };
    assert.equal(duracaoEfetivaAgendamento(agendamento, { corte: 30 }), 60);
});

test('agendamentos legados usam a duração atual do serviço e mantêm fallback seguro', () => {
    assert.equal(duracaoEfetivaAgendamento({ servico_id: 'barba', servico_duracao_min: null }, { barba: 45 }), 45);
    assert.equal(duracaoEfetivaAgendamento({ servico_id: 'desconhecido' }, {}), 30);
});

test('migration adiciona a duração e preenche o histórico priorizando a configuração da unidade', async () => {
    const tabela = { id: {}, servico_id: {}, unidade_id: {} };
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
        async describeTable() { return tabela; },
        async addColumn(_tabela, coluna, definicao) { tabela[coluna] = definicao; },
    };

    await migration.up(queryInterface, { INTEGER: 'INTEGER' });

    assert.equal(commits, 1);
    assert.equal(tabela.servico_duracao_min.allowNull, true);
    const backfill = consultas.find((sql) => sql.startsWith('UPDATE agendamentos AS ag'));
    assert.ok(backfill?.includes('agendamento_servico_unidades'));
    assert.ok(backfill?.includes('agendamento_servicos'));
    assert.ok(backfill?.indexOf('unidade.duracao_min') < backfill?.indexOf('servico.duracao_min'));
    assert.ok(backfill?.includes('WHERE ag.servico_duracao_min IS NULL'));
});
