import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesNormalizedText, normalizeSearchText } from '../src/utils/textSearch.js';

test('normaliza nomes sem diferenciar caixa, acentos e espaços', () => {
  assert.equal(normalizeSearchText('  JOÃO   da SILVA  '), 'joao da silva');
});

test('encontra partes do nome mesmo sem acentos e com caixa diferente', () => {
  assert.equal(matchesNormalizedText('Antônio César Ferreira', 'antonio cesar'), true);
  assert.equal(matchesNormalizedText('MARIA DA CONCEIÇÃO', 'Conceicao'), true);
  assert.equal(matchesNormalizedText('Cassiano Ribeiro', 'ana'), false);
});
