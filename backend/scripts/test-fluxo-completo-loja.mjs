import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import sequelize from '../src/config/database.js';
import User from '../src/models/UserModel.js';
import Product from '../src/models/Product.js';
import Movimento from '../src/models/Movimento.js';
import Venda from '../src/models/Venda.js';
import VendaItem from '../src/models/VendaItem.js';
import Cliente from '../src/models/Cliente.js';
import Saida from '../src/models/Saida.js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
let AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'local-demo-token';
const RUN_ID = `${Date.now()}-${process.pid}`;
const PREFIX = `TESTE-FLUXO-${RUN_ID}`;
const SLUG = process.env.TEST_STORE_SLUG || 'saude-e-vida';
const customerEmail = `teste.fluxo.${RUN_ID}@example.invalid`;
const customerPassword = 'TesteFluxo123!';

function unwrap(body) {
  return body?.success === true && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

function number(value) {
  return Number(value);
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.auth === false ? {} : { Authorization: `Bearer ${AUTH_TOKEN}` }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, data: unwrap(body) };
}

function check(condition, message) {
  assert.equal(Boolean(condition), true, message);
}

async function expectStatus(result, expected, context) {
  if (result.response.status !== expected) {
    throw new Error(`${context}: esperado HTTP ${expected}, recebido ${result.response.status}: ${JSON.stringify(result.body).slice(0, 500)}`);
  }
}

async function productStock(productId) {
  const result = await request(`/api/products/${productId}`);
  if (result.response.status === 404) {
    const products = await request('/api/products');
    const list = Array.isArray(products.data) ? products.data : [];
    return list.find((item) => Number(item.id) === Number(productId))?.currentQuantity;
  }
  return result.data?.currentQuantity;
}

