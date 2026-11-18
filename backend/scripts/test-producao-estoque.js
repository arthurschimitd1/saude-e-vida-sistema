import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { Op } from 'sequelize';

dotenv.config();

let app;
let sequelize;
let Product;
let Receita;
let ReceitaItem;
let OrdemProducao;
let Movimento;

const ENABLE_FLAG = 'RUN_PRODUCAO_ESTOQUE_TESTS';
const prefix = `[TESTE-PRODUCAO-${Date.now()}]`;
const created = {
  produtos: new Set(),
  receitas: new Set(),
  ordens: new Set(),
};

let server;
let baseUrl;
let token;
let empresaId;
let passed = 0;

function number(value) {
  return Number(value ?? 0);
}

function closeTo(actual, expected, message) {
  assert.ok(
    Math.abs(number(actual) - number(expected)) < 0.0001,
    `${message}: esperado ${expected}, recebido ${actual}`,
  );
}

function ok(label) {
  passed += 1;
  console.log(`  OK  ${label}`);
}

function databaseIsRemote() {
  if (process.env.DATABASE_URL) {
    try {
      const { hostname } = new URL(process.env.DATABASE_URL);
      return !['localhost', '127.0.0.1', '::1'].includes(hostname);
    } catch {
      return true;
    }
  }
  return !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost');
}

async function loadApplication() {
  [
    { default: app },
    { default: sequelize },
    { default: Product },
    { default: Receita },
    { default: ReceitaItem },
    { default: OrdemProducao },
    { default: Movimento },
  ] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/database.js'),
    import('../src/models/Product.js'),
    import('../src/models/Receita.js'),
    import('../src/models/ReceitaItem.js'),
    import('../src/models/OrdemProducao.js'),
    import('../src/models/Movimento.js'),
  ]);
}

async function request(path, { method = 'GET', body, auth = true, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    expectedStatuses.includes(response.status),
    `${method} ${path}: esperado HTTP ${expectedStatuses.join('/')}, recebido ${response.status}. Resposta: ${text}`,
  );

  return data;
}

async function getProduct(id) {
  const product = await Product.findByPk(id);
  assert.ok(product, `Produto ${id} deveria existir`);
  return product;
}

async function getOrder(id) {
  const order = await OrdemProducao.findByPk(id);
  assert.ok(order, `Ordem ${id} deveria existir`);
  return order;
}

async function movements(productId) {
  return request(`/api/movimentos?produto_id=${productId}`);
}

