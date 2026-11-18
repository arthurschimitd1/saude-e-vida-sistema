import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { Op } from 'sequelize';

dotenv.config();

const ENABLE_FLAG = 'RUN_ESTOQUE_COMPLETO_TESTS';
const runId = `${Date.now()}-${process.pid}`;
const prefix = `[TESTE-ESTOQUE-${runId}]`;
const codePrefix = `TESTE-ESTOQUE-${runId}`;

let app;
let sequelize;
let Product;
let Movimento;
let Inventario;
let server;
let baseUrl;
let token;
let empresaId;
let passed = 0;

const createdProductIds = new Set();

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
    { default: Movimento },
    { default: Inventario },
  ] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/database.js'),
    import('../src/models/Product.js'),
    import('../src/models/Movimento.js'),
    import('../src/models/Inventario.js'),
  ]);
}

async function request(path, {
  method = 'GET',
  body,
  auth = true,
  expected = 200,
} = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  const statuses = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    statuses.includes(response.status),
    `${method} ${path}: esperado HTTP ${statuses.join('/')}, recebido ${response.status}. Resposta: ${raw}`,
  );

  return data;
}

async function createProduct(data) {
  const product = await request('/api/products', {
    method: 'POST',
    expected: 201,
    body: data,
  });
  createdProductIds.add(Number(product.id));
  assert.equal(Number(product.empresa_id), empresaId, `Produto ${product.id} fora da empresa de teste`);
  return product;
}

async function products() {
  return request('/api/products');
}

async function productById(id) {
  const list = await products();
  const product = list.find((item) => Number(item.id) === Number(id));
  assert.ok(product, `Produto ${id} deveria aparecer na listagem atualizada`);
  return product;
}

async function movements(productId) {
  return request(`/api/movimentos?produto_id=${productId}`);
}

async function assertStock(id, expected, message) {
  const product = await productById(id);
  closeTo(product.currentQuantity, expected, message);
  return product;
}

async function assertFrontendContracts() {
  const sourceUrl = new URL(
    '../../frontend/app/(main)/uikit/formlayout/page.tsx',
    import.meta.url,
  );
  const source = await readFile(sourceUrl, 'utf8');

  const contracts = [
    ['sugestões de produtos semelhantes', 'sugestoesProdutosMesmoNome'],
    ['busca tolerante a acentos', 'normalizarBuscaProduto'],
    ['alerta de granel duplicado', 'Produto a granel já cadastrado'],
    ['nome editável do produto a granel', 'granelNome'],
    ['preço adaptado à unidade de medida', 'granelUnidadeAbreviada'],
    ['bloqueio visual de caixas insuficientes', 'transCaixasExcedeEstoque'],
    ['sincronização automática após operações', 'sincronizarEstoque'],
    ['fornecedor apresentado como opcional', 'Fornecedor <span className="text-color-secondary font-normal">(opcional)</span>'],
  ];

  for (const [label, marker] of contracts) {
    assert.ok(source.includes(marker), `Contrato visual ausente: ${label}`);
  }
  ok('contratos visuais das alterações de hoje presentes no frontend');
}