async function cleanup({ saleId, productId, customerId, outgoingId, userId }) {
  if (saleId) {
    await request(`/api/vendas/${saleId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (outgoingId) {
    await request(`/api/financeiro/saidas/${outgoingId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (productId) {
    await request(`/api/products/${productId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (customerId) {
    await request(`/api/clientes/${customerId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (userId) {
    await User.destroy({ where: { id: userId } }).catch(() => {});
  }
}

async function main() {
  if (process.env.RUN_FLUXO_COMPLETO_TESTS !== '1') {
    throw new Error('Defina RUN_FLUXO_COMPLETO_TESTS=1 para executar este teste destrutivo controlado.');
  }
  const databaseUrl = String(process.env.DATABASE_URL || '');
  if (/neon\.tech|supabase|amazonaws/i.test(databaseUrl) && process.env.ALLOW_REMOTE_INTEGRATION_TEST !== '1') {
    throw new Error('O banco configurado parece remoto. Defina ALLOW_REMOTE_INTEGRATION_TEST=1 para autorizar o cenário isolado.');
  }

  let productId;
  let saleId;
  let customerId;
  let outgoingId;
  let testUserId;
  try {
    const testUser = await User.create({
      nomeCompleto: `${PREFIX} Usuário`,
      cargo: 'Teste automatizado',
      email: `teste.usuario.${RUN_ID}@example.invalid`,
      senha: 'teste-interno-sem-login',
      tipo: 'USUARIO',
      status: 'ativo',
      permissoes: [],
      empresa_id: 1,
    });
    testUserId = Number(testUser.id);
    AUTH_TOKEN = jwt.sign({ id: testUserId }, process.env.JWT_SECRET, { expiresIn: '10m' });

    const productCreated = await request('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: `${PREFIX} Produto`,
        code: `${PREFIX}-PROD`,
        category: 'Teste automatizado',
        price: 20,
        preco_compra: 10,
        currentQuantity: 10,
        minQuantity: 1,
        unidade_medida: 'UN',
        unidade_comercial: 'UN',
        unidade_tributavel: 'UN',
        fornecedor_id: null,
      }),
    });
    await expectStatus(productCreated, 201, 'criação do produto de teste');
    productId = Number(productCreated.data?.id);
    check(productId > 0, 'produto de teste sem id');
    check(number(productCreated.data.currentQuantity) === 10, 'estoque inicial do produto deveria ser 10');

    const initialMovement = await Movimento.findOne({
      where: { produto_id: productId, origem_tipo: 'produto_cadastro' },
      order: [['id', 'DESC']],
    });
    check(initialMovement && initialMovement.tipo === 'entrada' && number(initialMovement.quantidade) === 10, 'entrada inicial não foi registrada');

    const storeConfig = await request(`/api/loja/configuracao/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ ativo: true, preco: 20, categoria: 'Teste', secoes: ['destaques'], ordem: 0, descricao: `${PREFIX} na loja` }),
    });
    await expectStatus(storeConfig, 200, 'publicação do produto na loja');

    const customerCreated = await request(`/api/loja/public/${SLUG}/clientes/cadastro`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        nome: `${PREFIX} Cliente`,
        telefone: '84999990000',
        email: customerEmail,
        senha: customerPassword,
      }),
    });
    await expectStatus(customerCreated, 201, 'cadastro do cliente pela lojinha');
    customerId = Number(customerCreated.data?.cliente?.id);
    check(customerId > 0, 'cadastro da lojinha não retornou cliente');
    check(customerCreated.data?.tipo === 'CLIENTE_LOJA', 'cadastro da lojinha não criou sessão de cliente');

    const customerMe = await request(`/api/loja/public/${SLUG}/clientes/me`, {
      auth: false,
      headers: { Authorization: `Bearer ${customerCreated.data.token}` },
    });
    await expectStatus(customerMe, 200, 'consulta da conta do cliente na lojinha');
    check(Number(customerMe.data?.cliente?.id) === customerId, 'a sessão da lojinha não identificou o cliente criado');

    const customerSystem = await request(`/api/clientes/${customerId}`);
    await expectStatus(customerSystem, 200, 'vínculo do cliente da loja no sistema');
    check(Number(customerSystem.data?.id) === customerId, 'cliente da lojinha não apareceu no cadastro do sistema');
    check(customerSystem.data?.email === customerEmail, 'e-mail do cliente da loja não foi persistido');

    const saleCreated = await request(`/api/loja/public/${SLUG}/pedidos`, {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${customerCreated.data.token}` },
      body: JSON.stringify({
        nome: `${PREFIX} Cliente`,
        telefone: '84999990000',
        forma_pagamento: 'pix',
        itens: [{ produto_id: productId, quantidade: 2 }],
      }),
    });
    await expectStatus(saleCreated, 201, 'venda pela lojinha');
    saleId = Number(saleCreated.data?.pedido);
    check(saleId > 0, 'pedido da lojinha não retornou id de venda');

    const afterStoreSale = await Product.findByPk(productId);
    check(number(afterStoreSale?.currentQuantity) === 8, 'a venda da lojinha não baixou 2 unidades do estoque');
    const saleMovement = await Movimento.findOne({ where: { produto_id: productId, origem_tipo: 'venda', origem_id: saleId } });
    check(saleMovement && saleMovement.tipo === 'saida' && number(saleMovement.quantidade) === 2, 'a saída de estoque da venda não foi vinculada à venda');

    const statusUpdate = await request(`/api/loja/pedidos/${saleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'separando' }),
    });
    await expectStatus(statusUpdate, 200, 'alteração de status do pedido');
    check(statusUpdate.data?.status_loja === 'separando', 'status do pedido não foi atualizado');
    check(Array.isArray(statusUpdate.data?.status_loja_historico) && statusUpdate.data.status_loja_historico.some((item) => item.status === 'separando'), 'histórico de status não foi registrado');

    const entradas = await request('/api/financeiro/entradas');
    await expectStatus(entradas, 200, 'consulta de entradas financeiras');
    const entradaVenda = (Array.isArray(entradas.data) ? entradas.data : []).find((item) => item.origem === 'Venda/Caixa' && Number(item.id) === saleId);
    check(entradaVenda && number(entradaVenda.valor) === 40, 'a venda não apareceu como entrada financeira');

    const outgoingCreated = await request('/api/financeiro/saidas', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'Teste', descricao: `${PREFIX} Saída financeira`, data: new Date().toISOString(), valor: 12.34, natureza: 'SAIDA' }),
    });
    await expectStatus(outgoingCreated, 201, 'criação de saída financeira');
    outgoingId = Number(outgoingCreated.data?.id);
    check(outgoingId > 0 && outgoingCreated.data?.status === 'pendente', 'saída financeira não foi criada como pendente');

    const outgoingPaid = await request(`/api/saidas/${outgoingId}/pagar`, { method: 'PATCH' });
    await expectStatus(outgoingPaid, 200, 'baixa da saída financeira');
    check(outgoingPaid.data?.status === 'pago', 'saída financeira não foi marcada como paga');
    const consolidatedOutgoings = await request('/api/financeiro/saidas-consolidado');
    await expectStatus(consolidatedOutgoings, 200, 'consulta de saídas financeiras consolidadas');
    check((Array.isArray(consolidatedOutgoings.data) ? consolidatedOutgoings.data : []).some((item) => Number(item.id) === outgoingId), 'saída financeira paga não apareceu no consolidado');

    const saleEdited = await request(`/api/vendas/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify({
        cliente_id: customerId,
        empresa_id: 1,
        forma_pagamento: 'pix',
        valor_total: '60.00',
        itens: [{ produto_id: productId, quantidade: 3, valor_unitario: 20, valor_total: 60 }],
      }),
    });
    await expectStatus(saleEdited, 200, 'edição da venda');
    const afterEdit = await Product.findByPk(productId);
    check(number(afterEdit?.currentQuantity) === 7, 'a edição da venda não recalculou o estoque para 7');
    const editedMovements = await Movimento.findAll({ where: { produto_id: productId, origem_tipo: 'venda', origem_id: saleId } });
    check(editedMovements.length === 1 && number(editedMovements[0].quantidade) === 3, 'a edição não substituiu corretamente o movimento vinculado à venda');
    check(number(saleEdited.data?.valor_total) === 60, 'o total da venda não foi atualizado para 60');

    const saleDeleted = await request(`/api/vendas/${saleId}`, { method: 'DELETE' });
    await expectStatus(saleDeleted, 204, 'exclusão da venda');
    const afterDelete = await Product.findByPk(productId);
    check(number(afterDelete?.currentQuantity) === 10, 'a exclusão da venda não devolveu as 3 unidades ao estoque');
    const cancellationMovement = await Movimento.findOne({ where: { produto_id: productId, origem_tipo: 'venda_cancelada', origem_id: saleId }, order: [['id', 'DESC']] });
    check(cancellationMovement && cancellationMovement.tipo === 'entrada' && number(cancellationMovement.quantidade) === 3, 'a exclusão não registrou a entrada de cancelamento vinculada à venda');
    const deletedSale = await Venda.findByPk(saleId);
    const deletedItems = await VendaItem.count({ where: { venda_id: saleId } });
    check(!deletedSale && deletedItems === 0, 'a exclusão não removeu a venda e seus itens');

    console.log(JSON.stringify({
      ok: true,
      prefix: PREFIX,
      checks: [
        'produto criado com entrada inicial de estoque',
        'cliente criado pela lojinha e localizado no sistema',
        'pedido da lojinha virou venda e baixou estoque',
        'status do pedido e histórico atualizados',
        'venda apareceu em entradas financeiras',
        'saída financeira criada, paga e consolidada',
        'edição da venda recalculou estoque e movimento',
        'exclusão da venda devolveu estoque e registrou cancelamento',
      ],
    }, null, 2));
  } finally {
    await cleanup({ saleId, productId, customerId, outgoingId, userId: testUserId });
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
