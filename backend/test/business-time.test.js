import test from 'node:test';
import assert from 'node:assert/strict';

import {
  businessDate,
  businessMonthSequence,
  fiscalDateTimeForBusinessDate,
  fiscalDateTime,
  startOfBusinessDate
} from '../src/utils/businessTime.js';

const viradaUtc = new Date('2026-09-01T00:42:48.739Z');

test('instante de setembro em UTC ainda pertence a agosto no horário da empresa', () => {
  assert.equal(businessDate(viradaUtc), '2026-08-31');
  assert.equal(fiscalDateTime(viradaUtc), '2026-08-31T21:42:48-03:00');
});

test('meia-noite civil brasileira é convertida para o limite UTC correto', () => {
  assert.equal(startOfBusinessDate('2026-08-31').toISOString(), '2026-08-31T03:00:00.000Z');
  assert.equal(startOfBusinessDate('2026-09-01').toISOString(), '2026-09-01T03:00:00.000Z');
});

test('sequência mensal usa o mês comercial, não o mês UTC do servidor', () => {
  assert.deepEqual(
    businessMonthSequence(viradaUtc, 2).map((month) => month.key),
    ['2026-07', '2026-08']
  );
});

test('data fiscal escolhida mantém o relógio local e o fuso brasileiro', () => {
  assert.equal(
    fiscalDateTimeForBusinessDate(
      '2026-08-31',
      new Date('2026-09-02T01:42:48.000Z')
    ),
    '2026-08-31T22:42:48-03:00'
  );
});

test('data fiscal escolhida não pode estar no futuro comercial', () => {
  assert.throws(
    () => fiscalDateTimeForBusinessDate(
      '2026-09-01',
      new Date('2026-09-01T00:42:48.000Z')
    ),
    /não pode estar no futuro/
  );
});