async function cleanup() {
  const transaction = await sequelize.transaction();
  try {
    const prefixedProducts = await Product.findAll({
      where: {
        empresa_id: empresaId,
        [Op.or]: [
          { name: { [Op.like]: `${prefix}%` } },
          { code: { [Op.like]: `${codePrefix}%` } },
        ],
      },
      attributes: ['id'],
      transaction,
    });

    const ids = [...new Set([
      ...createdProductIds,
      ...prefixedProducts.map((item) => Number(item.id)),
    ])].filter(Number.isInteger);

    if (ids.length) {
      await Inventario.destroy({
        where: { produto_id: { [Op.in]: ids }, empresa_id: empresaId },
        transaction,
      });
      await Movimento.destroy({
        where: { produto_id: { [Op.in]: ids }, empresa_id: empresaId },
        transaction,
      });
      await Product.destroy({
        where: { id: { [Op.in]: ids }, empresa_id: empresaId },
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function login() {
  const credentials = {
    email: process.env.TEST_USER_EMAIL,
    senha: process.env.TEST_USER_PASSWORD,
  };
  let result = await request('/api/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  });

  if (result.multiEmpresa) {
    const selectedCompany = Number(process.env.TEST_EMPRESA_ID);
    const available = result.empresas.map((item) => Number(item.empresa_id));
    if (!selectedCompany || !available.includes(selectedCompany)) {
      throw new Error(
        `A conta possui mais de uma empresa. Defina TEST_EMPRESA_ID com uma destas opções: ${available.join(', ')}.`,
      );
    }
    result = await request('/api/auth/login', {
      method: 'POST',
      body: { ...credentials, empresa_id: selectedCompany },
      auth: false,
    });
  }

  assert.equal(result.user?.email, process.env.TEST_USER_EMAIL);
  assert.ok(result.token, 'Login deveria retornar token');
  assert.ok(result.user?.empresa_id, 'Conta de teste precisa estar vinculada a uma empresa');
  token = result.token;
  empresaId = Number(result.user.empresa_id);
}

async function main() {
  if (process.env[ENABLE_FLAG] !== '1') {
    throw new Error(
      `Execução bloqueada. Use ${ENABLE_FLAG}=1 npm run test:estoque-completo para confirmar.`,
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_INTEGRATION_TEST !== '1') {
    throw new Error('Teste recusado em NODE_ENV=production.');
  }
  if (databaseIsRemote() && process.env.ALLOW_REMOTE_INTEGRATION_TEST !== '1') {
    throw new Error(
      'Teste recusado em banco remoto. Confirme o ambiente de teste com ALLOW_REMOTE_INTEGRATION_TEST=1.',
    );
  }
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    throw new Error('Defina TEST_USER_EMAIL e TEST_USER_PASSWORD para a conta exclusiva de teste.');
  }

  await loadApplication();
  await sequelize.authenticate();
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await login();

  console.log(`\nTeste completo da aba Estoque (${prefix})`);
  console.log(`Conta: ${process.env.TEST_USER_EMAIL}`);
  console.log(`Empresa de teste: ${empresaId}\n`);

  await request('/api/products', { auth: false, expected: 401 });
  ok('rotas de estoque protegidas por autenticação');

  await assertFrontendContracts();

  const source = await createProduct({
    name: `${prefix} Balde 3L`,
    code: `${codePrefix}-ORIGEM`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 45,
    preco_compra: 24,
    currentQuantity: 5,
    minQuantity: 1,
    unidade_medida: 'UN',
    unidade_comercial: 'UN',
    unidade_tributavel: 'UN',
  });
  assert.equal(source.fornecedor_id, null);
  await assertStock(source.id, 5, 'Estoque inicial do produto sem fornecedor');
  assert.ok((await movements(source.id)).some((item) =>
    item.tipo === 'entrada'
    && item.motivo === 'Cadastro inicial'
    && number(item.quantidade) === 5));
  ok('produto criado sem fornecedor e refletido imediatamente na listagem');

  const renamedSource = await request(`/api/products/${source.id}`, {
    method: 'PUT',
    body: {
      name: `${prefix} Balde 3L editado`,
      fornecedor_id: null,
      price: 48,
      preco_compra: 25,
    },
  });
  assert.equal(renamedSource.name, `${prefix} Balde 3L editado`);
  assert.equal(renamedSource.fornecedor_id, null);
  closeTo((await productById(source.id)).price, 48, 'Preço após edição');
  ok('edição sem fornecedor refletida na nova consulta');

  const duplicateName = await createProduct({
    name: renamedSource.name,
    code: `${codePrefix}-NOME-DUPLICADO`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 12,
    preco_compra: 8,
    currentQuantity: 0,
    minQuantity: 0,
    unidade_medida: 'UN',
  });
  assert.notEqual(duplicateName.id, source.id);
  assert.equal(
    (await products()).filter((item) => item.name === renamedSource.name).length >= 2,
    true,
  );
  ok('nome repetido permanece permitido após o alerta visual');

  const bulkOne = await createProduct({
    name: `${prefix} Creme personalizado a granel`,
    code: `${codePrefix}-GRANEL-1`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 0.10,
    preco_compra: 0,
    currentQuantity: 0,
    minQuantity: 0,
    unidade_medida: 'ML',
    unidade_comercial: 'ML',
    unidade_tributavel: 'ML',
    granel_origem_id: source.id,
  });
  closeTo(bulkOne.price, 0.10, 'Preço interno de 1 ml para R$ 10 por 100 ml');
  assert.equal(bulkOne.name, `${prefix} Creme personalizado a granel`);
  ok('granel criado com nome personalizado e preço por 1 ml');

  const bulkTwo = await createProduct({
    name: `${prefix} Segunda versão a granel`,
    code: `${codePrefix}-GRANEL-2`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 0.12,
    preco_compra: 0,
    currentQuantity: 0,
    minQuantity: 0,
    unidade_medida: 'ML',
    unidade_comercial: 'ML',
    unidade_tributavel: 'ML',
    granel_origem_id: source.id,
  });
  const linkedBulk = (await products()).filter(
    (item) => Number(item.granel_origem_id) === Number(source.id),
  );
  assert.ok(linkedBulk.some((item) => item.id === bulkOne.id));
  assert.ok(linkedBulk.some((item) => item.id === bulkTwo.id));
  ok('segunda versão a granel permitida após confirmação do frontend');

  await request('/api/products/transferir-granel', {
    method: 'POST',
    body: {
      origem_id: source.id,
      granel_id: bulkOne.id,
      quantidade_saida: 1,
      quantidade_entrada: 3000,
    },
  });
  await assertStock(source.id, 4, 'Saída do recipiente original');
  await assertStock(bulkOne.id, 3000, 'Entrada em mililitros no granel');
  assert.ok((await movements(bulkOne.id)).some((item) =>
    item.tipo === 'entrada'
    && item.origem_tipo === 'granel_transferencia'
    && number(item.quantidade) === 3000));
  ok('transferência para granel atualiza os dois estoques e o histórico');

  const sourceMovementsBeforeFailure = (await movements(source.id)).length;
  const bulkMovementsBeforeFailure = (await movements(bulkOne.id)).length;
  await request('/api/products/transferir-granel', {
    method: 'POST',
    expected: 400,
    body: {
      origem_id: source.id,
      granel_id: bulkOne.id,
      quantidade_saida: 10,
      quantidade_entrada: 30000,
    },
  });
  await assertStock(source.id, 4, 'Origem após transferência a granel sem estoque');
  await assertStock(bulkOne.id, 3000, 'Granel após transferência recusada');
  assert.equal((await movements(source.id)).length, sourceMovementsBeforeFailure);
  assert.equal((await movements(bulkOne.id)).length, bulkMovementsBeforeFailure);
  ok('transferência a granel sem estoque é recusada com rollback');

  const box = await createProduct({
    name: `${prefix} Caixa com 12 unidades`,
    code: `${codePrefix}-CX`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 0,
    preco_compra: 120,
    currentQuantity: 10,
    minQuantity: 1,
    unidade_medida: 'CX',
    unidade_comercial: 'CX',
    unidade_tributavel: 'CX',
    unidades_por_caixa: 12,
  });
  ok('caixa criada sem fornecedor e sem exigir preço de venda');

  const unit = await createProduct({
    name: `${prefix} Produto unitário`,
    code: `${codePrefix}-CX-UN`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 15,
    preco_compra: 999,
    currentQuantity: 999,
    minQuantity: 0,
    unidade_medida: 'KG',
    unidades_por_caixa: 5,
    caixa_origem_id: box.id,
  });
  closeTo(unit.preco_compra, 10, 'Custo unitário calculado pela compra da caixa');
  closeTo(unit.currentQuantity, 0, 'Produto unitário inicia sem duplicar estoque');
  assert.equal(unit.unidade_medida, 'UN');
  assert.equal(unit.fornecedor_id, null);
  ok('produto unitário usa custo fracionado, estoque zero e fornecedor opcional');

  await request('/api/products', {
    method: 'POST',
    expected: 400,
    body: {
      name: `${prefix} Unidade duplicada da mesma caixa`,
      code: `${codePrefix}-CX-UN-2`,
      price: 16,
      currentQuantity: 0,
      caixa_origem_id: box.id,
    },
  });
  assert.equal(
    (await products()).filter((item) => Number(item.caixa_origem_id) === Number(box.id)).length,
    1,
  );
  ok('uma caixa não cria silenciosamente dois produtos unitários vinculados');

  await request('/api/products/transferir-caixa', {
    method: 'POST',
    body: {
      origem_id: box.id,
      unidade_id: unit.id,
      quantidade_caixas: 3,
    },
  });
  await assertStock(box.id, 7, 'Caixas após transferência válida');
  await assertStock(unit.id, 36, 'Unidades após abrir três caixas');
  ok('transferência de caixas calcula e atualiza as unidades');

  const boxMovementsBeforeFailure = (await movements(box.id)).length;
  const unitMovementsBeforeFailure = (await movements(unit.id)).length;
  const insufficient = await request('/api/products/transferir-caixa', {
    method: 'POST',
    expected: 400,
    body: {
      origem_id: box.id,
      unidade_id: unit.id,
      quantidade_caixas: 12,
    },
  });
  assert.match(String(insufficient.error), /Estoque insuficiente/i);
  await assertStock(box.id, 7, 'Caixas após tentativa acima do estoque');
  await assertStock(unit.id, 36, 'Unidades após tentativa acima do estoque');
  assert.equal((await movements(box.id)).length, boxMovementsBeforeFailure);
  assert.equal((await movements(unit.id)).length, unitMovementsBeforeFailure);
  ok('quantidade de caixas acima do estoque é rejeitada sem movimentação parcial');

  const inventoryProduct = await createProduct({
    name: `${prefix} Produto para inventário`,
    code: `${codePrefix}-INVENTARIO`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 9,
    preco_compra: 4,
    currentQuantity: 5,
    minQuantity: 2,
    unidade_medida: 'UN',
  });
  const inventory = await request('/api/inventarios/aplicar-lote', {
    method: 'POST',
    expected: 201,
    body: {
      itens: [{
        produto_id: inventoryProduct.id,
        quantidade_contada: 8,
        justificativa: 'Teste automatizado isolado',
        responsavel_nome: 'Gustavo Teste',
      }],
    },
  });
  assert.equal(inventory.total, 1);
  await assertStock(inventoryProduct.id, 8, 'Estoque após inventário');
  assert.ok((await movements(inventoryProduct.id)).some((item) =>
    item.origem_tipo === 'inventario'
    && item.tipo === 'entrada'
    && number(item.quantidade) === 3));
  ok('inventário atualiza estoque e histórico sem recarregar a página');

  const filteredByName = await request(`/api/products?name=${encodeURIComponent(codePrefix)}`);
  assert.ok(filteredByName.length >= 1);
  assert.ok(filteredByName.every((item) => Number(item.empresa_id) === empresaId));
  const belowMinimum = await request('/api/products?stockStatus=below');
  assert.ok(belowMinimum.every(
    (item) => number(item.currentQuantity) < number(item.minQuantity),
  ));
  ok('filtros de pesquisa e estoque mínimo retornam dados consistentes da empresa');

  const disposable = await createProduct({
    name: `${prefix} Produto descartável`,
    code: `${codePrefix}-DELETE`,
    fornecedor_id: null,
    category: 'Teste automatizado',
    price: 5,
    preco_compra: 2,
    currentQuantity: 1,
    minQuantity: 0,
    unidade_medida: 'UN',
  });
  await request(`/api/products/${disposable.id}`, {
    method: 'DELETE',
    expected: 204,
  });
  assert.ok(!(await products()).some((item) => Number(item.id) === Number(disposable.id)));
  ok('exclusão é refletida imediatamente na listagem');

  console.log(`\n${passed} grupos de verificações concluídos com sucesso.`);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`\nFALHA: ${error.stack || error.message}`);
} finally {
  try {
    if (empresaId && sequelize) {
      await cleanup();
      console.log('Dados temporários desta execução removidos.');
    }
  } catch (cleanupError) {
    exitCode = 1;
    console.error(`Falha na limpeza seletiva: ${cleanupError.stack || cleanupError.message}`);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (sequelize) {
    await sequelize.close();
  }
}

process.exitCode = exitCode;
