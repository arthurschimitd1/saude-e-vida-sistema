import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STATUS_MDFE_EDITAVEIS,
  cpfValido,
  mapearStatusFocus,
  normalizarPlaca,
  validarMdfe
} from '../src/utils/manifestoValidation.js';

test('normaliza placa sem alterar a regra de validação brasileira', () => {
  assert.equal(normalizarPlaca('abc-1d23'), 'ABC1D23');
});

test('valida CPF de condutor localmente', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('MDF-e exige rota, veículo, condutor, documento e carga antes da emissão', () => {
  const erros = validarMdfe({}, [], null, []);

  assert.ok(erros.some((erro) => erro.includes('tipo de emitente')));
  assert.ok(erros.some((erro) => erro.includes('veículo')));
  assert.ok(erros.some((erro) => erro.includes('condutor')));
  assert.ok(erros.some((erro) => erro.includes('NF-e ou CT-e')));
});

test('rascunho validado continua editável até a emissão', () => {
  assert.equal(STATUS_MDFE_EDITAVEIS.has('PRONTO_PARA_EMISSAO'), true);
  assert.equal(STATUS_MDFE_EDITAVEIS.has('AUTORIZADO'), false);
});

test('mapeia respostas do provedor sem realizar qualquer chamada externa', () => {
  assert.equal(mapearStatusFocus({ status: 'autorizado' }), 'AUTORIZADO');
  assert.equal(mapearStatusFocus({ status: 'processando_autorizacao' }), 'PROCESSANDO');
  assert.equal(mapearStatusFocus({ status: 'rejeitado' }), 'REJEITADO');
});
