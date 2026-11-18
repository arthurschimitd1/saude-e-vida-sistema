import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { Op } from 'sequelize';

dotenv.config();

const ENABLE_FLAG = 'RUN_CAIXA_TESTS';
const runId = `${Date.now()}-${process.pid}`;
const prefix = `[TESTE-CAIXA-${runId}]`;
const codePrefix = `TESTE-CAIXA-${runId}`;
const forbiddenFiscalPath = /\/api\/(?:notas-fiscais|focus-(?:invoice|nfe|nfce)|service-invoices|nfse-config)\b/i;

let app;
let sequelize;
let Product;
let Movimento;
let Venda;
let VendaItem;
let Comissao;
let TurnoCaixa;
let server;
let baseUrl;
let token;
let empresaId;
let userId;
let userName;
let passed = 0;

const createdProductIds = new Set();
const createdSaleIds = new Set();
const createdShiftIds = new Set();

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
    { default: Venda },
    { default: VendaItem },
    { default: Comissao },
    { default: TurnoCaixa },
  ] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/database.js'),
    import('../src/models/Product.js'),
    import('../src/models/Movimento.js'),
    import('../src/models/Venda.js'),
    import('../src/models/VendaItem.js'),
    import('../src/models/Comissao.js'),
    import('../src/models/TurnoCaixa.js'),
  ]);
}

async function request(path, {
  method = 'GET',
  body,
  auth = true,
  expected = 200,
} = {}) {
  assert.ok(
    !forbiddenFiscalPath.test(path),
    `O teste tentou acessar uma rota fiscal proibida: ${method} ${path}`,
  );

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
  userId = Number(result.user.id);
  userName = result.user.nomeCompleto || result.user.nome || 'Gustavo Teste';
}

async function products() {
  return request('/api/products');
}

async function productById(id) {
  const product = (await products()).find((item) => Number(item.id) === Number(id));
  assert.ok(product, `Produto ${id} deveria existir`);
  return product;
}

async function movements(productId) {
  return request(`/api/movimentos?produto_id=${productId}`);
}

