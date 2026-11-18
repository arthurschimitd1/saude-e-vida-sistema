import assert from 'node:assert/strict';
import test from 'node:test';

import { montarManifestacaoFocus } from '../src/utils/focusManifestacao.js';

test('normaliza tipos usados atualmente pelo frontend', () => {
  assert.deepEqual(montarManifestacaoFocus('CIENCIA'), { tipo: 'ciencia' });
  assert.deepEqual(montarManifestacaoFocus('CONFIRMACAO'), { tipo: 'confirmacao' });
  assert.deepEqual(montarManifestacaoFocus('DESCONHECIMENTO'), { tipo: 'desconhecimento' });
});

test('continua aceitando tipos já normalizados', () => {
  assert.deepEqual(montarManifestacaoFocus('ciencia'), { tipo: 'ciencia' });
});

test('operação não realizada exige justificativa válida', () => {
  assert.throws(
    () => montarManifestacaoFocus('OPERACAO_NAO_REALIZADA', 'curta'),
    /entre 15 e 255/
  );

  assert.deepEqual(
    montarManifestacaoFocus(
      'OPERACAO_NAO_REALIZADA',
      'Mercadoria não foi entregue pelo fornecedor'
    ),
    {
      tipo: 'nao_realizada',
      justificativa: 'Mercadoria não foi entregue pelo fornecedor'
    }
  );
});

test('rejeita tipo desconhecido antes de chamar o provedor', () => {
  assert.throws(
    () => montarManifestacaoFocus('OUTRO_EVENTO'),
    /Tipo de manifestação inválido/
  );
});
