import assert from 'node:assert/strict';
import test from 'node:test';

import sequelize from '../src/config/database.js';
import EstoqueRoupa from '../src/models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../src/models/EstoqueRoupaVariacao.js';
import EstoqueRoupaFoto from '../src/models/EstoqueRoupaFoto.js';
import EstoqueRoupaMovimento from '../src/models/EstoqueRoupaMovimento.js';
import nuvemshopCatalogSyncService from '../src/services/NuvemshopCatalogSync.service.js';
import { atualizar } from '../src/controllers/EstoqueRoupaController.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(data) { this.data = data; return this; },
});

test('editar tamanho ou cor atualiza a mesma variação e preserva o vínculo', async t => {
  const updates = [];
  const existing = {
    id: 31,
    roupa_id: 9,
    tamanho: 'M',
    cor: 'Preto',
    quantidade_atual: 7,
    quantidade_minima: 1,
    estoque_infinito: false,
    fotos: [],
    async update(data) { updates.push(data); Object.assign(this, data); return this; },
  };
  const roupa = {
    id: 9,
    empresa_id: 7,
    nome: 'Camisa',
    tipo: 'Camisas',
    preco_venda: 100,
    preco_compra: 50,
    variacoes: [existing],
    toJSON() { return { ...this }; },
    async update(data) { Object.assign(this, data); return this; },
  };
  const transaction = {
    finished: false,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };

  t.mock.method(EstoqueRoupa, 'findOne', async () => roupa);
  t.mock.method(sequelize, 'transaction', async () => transaction);
  t.mock.method(EstoqueRoupaFoto, 'destroy', async () => 0);
  t.mock.method(EstoqueRoupaFoto, 'bulkCreate', async () => []);
  t.mock.method(EstoqueRoupaVariacao, 'create', async () => assert.fail('não deve criar uma segunda variação'));
  t.mock.method(EstoqueRoupaVariacao, 'destroy', async () => assert.fail('não deve excluir a variação original'));
  t.mock.method(EstoqueRoupaMovimento, 'create', async () => assert.fail('trocar descrição sem mudar saldo não gera movimento'));
  t.mock.method(nuvemshopCatalogSyncService, 'pushVariationIds', async (_empresaId, ids) => {
    assert.deepEqual(ids, [31]);
    return { updated: 1 };
  });

  const req = {
    params: { id: '9' },
    user: { id: 2, empresa_id: 7 },
    files: {},
    body: {
      nome: 'Camisa',
      tipo: 'Camisas',
      preco_venda: '100',
      preco_compra: '50',
      variacoes: JSON.stringify([{
        id: 31,
        tamanho: 'G',
        cor: 'Azul',
        quantidade_atual: 7,
        quantidade_minima: 1,
        estoque_infinito: false,
      }]),
    },
  };
  const res = response();

  await atualizar(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(transaction.finished, 'commit');
  assert.equal(existing.id, 31);
  assert.equal(existing.tamanho, 'G');
  assert.equal(existing.cor, 'Azul');
  assert.deepEqual(updates, [{
    tamanho: 'G', cor: 'Azul', quantidade_atual: 7, quantidade_minima: 1, estoque_infinito: false,
  }]);
});

test('edição rejeita ID de variação pertencente a outra peça', async t => {
  const existing = { id: 31, tamanho: 'M', cor: null, quantidade_atual: 2, quantidade_minima: 0, estoque_infinito: false, fotos: [] };
  const roupa = {
    id: 9, empresa_id: 7, nome: 'Camisa', tipo: 'Camisas', preco_venda: 100, preco_compra: 50,
    variacoes: [existing], toJSON() { return { ...this }; },
  };
  t.mock.method(EstoqueRoupa, 'findOne', async () => roupa);
  t.mock.method(sequelize, 'transaction', async () => assert.fail('não deve abrir transação para uma variação de outra peça'));

  const req = {
    params: { id: '9' }, user: { id: 2, empresa_id: 7 }, files: {},
    body: {
      nome: 'Camisa', tipo: 'Camisas', preco_venda: '100', preco_compra: '50',
      variacoes: JSON.stringify([{ id: 999, tamanho: 'G', cor: null, quantidade_atual: 2, quantidade_minima: 0 }]),
    },
  };
  const res = response();

  await atualizar(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.data.error, /não pertence a esta peça/i);
});
