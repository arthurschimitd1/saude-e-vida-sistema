import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDesperdicioPeriodo } from '../src/utils/producaoDesperdicioPeriodo.js';

const agora = new Date(2026, 7, 24, 15, 30, 0); // segunda-feira

test('resolve o dia atual sem deslocamento de fuso', () => {
  assert.deepEqual(resolveDesperdicioPeriodo({ periodo: 'dia', now: agora }), {
    periodo: 'dia', dataInicio: '2026-08-24', dataFim: '2026-08-24'
  });
});

test('resolve a semana de segunda a domingo', () => {
  assert.deepEqual(resolveDesperdicioPeriodo({ periodo: 'semana', now: agora }), {
    periodo: 'semana', dataInicio: '2026-08-24', dataFim: '2026-08-30'
  });
});

test('resolve o mês inteiro', () => {
  assert.deepEqual(resolveDesperdicioPeriodo({ periodo: 'mes', now: agora }), {
    periodo: 'mes', dataInicio: '2026-08-01', dataFim: '2026-08-31'
  });
});

test('valida período personalizado e rejeita intervalo invertido', () => {
  assert.deepEqual(resolveDesperdicioPeriodo({
    periodo: 'personalizado', dataInicio: '2026-08-01', dataFim: '2026-08-24', now: agora
  }), {
    periodo: 'personalizado', dataInicio: '2026-08-01', dataFim: '2026-08-24'
  });

  assert.throws(
    () => resolveDesperdicioPeriodo({ periodo: 'personalizado', dataInicio: '2026-08-25', dataFim: '2026-08-24' }),
    /data inicial não pode ser maior/
  );
});
