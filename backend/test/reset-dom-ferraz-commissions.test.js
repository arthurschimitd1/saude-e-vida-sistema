import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../migrations/20260908090000-reset-dom-ferraz-commissions.cjs', import.meta.url),
  'utf8',
);

test('reset de comissões é limitado às três unidades Dom Ferraz e ao período anterior ao corte', () => {
  assert.match(migration, /Dom Ferraz - Manaira/);
  assert.match(migration, /Dom Ferraz - Miramar/);
  assert.match(migration, /Dom Ferraz - Sapé/);
  assert.match(migration, /2026-09-08 00:00:00-03:00/);
  assert.match(migration, /v\.data < TIMESTAMPTZ/);
});

test('reset altera somente a tabela de comissões comuns', () => {
  const deletes = [...migration.matchAll(/DELETE FROM\s+([a-z_]+)/g)].map((match) => match[1]);
  assert.deepEqual(deletes, ['comissoes']);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /comissao_assinatura_itens/);
  assert.doesNotMatch(migration, /comissao_assinatura_competencias/);
  assert.doesNotMatch(migration, /\bUPDATE\s+(vendas|users|empresas|agendamentos|produtos)\b/i);
  assert.doesNotMatch(migration, /\bDELETE FROM\s+(vendas|users|empresas|agendamentos|produtos)\b/i);
});

test('reset cria backup transacional e rollback somente da tabela de comissões comuns', () => {
  assert.match(migration, /backup_comissoes_dom_ferraz_20260908/);
  assert.match(migration, /TO_JSONB\(c\)/);
  assert.match(migration, /JSONB_POPULATE_RECORD\(NULL::comissoes/);
  assert.match(migration, /transaction\.commit\(\)/);
  assert.match(migration, /transaction\.rollback\(\)/);
});
