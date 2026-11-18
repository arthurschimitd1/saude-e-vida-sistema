import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPeriodo, filtroDataInclusivo } from '../src/utils/financeiroPeriodo.js';

const Op = { gte: Symbol('gte'), lt: Symbol('lt') };

test('período financeiro inclui todo o último dia', () => {
  assert.deepEqual(normalizarPeriodo('2026-08-01', '2026-08-31'), {
    dataInicio: '2026-08-01',
    dataFimExclusivo: '2026-09-01',
  });
});

test('período financeiro aceita somente um limite válido', () => {
  assert.deepEqual(normalizarPeriodo('2026-08-01', 'data-inválida'), {
    dataInicio: '2026-08-01',
    dataFimExclusivo: null,
  });
  assert.equal(normalizarPeriodo('31/08/2026', null).dataInicio, null);
});

test('filtro ORM usa início inclusivo e fim exclusivo', () => {
  const filtro = filtroDataInclusivo('2026-08-01', '2026-08-31', Op);
  assert.equal(filtro[Op.gte].toISOString(), '2026-08-01T03:00:00.000Z');
  assert.equal(filtro[Op.lt].toISOString(), '2026-09-01T03:00:00.000Z');
});
