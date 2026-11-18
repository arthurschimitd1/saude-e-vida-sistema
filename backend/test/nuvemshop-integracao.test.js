import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  canManageIntegration,
  createOauthState,
  getNuvemshopAppUrls,
  resolveEmpresaId,
  verifyOauthState,
  verifyWebhookSignature,
} from '../src/services/Nuvemshop.service.js';
import { findLocalProduct, managedStock, scopeList, selectProductVariants, uniqueRemoteProductIds, variantImages, variantLabels } from '../src/services/NuvemshopCatalogSync.service.js';
import nuvemshopCatalogSyncService from '../src/services/NuvemshopCatalogSync.service.js';
import sequelize from '../src/config/database.js';
import EstoqueRoupa from '../src/models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../src/models/EstoqueRoupaVariacao.js';
import EstoqueRoupaFoto from '../src/models/EstoqueRoupaFoto.js';
import EstoqueRoupaMovimento from '../src/models/EstoqueRoupaMovimento.js';
import NuvemshopProdutoVinculo from '../src/models/NuvemshopProdutoVinculo.js';

const withEnv = (values, callback) => {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return callback(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('URLs da aplicação apontam para callback e webhooks próprios sem duplicar /api', () => withEnv({
  PUBLIC_API_URL: 'https://backend.example/api/',
  FRONTEND_URL: 'https://frontend.example,https://preview.example',
}, () => {
  assert.deepEqual(getNuvemshopAppUrls(), {
    site: 'https://frontend.example/uikit/estoque-roupas',
    callback: 'https://backend.example/api/integracoes/nuvemshop/callback',
    storeRedact: 'https://backend.example/api/integracoes/nuvemshop/webhooks/store-redact',
    customersRedact: 'https://backend.example/api/integracoes/nuvemshop/webhooks/customers-redact',
    customersDataRequest: 'https://backend.example/api/integracoes/nuvemshop/webhooks/customers-data-request',
    events: 'https://backend.example/api/integracoes/nuvemshop/webhooks/events',
  });
}));

test('estoque remoto só é autoritativo quando a variação é gerenciada', () => {
  assert.equal(managedStock({ stock_management: false, stock: null }), null);
  assert.equal(managedStock({ stock_management: true, stock: 7 }), 7);
  assert.equal(managedStock({ stock_management: true, stock: 99, inventory_levels: [
    { location_id: 'a', stock: 2 }, { location_id: 'b', stock: 3 },
  ] }), 5);
  assert.equal(managedStock({ stock_management: true, stock: null }), null);
});

test('interpreta tamanho, cor e composição de pack pelas variações da Nuvemshop', () => {
  assert.deepEqual(variantLabels({
    handle: { pt: 'camisa-teste' },
    attributes: [{ pt: 'Tamanho' }, { pt: 'Cor' }],
  }, { values: [{ pt: 'M' }, { pt: 'Azul' }] }), { tamanho: 'M', cor: 'Azul' });
  assert.deepEqual(variantLabels({
    handle: { pt: 'pack-3-cuecas-calvin-klein-fxy85' },
    attributes: [{ pt: 'Tamanho' }],
  }, { values: [{ pt: 'G' }] }), { tamanho: 'G', cor: 'Azul / Preta / Cinza' });
});

test('grade com tamanho e cor substitui a grade antiga que tinha somente tamanho', () => {
  const product = {
    attributes: [{ pt: 'Tamanho' }, { pt: 'Cor' }],
    variants: [
      { id: 10, values: [{ pt: 'M' }] },
      { id: 11, values: [{ pt: 'G' }] },
      { id: 20, values: [{ pt: 'M' }, { pt: 'Preto' }] },
      { id: 21, values: [{ pt: 'G' }, { pt: 'Preto' }] },
      { id: 30, values: [{ pt: 'GG' }] },
    ],
  };
  const selected = selectProductVariants(product);
  assert.deepEqual(selected.active.map(entry => entry.variant.id), [20, 21, 30]);
  assert.deepEqual(selected.superseded.map(entry => entry.variant.id), [10, 11]);
});

test('cada variação recebe somente sua foto e imagens gerais não fingem ser outra cor', () => {
  const product = {
    images: [
      { id: 10, src: '/preto.jpg' },
      { id: 20, src: '/azul.jpg' },
      { id: 30, src: '/detalhe-geral.jpg' },
    ],
    variants: [{ id: 1, image_id: 10 }, { id: 2, image_id: 20 }],
  };
  assert.deepEqual(variantImages(product, product.variants[0], true), [
    { id: 10, src: '/preto.jpg', kind: 'variant' },
    { id: 30, src: '/detalhe-geral.jpg', kind: 'product' },
  ]);
  assert.deepEqual(variantImages(product, product.variants[1], false), [
    { id: 20, src: '/azul.jpg', kind: 'variant' },
  ]);
});

test('produtos homônimos da Nuvemshop permanecem em cards distintos pelo identificador URL', () => {
  const cardAntigo = { id: 10, nome: 'BERMUDA UST JEANS', codigo: 'x', observacao: 'Origem Nuvemshop: bermuda-azul' };
  const mappings = [
    { roupa_id: 10, nuvemshop_product_id: 100 },
    { roupa_id: 10, nuvemshop_product_id: 200 },
  ];
  assert.equal(findLocalProduct({
    product: { id: 100, handle: { pt: 'bermuda-azul' }, name: { pt: 'BERMUDA UST JEANS' } },
    products: [cardAntigo], mappings,
  }), cardAntigo);
  assert.equal(findLocalProduct({
    product: { id: 200, handle: { pt: 'bermuda-preta' }, name: { pt: 'BERMUDA UST JEANS' } },
    products: [cardAntigo], mappings,
  }), null);
  assert.equal(findLocalProduct({
    product: { id: 300, handle: { pt: 'bermuda-cinza' }, name: { pt: 'BERMUDA UST JEANS' } },
    products: [{ id: 11, nome: 'BERMUDA UST JEANS', observacao: null }], mappings: [],
  }), null);
});

test('alterar a variação de um produto duplicado atualiza o mesmo vínculo sem manter o valor anterior', async t => {
  const updates = [];
  const variacao = {
    id: 31,
    roupa_id: 9,
    tamanho: 'M',
    cor: 'Preto',
    quantidade_atual: 7,
    quantidade_minima: 0,
    estoque_infinito: false,
    async update(data) { updates.push(data); Object.assign(this, data); return this; },
  };
  const roupa = {
    id: 9,
    empresa_id: 7,
    nome: 'Camisa duplicada',
    codigo: 'NS-camisa-duplicada',
    observacao: 'Origem Nuvemshop: camisa-duplicada',
    variacoes: [variacao],
    async update(data) { Object.assign(this, data); return this; },
  };
  const mapping = {
    id: 81,
    roupa_id: 9,
    variacao_id: 31,
    nuvemshop_product_id: 200,
    nuvemshop_variant_id: 300,
    async update(data) { Object.assign(this, data); return this; },
  };
  const transaction = {
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };

  t.mock.method(EstoqueRoupa, 'findAll', async () => [roupa]);
  t.mock.method(NuvemshopProdutoVinculo, 'findAll', async () => [mapping]);
  t.mock.method(EstoqueRoupaVariacao, 'findByPk', async () => variacao);
  t.mock.method(EstoqueRoupaVariacao, 'create', async () => assert.fail('não deve criar outra variação'));
  t.mock.method(NuvemshopProdutoVinculo, 'create', async () => assert.fail('não deve criar outro vínculo'));
  t.mock.method(EstoqueRoupaMovimento, 'create', async () => assert.fail('trocar a descrição não movimenta estoque'));
  t.mock.method(EstoqueRoupaFoto, 'findAll', async () => []);
  t.mock.method(sequelize, 'transaction', async () => transaction);

  const summary = await nuvemshopCatalogSyncService.pullProducts({
    integration: { id: 5, empresa_id: 7 },
    products: [{
      id: 200,
      name: { pt: 'Camisa duplicada' },
      handle: { pt: 'camisa-duplicada' },
      attributes: [{ pt: 'Tamanho' }, { pt: 'Cor' }],
      images: [],
      variants: [{ id: 300, values: [{ pt: 'G' }, { pt: 'Azul' }], stock_management: true, stock: 7, price: 100 }],
    }],
  });

  assert.equal(transaction.finished, 'commit');
  assert.equal(summary.variantsCreated, 0);
  assert.equal(variacao.id, 31);
  assert.equal(variacao.tamanho, 'G');
  assert.equal(variacao.cor, 'Azul');
  assert.deepEqual(updates, [{ tamanho: 'G', cor: 'Azul' }]);
  assert.equal(mapping.variacao_id, 31);
});

test('troca de ID da variação na Nuvemshop reaproveita a linha anterior em vez de duplicá-la', async t => {
  const variacao = {
    id: 41,
    roupa_id: 19,
    tamanho: 'M',
    cor: 'Preto',
    quantidade_atual: 3,
    quantidade_minima: 0,
    estoque_infinito: false,
    async update(data) { Object.assign(this, data); return this; },
  };
  const roupa = {
    id: 19,
    empresa_id: 7,
    nome: 'Camisa copiada',
    codigo: 'NS-camisa-copiada',
    observacao: 'Origem Nuvemshop: camisa-copiada',
    variacoes: [variacao],
    async update(data) { Object.assign(this, data); return this; },
  };
  const mapping = {
    id: 91,
    roupa_id: 19,
    variacao_id: 41,
    nuvemshop_product_id: 220,
    nuvemshop_variant_id: 330,
    nuvemshop_sku: 'CAMISA-M-PRETO',
    async update(data) { Object.assign(this, data); return this; },
  };
  const transaction = {
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };

  t.mock.method(EstoqueRoupa, 'findAll', async () => [roupa]);
  t.mock.method(NuvemshopProdutoVinculo, 'findAll', async () => [mapping]);
  t.mock.method(EstoqueRoupaVariacao, 'findByPk', async () => null);
  t.mock.method(EstoqueRoupaVariacao, 'create', async () => assert.fail('a substituição não pode criar uma segunda variação'));
  t.mock.method(NuvemshopProdutoVinculo, 'create', async () => assert.fail('a substituição deve atualizar o vínculo anterior'));
  t.mock.method(EstoqueRoupaMovimento, 'create', async () => assert.fail('trocar a descrição não movimenta estoque'));
  t.mock.method(EstoqueRoupaFoto, 'findAll', async () => []);
  t.mock.method(sequelize, 'transaction', async () => transaction);

  const summary = await nuvemshopCatalogSyncService.pullProducts({
    integration: { id: 5, empresa_id: 7 },
    products: [{
      id: 220,
      name: { pt: 'Camisa copiada' },
      handle: { pt: 'camisa-copiada' },
      attributes: [{ pt: 'Tamanho' }, { pt: 'Cor' }],
      images: [],
      variants: [{ id: 331, values: [{ pt: 'G' }, { pt: 'Azul' }], stock_management: true, stock: 3, price: 100 }],
    }],
  });

  assert.equal(transaction.finished, 'commit');
  assert.equal(summary.variantsCreated, 0);
  assert.equal(roupa.variacoes.length, 1);
  assert.equal(variacao.id, 41);
  assert.equal(variacao.tamanho, 'G');
  assert.equal(variacao.cor, 'Azul');
  assert.equal(mapping.nuvemshop_variant_id, 331);
  assert.equal(mapping.variacao_id, 41);
});

test('sincronização zera o saldo da grade antiga para não dobrar o total da grade nova', async t => {
  const movimentos = [];
  const gradeAntiga = {
    id: 51, roupa_id: 29, tamanho: 'M', cor: null,
    quantidade_atual: 9, quantidade_minima: 0, estoque_infinito: false,
    async update(data) { Object.assign(this, data); return this; },
  };
  const gradeNova = {
    id: 52, roupa_id: 29, tamanho: 'M', cor: 'Preto',
    quantidade_atual: 9, quantidade_minima: 0, estoque_infinito: false,
    async update(data) { Object.assign(this, data); return this; },
  };
  const roupa = {
    id: 29, empresa_id: 7, nome: 'Polo', codigo: 'NS-polo',
    observacao: 'Origem Nuvemshop: polo', variacoes: [gradeAntiga, gradeNova],
    async update(data) { Object.assign(this, data); return this; },
  };
  const antigo = {
    id: 101, roupa_id: 29, variacao_id: 51,
    nuvemshop_product_id: 400, nuvemshop_variant_id: 500,
    async update(data) { Object.assign(this, data); return this; },
  };
  const novo = {
    id: 102, roupa_id: 29, variacao_id: 52,
    nuvemshop_product_id: 400, nuvemshop_variant_id: 501,
    async update(data) { Object.assign(this, data); return this; },
  };
  const transaction = {
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };

  t.mock.method(EstoqueRoupa, 'findAll', async () => [roupa]);
  t.mock.method(NuvemshopProdutoVinculo, 'findAll', async () => [antigo, novo]);
  t.mock.method(EstoqueRoupaVariacao, 'findByPk', async id => Number(id) === 52 ? gradeNova : gradeAntiga);
  t.mock.method(EstoqueRoupaVariacao, 'create', async () => assert.fail('não deve criar outra variação'));
  t.mock.method(NuvemshopProdutoVinculo, 'create', async () => assert.fail('não deve criar outro vínculo'));
  t.mock.method(EstoqueRoupaMovimento, 'create', async data => { movimentos.push(data); return data; });
  t.mock.method(EstoqueRoupaFoto, 'findAll', async () => []);
  t.mock.method(sequelize, 'transaction', async () => transaction);

  const summary = await nuvemshopCatalogSyncService.pullProducts({
    integration: { id: 5, empresa_id: 7 },
    products: [{
      id: 400,
      name: { pt: 'Polo' },
      handle: { pt: 'polo' },
      attributes: [{ pt: 'Tamanho' }, { pt: 'Cor' }],
      images: [],
      variants: [
        { id: 500, values: [{ pt: 'M' }], stock_management: true, stock: 9, price: 100 },
        { id: 501, values: [{ pt: 'M' }, { pt: 'Preto' }], stock_management: true, stock: 9, price: 100 },
      ],
    }],
  });

  assert.equal(transaction.finished, 'commit');
  assert.equal(gradeAntiga.quantidade_atual, 0);
  assert.equal(gradeNova.quantidade_atual, 9);
  assert.equal(summary.supersededVariantsReset, 1);
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].quantidade, 9);
  assert.equal(movimentos[0].motivo, 'Substituição de grade Nuvemshop');
});

