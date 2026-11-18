import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAsaasError,
  PAYMENT_EVENTS,
  SUBSCRIPTION_EVENTS,
} from '../src/services/Asaas.service.js';

test('API Key recusada pelo Asaas não encerra a sessão do Lucro+', () => {
  const error = normalizeAsaasError({
    errors: [{ code: 'invalid_access_token', description: 'Token inválido' }],
  }, 401);

  assert.equal(error.status, 422);
  assert.equal(error.providerStatus, 401);
  assert.equal(error.code, 'invalid_access_token');
  assert.match(error.message, /recusou a API Key/);
  assert.match(error.message, /ambiente selecionado/);
});

test('outros erros do Asaas preservam o status original', () => {
  const error = normalizeAsaasError({ message: 'Muitas requisições' }, 429);

  assert.equal(error.status, 429);
  assert.equal(error.providerStatus, 429);
  assert.match(error.message, /Asaas \(429\)/);
});

test('webhook usa somente os nomes atuais dos eventos de chargeback e assinatura', () => {
  assert.equal(PAYMENT_EVENTS.includes('PAYMENT_CHARGEBACK_REVERSED'), false);
  assert.equal(PAYMENT_EVENTS.includes('PAYMENT_AWAITING_CHARGEBACK_REVERSAL'), true);
  assert.equal(SUBSCRIPTION_EVENTS.includes('SUBSCRIPTION_INACTIVATED'), true);
});