async function assertFrontendContracts() {
  const sourceUrl = new URL('../../frontend/app/(main)/uikit/input/page.tsx', import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  const contracts = [
    ['formato térmico 40 x 80 mm', "{ label: '40 × 80 mm', value: '40x80' }"],
    ['formato Epson 58 mm', "'58mm': { cols: 32, pagina: '58mm 297mm'"],
    ['quebra do nome completo dos produtos', 'overflow-wrap: anywhere'],
    ['nome da empresa no recibo', 'nome_fantasia'],
    ['CNPJ no recibo', 'CNPJ: ${emp.cnpj}'],
    ['endereço da empresa no recibo', 'enderecoEmpresaRecibo'],
    ['código da venda no recibo', 'codigoVendaRecibo'],
    ['seleção de tamanho no histórico', 'tipoCupomHistorico'],
    ['atualização do histórico após venda', 'fetchHistorico()'],
    ['atualização do estoque após venda', 'fetchProdutos()'],
    ['valor informado preservado para produto por peso', 'valorTotalFixo'],
  ];

  for (const [label, marker] of contracts) {
    assert.ok(source.includes(marker), `Contrato visual ausente: ${label}`);
  }
  ok('recibos, tamanhos e atualização automática estão presentes no frontend');
}

async function createProduct() {
  const product = await request('/api/products', {
    method: 'POST',
    expected: 201,
    body: {
      name: `${prefix} Produto com nome propositalmente longo para testar quebra no recibo`,
      code: `${codePrefix}-PRODUTO`,
      fornecedor_id: null,
      category: 'Teste automatizado',
      price: 12.5,
      preco_compra: 7,
      currentQuantity: 10,
      minQuantity: 1,
      unidade_medida: 'UN',
      unidade_comercial: 'UN',
      unidade_tributavel: 'UN',
    },
  });
  createdProductIds.add(Number(product.id));
  assert.equal(Number(product.empresa_id), empresaId);
  return product;
}

async function createShift() {
  const shift = await request('/api/turnos-caixa', {
    method: 'POST',
    expected: 201,
    body: {
      func_abertura_id: null,
      func_abertura_nome: `${prefix} ${userName}`,
      valor_abertura: 100,
    },
  });
  createdShiftIds.add(Number(shift.id));
  assert.equal(Number(shift.empresa_id), empresaId);
  assert.equal(shift.status, 'aberto');
  return shift;
}

async function createSale(product, shift) {
  const sale = await request('/api/vendas', {
    method: 'POST',
    expected: 201,
    body: {
      forma_pagamento: 'DINHEIRO',
      pagamentos: [
        { forma: 'DINHEIRO', valor: 10, valorRecebido: 15 },
        { forma: 'PIX', valor: 28 },
      ],
      turno_id: shift.id,
      valor_total: 38,
      cliente_id: null,
      funcionario_id: userId,
      com_nota: false,
      desconto: 5,
      tipo_desconto: 'valor',
      taxa_entrega: 3,
      endereco_entrega: 'Endereço temporário do teste',
      observacao: prefix,
      itens: [
        {
          produto_id: product.id,
          quantidade: 2,
          valor_unitario: 12.5,
          valor_total: 25,
        },
        {
          produto_id: null,
          nome_servico: `${prefix} Serviço adicional`,
          quantidade: 1,
          valor_unitario: 15,
          valor_total: 15,
        },
      ],
    },
  });
  createdSaleIds.add(Number(sale.id));
  return sale;
}

async function cleanup() {
  const transaction = await sequelize.transaction();
  try {
    const prefixedSales = await Venda.findAll({
      where: { empresa_id: empresaId, observacao: prefix },
      attributes: ['id'],
      transaction,
    });
    const saleIds = [...new Set([
      ...createdSaleIds,
      ...prefixedSales.map((item) => Number(item.id)),
    ])].filter(Number.isInteger);

    for (const saleId of saleIds) {
      const sale = await Venda.findOne({
        where: { id: saleId, empresa_id: empresaId },
        transaction,
      });
      if (!sale) continue;

      const items = await VendaItem.findAll({ where: { venda_id: saleId }, transaction });
      for (const item of items) {
        if (!item.produto_id || !createdProductIds.has(Number(item.produto_id))) continue;
        await Product.increment(
          { currentQuantity: number(item.quantidade) },
          { where: { id: item.produto_id, empresa_id: empresaId }, transaction },
        );
      }
      await Movimento.destroy({
        where: { origem_tipo: 'venda', origem_id: saleId, empresa_id: empresaId },
        transaction,
      });
      await Comissao.destroy({ where: { venda_id: saleId, empresa_id: empresaId }, transaction });
      await VendaItem.destroy({ where: { venda_id: saleId }, transaction });
      await Venda.destroy({ where: { id: saleId, empresa_id: empresaId }, transaction });
    }

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
    const productIds = [...new Set([
      ...createdProductIds,
      ...prefixedProducts.map((item) => Number(item.id)),
    ])].filter(Number.isInteger);
    if (productIds.length) {
      await Movimento.destroy({
        where: { produto_id: { [Op.in]: productIds }, empresa_id: empresaId },
        transaction,
      });
      await Product.destroy({
        where: { id: { [Op.in]: productIds }, empresa_id: empresaId },
        transaction,
      });
    }

    const prefixedShifts = await TurnoCaixa.findAll({
      where: { empresa_id: empresaId, func_abertura_nome: { [Op.like]: `${prefix}%` } },
      attributes: ['id'],
      transaction,
    });
    const shiftIds = [...new Set([
      ...createdShiftIds,
      ...prefixedShifts.map((item) => Number(item.id)),
    ])].filter(Number.isInteger);
    if (shiftIds.length) {
      await TurnoCaixa.destroy({
        where: { id: { [Op.in]: shiftIds }, empresa_id: empresaId },
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
    throw new Error(`Execução bloqueada. Use ${ENABLE_FLAG}=1 para confirmar.`);
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_INTEGRATION_TEST !== '1') {
    throw new Error('Teste recusado em NODE_ENV=production.');
  }
  if (databaseIsRemote() && process.env.ALLOW_REMOTE_INTEGRATION_TEST !== '1') {
    throw new Error('Teste recusado em banco remoto. Use ALLOW_REMOTE_INTEGRATION_TEST=1.');
  }
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    throw new Error('Defina TEST_USER_EMAIL e TEST_USER_PASSWORD.');
  }

  await loadApplication();
  await sequelize.authenticate();
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await login();

  console.log(`\nTeste completo do Caixa sem emissão fiscal (${prefix})`);
  console.log(`Conta: ${process.env.TEST_USER_EMAIL}`);
  console.log(`Empresa de teste: ${empresaId}\n`);

  await request('/api/vendas', { auth: false, expected: 401 });
  ok('rotas de venda exigem autenticação');
  await assertFrontendContracts();

  const product = await createProduct();
  closeTo((await productById(product.id)).currentQuantity, 10, 'Estoque inicial');
  ok('produto temporário criado na empresa correta');

  const shift = await createShift();
  assert.ok((await request('/api/turnos-caixa?status=aberto')).some(
    (item) => Number(item.id) === Number(shift.id),
  ));
  ok('abertura do caixa aparece imediatamente na listagem');

  const sale = await createSale(product, shift);
  assert.equal(sale.com_nota, false);
  assert.equal(Number(sale.empresa_id), empresaId);
  assert.equal(Number(sale.turno_id), Number(shift.id));
  assert.equal(sale.itens.length, 2);
  closeTo((await productById(product.id)).currentQuantity, 8, 'Estoque após venda');
  assert.ok((await movements(product.id)).some((item) =>
    item.origem_tipo === 'venda'
    && Number(item.origem_id) === Number(sale.id)
    && item.tipo === 'saida'
    && number(item.quantidade) === 2));
  ok('venda sem nota grava itens, pagamentos e saída de estoque');

  const fetchedSale = await request(`/api/vendas/${sale.id}`);
  assert.equal(Number(fetchedSale.id), Number(sale.id));
  assert.ok((await request(`/api/vendas?funcionario_id=${userId}`)).some(
    (item) => Number(item.id) === Number(sale.id),
  ));
  ok('venda aparece no detalhe e no histórico filtrado da empresa');

  const weightedValueSale = await request('/api/vendas', {
    method: 'POST',
    expected: 201,
    body: {
      forma_pagamento: 'PIX',
      pagamentos: [{ forma: 'PIX', valor: 20 }],
      turno_id: shift.id,
      valor_total: 20,
      funcionario_id: userId,
      com_nota: false,
      observacao: prefix,
      itens: [{
        produto_id: product.id,
        quantidade: 0.667,
        valor_unitario: 20 / 0.667,
        valor_total: 20,
      }],
    },
  });
  createdSaleIds.add(Number(weightedValueSale.id));
  closeTo(weightedValueSale.valor_total, 20, 'Valor informado no produto por peso');
  closeTo(weightedValueSale.itens?.[0]?.quantidade, 0.667, 'Peso calculado para o estoque');
  closeTo(weightedValueSale.itens?.[0]?.valor_total, 20, 'Total do item por peso');
  await request(`/api/vendas/${weightedValueSale.id}`, { method: 'DELETE', expected: 204 });
  createdSaleIds.delete(Number(weightedValueSale.id));
  ok('produto por peso preserva R$ 20,00 e baixa somente o peso calculado');

  const shiftMovement = await request(`/api/turnos-caixa/${shift.id}/movimentos`);
  closeTo(shiftMovement.resumo.totalGeral, 38, 'Total do turno');
  closeTo(shiftMovement.resumo.totalDinheiro, 10, 'Dinheiro do turno');
  closeTo(shiftMovement.resumo.totalPix, 28, 'PIX do turno');
  closeTo(shiftMovement.resumo.trocoTotal, 5, 'Troco do turno');
  closeTo(shiftMovement.resumo.saldoEsperado, 105, 'Saldo esperado descontando troco');
  ok('resumo do turno calcula pagamentos divididos e troco corretamente');

  const salesBeforeFailure = (await request('/api/vendas')).length;
  const movementsBeforeFailure = (await movements(product.id)).length;
  const insufficient = await request('/api/vendas', {
    method: 'POST',
    expected: 400,
    body: {
      forma_pagamento: 'PIX',
      pagamentos: [{ forma: 'PIX', valor: 1250 }],
      turno_id: shift.id,
      valor_total: 1250,
      funcionario_id: userId,
      com_nota: false,
      observacao: prefix,
      itens: [{
        produto_id: product.id,
        quantidade: 100,
        valor_unitario: 12.5,
        valor_total: 1250,
      }],
    },
  });
  assert.match(String(insufficient.error), /Estoque insuficiente/i);
  closeTo((await productById(product.id)).currentQuantity, 8, 'Estoque após venda recusada');
  assert.equal((await request('/api/vendas')).length, salesBeforeFailure);
  assert.equal((await movements(product.id)).length, movementsBeforeFailure);
  ok('venda sem estoque é recusada com rollback integral');

  const updatedSale = await request(`/api/vendas/${sale.id}`, {
    method: 'PUT',
    body: {
      forma_pagamento: 'CARTAO',
      pagamentos: [{ forma: 'CARTAO', tipoCartao: 'credito', parcelas: 2, valor: 52.5 }],
      turno_id: shift.id,
      valor_total: 52.5,
      cliente_id: null,
      funcionario_id: userId,
      com_nota: false,
      desconto: 0,
      tipo_desconto: 'valor',
      taxa_entrega: 0,
      observacao: prefix,
      itens: [
        {
          produto_id: product.id,
          quantidade: 3,
          valor_unitario: 12.5,
          valor_total: 37.5,
        },
        {
          produto_id: null,
          nome_servico: `${prefix} Serviço editado`,
          quantidade: 1,
          valor_unitario: 15,
          valor_total: 15,
        },
      ],
    },
  });
  closeTo((await productById(product.id)).currentQuantity, 7, 'Estoque após edição da venda');
  const serviceItem = updatedSale.itens.find((item) => item.tipo === 'servico');
  assert.equal(serviceItem?.nome_item, `${prefix} Serviço editado`);
  assert.equal(updatedSale.com_nota, false);
  ok('edição da venda recalcula estoque, pagamento e preserva o nome do serviço');

  const updatedShiftMovement = await request(`/api/turnos-caixa/${shift.id}/movimentos`);
  closeTo(updatedShiftMovement.resumo.totalGeral, 52.5, 'Total do turno após edição');
  closeTo(updatedShiftMovement.resumo.totalCartao, 52.5, 'Cartão após edição');
  closeTo(updatedShiftMovement.resumo.totalDinheiro, 0, 'Dinheiro removido após edição');
  ok('resumo do turno reflete a edição sem atualizar a página');

  await request(`/api/vendas/${sale.id}`, { method: 'DELETE', expected: 204 });
  createdSaleIds.delete(Number(sale.id));
  closeTo((await productById(product.id)).currentQuantity, 10, 'Estoque após cancelamento');
  assert.ok(!(await request('/api/vendas')).some((item) => Number(item.id) === Number(sale.id)));
  assert.ok((await movements(product.id)).some((item) =>
    item.origem_tipo === 'venda_cancelada'
    && Number(item.origem_id) === Number(sale.id)
    && item.tipo === 'entrada'));
  ok('cancelamento remove a venda do histórico e devolve o estoque');

  const closedShift = await request(`/api/turnos-caixa/${shift.id}/fechar`, {
    method: 'PUT',
    body: {
      func_fechamento_id: userId,
      func_fechamento_nome: userName,
      valor_fechamento: 100,
    },
  });
  assert.equal(closedShift.status, 'fechado');
  assert.ok((await request('/api/turnos-caixa?status=fechado')).some(
    (item) => Number(item.id) === Number(shift.id),
  ));
  ok('fechamento do caixa aparece imediatamente no histórico de turnos');

  console.log(`\n${passed} grupos de verificações concluídos com sucesso.`);
  console.log('Nenhuma rota de emissão fiscal foi chamada.');
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
