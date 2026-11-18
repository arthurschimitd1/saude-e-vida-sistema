import assert from 'node:assert/strict';
import test from 'node:test';
import { Op } from 'sequelize';
import { construirEscopoVenda } from '../src/services/VendaService.js';

test('escopo de vendas mantém registros atuais e recupera históricos ligados ao funcionário da empresa', () => {
  const escopo = construirEscopoVenda(19, [7, 8]);
  const alternativas = escopo[Op.or];

  assert.deepEqual(alternativas[0], { empresa_id: 19 });
  assert.equal(alternativas[1].empresa_id, null);
  assert.deepEqual(alternativas[1].funcionario_id[Op.in], [7, 8]);
});

test('escopo de vendas não cria exceção histórica quando não há funcionário da empresa', () => {
  const escopo = construirEscopoVenda(19);
  assert.deepEqual(escopo[Op.or], [{ empresa_id: 19 }]);
});
