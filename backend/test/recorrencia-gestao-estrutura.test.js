import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('migration de gestão de recorrência é idempotente e preserva o legado', () => {
  const file = path.join(backendDir, 'migrations', '20260825140000-recurrence-management-asaas.cjs');
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS recorrencia_configuracoes/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS recorrencia_planos/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS recorrencia_auditoria/);
  assert.match(source, /CREATE INDEX IF NOT EXISTS idx_recorrencia_auditoria/);
  assert.match(source, /status_recorrencia/);
  assert.match(source, /asaas_refund_status/);
  assert.match(source, /payload/);
  assert.match(source, /async down\(queryInterface\)/);
});

test('status da recorrência possui estados separados do status do pagamento', () => {
  const model = fs.readFileSync(path.join(backendDir, 'src', 'models', 'Recorrencia.js'), 'utf8');
  const payment = fs.readFileSync(path.join(backendDir, 'src', 'models', 'HistoricoPagamento.js'), 'utf8');
  assert.match(model, /statusRecorrencia/);
  assert.match(model, /asaasSubscriptionStatus/);
  assert.match(payment, /asaasRefundStatus/);
  assert.match(payment, /reciboEmitidoAt/);
});
