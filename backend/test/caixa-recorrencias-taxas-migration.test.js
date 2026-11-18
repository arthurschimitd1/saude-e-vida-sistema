import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import migration from '../migrations/20260903110000-caixa-recorrencias-taxas.cjs';

test('migration financeira é aditiva e tolera duplicidades históricas', async () => {
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
  assert.ok(consultas.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS caixa_lancamentos')));
  assert.ok(consultas.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS taxas_cartao')));
  assert.ok(consultas.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS catalogo_servico_id')));
  assert.ok(consultas.some((sql) => sql.includes('IF NOT EXISTS ( SELECT 1 FROM comissoes')));
  assert.equal(consultas.some((sql) => /DELETE FROM|UPDATE\s+\w+\s+SET/i.test(sql)), false);
});

test('backfill permanece manual e também é idempotente sem depender do índice', () => {
  const sql = fs.readFileSync(new URL('../scripts/backfill-comissoes-servicos-20260902.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT EXISTS\s*\(\s*SELECT 1\s+FROM comissoes existente/i);
  assert.match(sql, /v\.empresa_id IN \(55, 59, 60\)/);
});
