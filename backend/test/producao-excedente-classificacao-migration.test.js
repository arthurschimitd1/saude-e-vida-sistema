import assert from 'node:assert/strict';
import test from 'node:test';

import migration from '../migrations/20260908120000-classify-production-excess.cjs';

test('migration de excedente de produção é aditiva e repetível', async () => {
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
  await migration.up(queryInterface);

  assert.equal(commits, 2);
  assert.equal(consultas.filter((sql) => sql.includes('ADD COLUMN IF NOT EXISTS classificacao_desperdicio')).length, 4);
  assert.ok(consultas.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS observacao_desperdicio')));
  assert.ok(consultas.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS movimentos_producao_classificacao_idx')));
  assert.equal(consultas.some((sql) => /DELETE FROM|UPDATE\s+\w+\s+SET|TRUNCATE/i.test(sql)), false);
});
