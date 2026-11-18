import assert from 'node:assert/strict';
import test from 'node:test';

import migration from '../migrations/20260826100000-add-agendamento-servicos-por-unidade.cjs';

const Sequelize = {
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    STRING: (size) => `STRING(${size})`,
    DECIMAL: (precision, scale) => `DECIMAL(${precision},${scale})`,
    fn: (name) => ({ fn: name }),
};

function createMigrationHarness() {
    const tables = new Map([
        ['agendamentos', { id: {}, empresa_id: {}, servico_id: {} }],
    ]);
    const calls = [];
    let commits = 0;

    const sequelize = {
        async transaction() {
            return {
                async commit() { commits += 1; },
                async rollback() { throw new Error('rollback inesperado'); },
            };
        },
        async query(sql) {
            calls.push(String(sql).replace(/\s+/g, ' ').trim());
            if (String(sql).includes('to_regclass')) {
                return [[{ tabela: tables.has('agendamento_servico_unidades') ? 'agendamento_servico_unidades' : null }], []];
            }
            return [[], []];
        },
    };

    const queryInterface = {
        sequelize,
        async createTable(name, columns) {
            calls.push(`createTable:${name}`);
            tables.set(name, { ...columns });
        },
        async describeTable(name) {
            const table = tables.get(name);
            if (!table) throw new Error(`tabela ausente: ${name}`);
            return table;
        },
        async addColumn(tableName, columnName, definition) {
            calls.push(`addColumn:${tableName}.${columnName}`);
            tables.get(tableName)[columnName] = definition;
        },
    };

    return { queryInterface, calls, tables, get commits() { return commits; } };
}

test('migration da Sky é repetível e serializada para ambiente serverless', async () => {
    const harness = createMigrationHarness();

    await migration.up(harness.queryInterface, Sequelize);
    await migration.up(harness.queryInterface, Sequelize);

    assert.equal(harness.calls.filter((call) => call === 'createTable:agendamento_servico_unidades').length, 1);
    assert.equal(harness.calls.filter((call) => call.includes('pg_advisory_xact_lock')).length, 2);
    assert.equal(harness.commits, 2);
    assert.ok(harness.tables.get('agendamentos').servico_preco);
    assert.ok(harness.tables.get('agendamentos').servico_preco_texto);
    assert.ok(harness.tables.get('agendamento_servico_unidades').unidade_id);
});