test('exclusão remota elimina cada produto vinculado uma única vez', () => {
  assert.deepEqual(uniqueRemoteProductIds([
    { nuvemshop_product_id: '100' },
    { nuvemshop_product_id: 100 },
    { nuvemshop_product_id: '200' },
    { nuvemshop_product_id: null },
  ]), [100, 200]);
});

test('escopos OAuth aceitam separação por espaço ou vírgula', () => {
  assert.deepEqual(scopeList({ scopes: 'read_products,write_products read_orders' }), [
    'read_products', 'write_products', 'read_orders',
  ]);
});

test('state OAuth é assinado, expira e preserva somente a empresa selecionada', () => withEnv({
  JWT_SECRET: 'segredo-de-teste-nuvemshop',
}, () => {
  const state = createOauthState(8104359);
  assert.equal(verifyOauthState(state), 8104359);
  assert.throws(() => verifyOauthState(`${state}alterado`), /expirou ou é inválida/);
}));

test('assinatura HMAC valida exatamente o corpo bruto do webhook', () => withEnv({
  NUVEMSHOP_CLIENT_SECRET: 'client-secret-de-teste',
}, () => {
  const body = Buffer.from('{"store_id":8104359}');
  const signature = crypto.createHmac('sha256', 'client-secret-de-teste').update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body, signature), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"store_id":1}'), signature), false);
  assert.equal(verifyWebhookSignature(body, ''), false);
}));

test('escopo usa override do MASTER e limita configuração a gestores', () => {
  assert.equal(resolveEmpresaId({ tipo: 'MASTER', empresa_id: 1, empresa_id_override: 42 }), 42);
  assert.equal(resolveEmpresaId({ tipo: 'EMPRESA', empresa_id: 7 }), 7);
  assert.throws(() => resolveEmpresaId({ tipo: 'MASTER' }), /Selecione uma empresa/);
  assert.equal(canManageIntegration({ tipo: 'EMPRESA' }), true);
  assert.equal(canManageIntegration({ tipo: 'USUARIO', cargo: 'Gerente' }), true);
  assert.equal(canManageIntegration({ tipo: 'USUARIO', cargo: 'Vendedor' }), false);
});
