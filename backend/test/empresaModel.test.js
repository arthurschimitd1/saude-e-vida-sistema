import assert from 'node:assert/strict';
import test from 'node:test';

import Empresa from '../src/models/Empresa.js';

test('modelo Empresa aponta para a tabela existente sem criar timestamps', () => {
  assert.equal(Empresa.tableName, 'empresas');
  assert.equal(Empresa.options.timestamps, false);
});

test('modelo Empresa mantém permissões como array do PostgreSQL', () => {
  const permissoes = Empresa.getAttributes().permissoes;

  assert.equal(permissoes.type.constructor.key, 'ARRAY');
  assert.equal(permissoes.type.type.constructor.key, 'STRING');
});

test('CNPJ da empresa é opcional para preservar cadastros existentes', () => {
  const cnpj = Empresa.getAttributes().cnpj;

  assert.equal(cnpj.type.constructor.key, 'STRING');
  assert.equal(cnpj.allowNull, true);
});
