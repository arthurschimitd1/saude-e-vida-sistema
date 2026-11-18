import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../migrations/20260908093000-reset-dom-ferraz-commissions-by-sale-date.cjs', import.meta.url),
  'utf8',
);

test('reset por data usa a data da venda e preserva recorrências', () => {
  assert.match(migration, /v\.data < TIMESTAMPTZ/);
  assert.match(migration, /JOIN vendas v ON v\.id = c\.venda_id/);
  assert.match(migration, /DELETE FROM comissoes/);
  assert.doesNotMatch(migration, /comissao_assinatura_itens/);
  assert.doesNotMatch(migration, /comissao_assinatura_competencias/);
});