async function cleanup() {
  const transaction = await sequelize.transaction();
  try {
    const productsByPrefix = await Product.findAll({
      where: { name: { [Op.like]: `${prefix}%` }, empresa_id: empresaId },
      attributes: ['id'],
      transaction,
    });
    const productIds = [...new Set([
      ...created.produtos,
      ...productsByPrefix.map((item) => item.id),
    ])];

    const recipesByPrefix = await Receita.findAll({
      where: { nome: { [Op.like]: `${prefix}%` }, empresa_id: empresaId },
      attributes: ['id'],
      transaction,
    });
    const recipeIds = [...new Set([
      ...created.receitas,
      ...recipesByPrefix.map((item) => item.id),
    ])];

    const orderWhere = [];
    if (created.ordens.size) orderWhere.push({ id: { [Op.in]: [...created.ordens] } });
    if (recipeIds.length) orderWhere.push({ receita_id: { [Op.in]: recipeIds } });

    if (productIds.length) {
      await Movimento.destroy({
        where: { produto_id: { [Op.in]: productIds }, empresa_id: empresaId },
        transaction,
      });
    }
    if (orderWhere.length) {
      await OrdemProducao.destroy({ where: { [Op.or]: orderWhere }, transaction });
    }
    if (recipeIds.length) {
      await ReceitaItem.destroy({ where: { receita_id: { [Op.in]: recipeIds } }, transaction });
      await Receita.destroy({ where: { id: { [Op.in]: recipeIds } }, transaction });
    }
    if (productIds.length) {
      await Product.destroy({
        where: { id: { [Op.in]: productIds }, empresa_id: empresaId },
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function main() {
  if (process.env[ENABLE_FLAG] !== '1') {
    throw new Error(
      `Execução bloqueada. Use ${ENABLE_FLAG}=1 npm run test:producao-estoque para confirmar o teste de integração.`,
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_INTEGRATION_TEST !== '1') {
    throw new Error('Teste recusado em NODE_ENV=production. Use um banco de desenvolvimento/homologação.');
  }
  if (databaseIsRemote() && process.env.ALLOW_REMOTE_INTEGRATION_TEST !== '1') {
    throw new Error(
      'Teste recusado em banco remoto. Use um banco local ou confirme homologação com ALLOW_REMOTE_INTEGRATION_TEST=1.',
    );
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado.');
  }
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    throw new Error('Defina TEST_USER_EMAIL e TEST_USER_PASSWORD para usar exclusivamente a conta de teste.');
  }

  await loadApplication();
  await sequelize.authenticate();

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const credentials = {
    email: process.env.TEST_USER_EMAIL,
    senha: process.env.TEST_USER_PASSWORD,
  };
  let login = await request('/api/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  });
  if (login.multiEmpresa) {
    const selectedCompany = Number(process.env.TEST_EMPRESA_ID);
    if (!selectedCompany || !login.empresas.some((item) => Number(item.empresa_id) === selectedCompany)) {
      throw new Error(
        `A conta possui mais de uma empresa. Defina TEST_EMPRESA_ID com uma destas opções: ${login.empresas.map((item) => item.empresa_id).join(', ')}.`,
      );
    }
    login = await request('/api/auth/login', {
      method: 'POST',
      body: { ...credentials, empresa_id: selectedCompany },
      auth: false,
    });
  }
  assert.equal(login.user?.email, process.env.TEST_USER_EMAIL);
  assert.ok(login.token, 'Login deveria retornar token');
  assert.ok(login.user?.empresa_id, 'Conta de teste precisa estar vinculada a uma empresa');
  token = login.token;
  empresaId = Number(login.user.empresa_id);

  console.log(`\nTeste Produção + Estoque (${prefix})`);
  console.log(`Empresa de teste: ${empresaId}\n`);

  await request('/api/products', { auth: false, expected: 401 });
  ok('rotas protegidas por autenticação');

  await request('/api/producao/receitas', {
    method: 'POST',
    body: { descricao: 'sem nome' },
    expected: 400,
  });
  ok('receita sem nome é rejeitada');

  const ingredient = await request('/api/products', {
    method: 'POST',
    expected: 201,
    body: {
      name: `${prefix} Farinha`,
      code: `${prefix}-MP`,
      category: 'Teste automatizado',
      price: 4.2,
      preco_compra: 4.2,
      currentQuantity: 20,
      minQuantity: 2,
      unidade_medida: 'KG',
      unidade_comercial: 'KG',
      unidade_tributavel: 'KG',
      is_materia_prima: true,
    },
  });
  created.produtos.add(ingredient.id);
  assert.equal(Number(ingredient.empresa_id), empresaId);
  closeTo(ingredient.currentQuantity, 20, 'Estoque inicial da matéria-prima');
  ok('matéria-prima criada no estoque e vinculada à empresa');

  const ingredientList = await request('/api/products?is_materia_prima=true');
  assert.ok(ingredientList.some((item) => item.id === ingredient.id));
  const initialMovements = await movements(ingredient.id);
  assert.ok(initialMovements.some((item) =>
    item.tipo === 'entrada'
    && item.motivo === 'Cadastro inicial'
    && number(item.quantidade) === 20
    && Number(item.empresa_id) === empresaId));
  ok('filtro de matérias-primas e movimento de entrada inicial');

  const recipe = await request('/api/producao/receitas', {
    method: 'POST',
    expected: 201,
    body: {
      nome: `${prefix} Produto final`,
      descricao: 'Receita criada pelo teste automatizado',
      valor_unitario: 15.5,
      unidade_medida: 'UN',
      is_materia_prima: true,
      itens: [{ produto_id: ingredient.id, quantidade: 2.5 }],
    },
  });
  created.receitas.add(recipe.id);
  created.produtos.add(recipe.produto_id);
  assert.equal(Number(recipe.empresa_id), empresaId);
  assert.equal(recipe.itens.length, 1);
  assert.equal(recipe.itens[0].produto_id, ingredient.id);
  assert.equal(recipe.produto.unidade_medida, 'UN');
  assert.equal(recipe.produto.is_materia_prima, true);
  closeTo(recipe.produto.price, 15.5, 'Preço inicial do produto final');
  ok('receita cria produto final com preço, unidade e configuração corretos');

  const updatedRecipe = await request(`/api/producao/receitas/${recipe.id}`, {
    method: 'PUT',
    body: {
      nome: `${prefix} Produto final atualizado`,
      descricao: 'Receita atualizada pelo teste automatizado',
      valor_unitario: 18.75,
      unidade_medida: 'CX',
      is_materia_prima: false,
      itens: [{ produto_id: ingredient.id, quantidade: 2.5 }],
    },
  });
  assert.equal(updatedRecipe.produto.name, `${prefix} Produto final atualizado`);
  assert.equal(updatedRecipe.produto.unidade_medida, 'CX');
  assert.equal(updatedRecipe.produto.is_materia_prima, false);
  closeTo(updatedRecipe.produto.price, 18.75, 'Preço atualizado do produto final');
  ok('edição da receita sincroniza o produto final');

  await request('/api/producao/ordens', {
    method: 'POST',
    body: { receita_id: recipe.id, quantidade: 0 },
    expected: 400,
  });
  ok('ordem com quantidade inválida é rejeitada');

  const completedOrder = await request('/api/producao/ordens', {
    method: 'POST',
    expected: 201,
    body: { receita_id: recipe.id, quantidade: 2, observacao: 'ordem com desperdício' },
  });
  created.ordens.add(completedOrder.id);
  assert.equal(completedOrder.status, 'pendente');
  assert.equal(Number(completedOrder.empresa_id), empresaId);
  ok('ordem pendente criada');

  await request(`/api/producao/ordens/${completedOrder.id}/concluir`, {
    method: 'POST',
    body: { itens: [{ produto_id: ingredient.id, quantidade_real: 6 }] },
  });

  let ingredientAfter = await getProduct(ingredient.id);
  let finalAfter = await getProduct(recipe.produto_id);
  let completedAfter = await getOrder(completedOrder.id);
  closeTo(ingredientAfter.currentQuantity, 14, 'Baixa real da matéria-prima');
  closeTo(finalAfter.currentQuantity, 2, 'Entrada do produto final');
  assert.equal(completedAfter.status, 'concluida');

  const ingredientProductionMovements = (await movements(ingredient.id))
    .filter((item) => Number(item.origem_id) === completedOrder.id && item.origem_tipo === 'producao');
  assert.ok(ingredientProductionMovements.some((item) =>
    item.tipo === 'saida'
    && item.motivo.startsWith('Produção')
    && number(item.quantidade) === 5));
  assert.ok(ingredientProductionMovements.some((item) =>
    item.tipo === 'saida'
    && item.motivo.startsWith('Desperdício')
    && number(item.quantidade) === 1));
  const finalMovements = await movements(recipe.produto_id);
  assert.ok(finalMovements.some((item) =>
    item.tipo === 'entrada'
    && Number(item.origem_id) === completedOrder.id
    && number(item.quantidade) === 2));
  ok('conclusão baixa consumo real, separa desperdício e dá entrada no produto final');

  await request(`/api/producao/ordens/${completedOrder.id}/concluir`, {
    method: 'POST',
    body: {},
    expected: 400,
  });
  ingredientAfter = await getProduct(ingredient.id);
  finalAfter = await getProduct(recipe.produto_id);
  closeTo(ingredientAfter.currentQuantity, 14, 'Estoque após conclusão duplicada');
  closeTo(finalAfter.currentQuantity, 2, 'Produto final após conclusão duplicada');
  ok('conclusão duplicada é bloqueada sem alterar estoque');

  const insufficientOrder = await request('/api/producao/ordens', {
    method: 'POST',
    expected: 201,
    body: { receita_id: recipe.id, quantidade: 10, observacao: 'ordem sem estoque' },
  });
  created.ordens.add(insufficientOrder.id);
  const movementsBeforeFailure = (await movements(ingredient.id)).length;
  await request(`/api/producao/ordens/${insufficientOrder.id}/concluir`, {
    method: 'POST',
    body: {},
    expected: 400,
  });
  ingredientAfter = await getProduct(ingredient.id);
  finalAfter = await getProduct(recipe.produto_id);
  const insufficientAfter = await getOrder(insufficientOrder.id);
  closeTo(ingredientAfter.currentQuantity, 14, 'Matéria-prima após falha por estoque');
  closeTo(finalAfter.currentQuantity, 2, 'Produto final após falha por estoque');
  assert.equal(insufficientAfter.status, 'pendente');
  assert.equal((await movements(ingredient.id)).length, movementsBeforeFailure);
  ok('estoque insuficiente executa rollback integral');

  await request(`/api/producao/ordens/${insufficientOrder.id}/cancelar`, { method: 'POST' });
  assert.equal((await getOrder(insufficientOrder.id)).status, 'cancelada');
  await request(`/api/producao/ordens/${insufficientOrder.id}/cancelar`, {
    method: 'POST',
    expected: 400,
  });
  ok('cancelamento funciona e não pode ser repetido');

  const pendingOrder = await request('/api/producao/ordens', {
    method: 'POST',
    expected: 201,
    body: { receita_id: recipe.id, quantidade: 1, observacao: 'ordem cancelada' },
  });
  created.ordens.add(pendingOrder.id);
  await request(`/api/producao/ordens/${pendingOrder.id}/cancelar`, { method: 'POST' });
  ingredientAfter = await getProduct(ingredient.id);
  finalAfter = await getProduct(recipe.produto_id);
  closeTo(ingredientAfter.currentQuantity, 14, 'Matéria-prima após cancelamento');
  closeTo(finalAfter.currentQuantity, 2, 'Produto final após cancelamento');
  ok('cancelar ordem pendente não movimenta estoque');

  const orders = await request('/api/producao/ordens');
  const recipeOrders = await request(`/api/producao/ordens/por-receita/${recipe.id}`);
  for (const id of [completedOrder.id, insufficientOrder.id, pendingOrder.id]) {
    assert.ok(orders.some((item) => item.id === id));
    assert.ok(recipeOrders.some((item) => item.id === id));
  }
  assert.ok(orders.filter((item) => created.ordens.has(item.id)).every((item) => Number(item.empresa_id) === empresaId));
  ok('listagens geral e por receita refletem todos os estados');

  await request(`/api/producao/receitas/${recipe.id}`, { method: 'DELETE' });
  const recipesAfterDelete = await request('/api/producao/receitas');
  assert.ok(!recipesAfterDelete.some((item) => item.id === recipe.id));
  for (const id of created.ordens) {
    assert.equal((await getOrder(id)).receita_id, null);
  }
  ok('exclusão da receita preserva histórico das ordens');

  console.log(`\n${passed} verificações concluídas com sucesso.`);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`\nFALHA: ${error.stack || error.message}`);
} finally {
  try {
    if (empresaId) {
      await cleanup();
      console.log('Dados temporários removidos.');
    }
  } catch (cleanupError) {
    exitCode = 1;
    console.error(`Falha na limpeza: ${cleanupError.stack || cleanupError.message}`);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (sequelize) {
    await sequelize.close();
  }
}

process.exitCode = exitCode;
