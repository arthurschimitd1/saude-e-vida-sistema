import assert from 'node:assert/strict';
import test from 'node:test';
import { asaasCheckoutUrl, LANDING_PLANS } from '../src/services/Asaas.service.js';

test('landing usa os mesmos preços do backend para mensal e anual', () => {
  assert.deepEqual([LANDING_PLANS.plano1.monthly, LANDING_PLANS.plano1.annual], [300, 2000]);
  assert.deepEqual([LANDING_PLANS.plano2.monthly, LANDING_PLANS.plano2.annual], [400, 2750]);
});

test('usa o link seguro retornado pelo Asaas', () => {
  assert.equal(
    asaasCheckoutUrl({ id: '131ca662-56c8-4479-b5b3-fd61a413fce7', link: 'https://sandbox.asaas.com/checkoutSession/show/131ca662-56c8-4479-b5b3-fd61a413fce7' }, 'sandbox'),
    'https://sandbox.asaas.com/checkoutSession/show/131ca662-56c8-4479-b5b3-fd61a413fce7'
  );
});

test('monta link pelo ID quando o Asaas não informa URL', () => {
  const id = '131ca662-56c8-4479-b5b3-fd61a413fce7';
  assert.equal(asaasCheckoutUrl({ id }, 'producao'), `https://asaas.com/checkoutSession/show?id=${id}`);
  assert.equal(asaasCheckoutUrl({ id }, 'sandbox'), `https://sandbox.asaas.com/checkoutSession/show/${id}`);
});

test('não aceita redirecionamento para domínio estranho nem ID ausente', () => {
  const id = '131ca662-56c8-4479-b5b3-fd61a413fce7';
  assert.equal(
    asaasCheckoutUrl({ id, link: 'https://asaas.com.evil.example/checkout' }, 'producao'),
    `https://asaas.com/checkoutSession/show?id=${id}`
  );
  assert.throws(() => asaasCheckoutUrl({ link: 'https://asaas.com.evil.example/checkout' }, 'producao'));
});
