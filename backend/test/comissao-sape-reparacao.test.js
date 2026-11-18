import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../migrations/20260904114500-repair-sape-commissions.cjs', import.meta.url),
  'utf8',
);

test('reparo de Sapé é restrito aos profissionais, período e venda de produto auditados', () => {
  assert.match(migration, /Dom Ferraz - Sapé/);
  assert.match(migration, /ALYSSON HENRIQUE ALVES - SAPE/);
  assert.match(migration, /JEAN CARLOS FRANCISCO - SAPE/);
  assert.match(migration, /v\.id = 8270/);
  assert.match(migration, /2026-09-01 00:00:00-03:00/);
  assert.match(migration, /2026-09-05 00:00:00-03:00/);
});

test('reparo preserva valores anteriores e impede comissões duplicadas', () => {
  assert.match(migration, /valor_anterior/);
  assert.match(migration, /origem_calculo_anterior/);
  assert.match(migration, /NOT EXISTS/);
  assert.match(migration, /ON CONFLICT DO NOTHING/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /COALESCE\(u\.comissao_valor, 0\) = 0/);
});
