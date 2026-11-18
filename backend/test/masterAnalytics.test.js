import test from 'node:test';
import assert from 'node:assert/strict';
import masterOnly from '../src/middlewares/masterOnly.js';
import { normalizeFilters } from '../src/services/MasterAnalyticsService.js';

const runMasterOnly = user => {
  const req = { user };
  let statusCode;
  let payload;
  let continued = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  masterOnly(req, res, () => { continued = true; });
  return { statusCode, payload, continued };
};

test('relatórios estratégicos permitem somente usuário MASTER', () => {
  assert.equal(runMasterOnly({ tipo: 'MASTER' }).continued, true);
  const denied = runMasterOnly({ tipo: 'USUARIO', email: 'cliente@teste.com' });
  assert.equal(denied.continued, false);
  assert.equal(denied.statusCode, 403);
});

test('conta master legada continua autorizada', () => {
  assert.equal(runMasterOnly({ tipo: 'USUARIO', email: 'admin@master.com' }).continued, true);
});

test('filtros normalizam empresa e pacote sem aceitar empresa inválida', () => {
  assert.deepEqual(normalizeFilters({
    startDate: '2026-07-01', endDate: '2026-07-31', companyId: '12', packageName: ' Pacote 2 '
  }), {
    startDate: '2026-07-01', endDate: '2026-07-31', companyId: 12, packageName: 'Pacote 2'
  });
  assert.throws(() => normalizeFilters({ companyId: '-1' }), /Empresa inválida/);
});

test('filtros rejeitam intervalo de datas invertido', () => {
  assert.throws(() => normalizeFilters({ startDate: '2026-08-10', endDate: '2026-08-01' }), /data inicial/);
});
