const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'saude-e-vida.json');

const today = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza' }).format(new Date());
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
const id = () => Number(`${Date.now()}${crypto.randomInt(10, 99)}`);

const seed = {
  version: 2,
  company: { id: 1, name: 'Saúde e Vida', tradeName: 'Saúde e Vida', segment: 'Produtos naturais e bem-estar' },
  user: { id: 1, name: 'Admin', email: 'admin@saudeevida.com', role: 'Administrador', status: 'ativo' },
  shifts: [],
  products: [
    { id: 1, name: 'Chá verde com limão', code: 'SV-001', category: 'Chás e infusões', unit: 'UN', stock: 34, min: 12, price: 24.9, cost: 11.5, supplierId: 1, infinite: false },
    { id: 2, name: 'Granola artesanal 500g', code: 'SV-002', category: 'Alimentos naturais', unit: 'UN', stock: 8, min: 10, price: 29.9, cost: 14.2, supplierId: 1, infinite: false },
    { id: 3, name: 'Pasta de amendoim integral', code: 'SV-003', category: 'Alimentos naturais', unit: 'UN', stock: 21, min: 8, price: 21.5, cost: 9.8, supplierId: 2, infinite: false },
    { id: 4, name: 'Blend Energia da Manhã', code: 'SV-004', category: 'Suplementos', unit: 'UN', stock: 17, min: 7, price: 48.9, cost: 25.3, supplierId: 2, infinite: false },
    { id: 5, name: 'Óleo essencial de lavanda', code: 'SV-005', category: 'Bem-estar', unit: 'UN', stock: 4, min: 6, price: 36.9, cost: 16.4, supplierId: 2, infinite: false },
    { id: 6, name: 'Mix de castanhas 250g', code: 'SV-006', category: 'Alimentos naturais', unit: 'UN', stock: 26, min: 10, price: 32.9, cost: 17.9, supplierId: 1, infinite: false }
  ],
  clients: [
    { id: 1, name: 'Mariana Alves', phone: '(85) 99921-3211', email: 'mariana@email.com', cpf: '', address: '' },
    { id: 2, name: 'Rafael Nogueira', phone: '(85) 98840-1180', email: 'rafael@email.com', cpf: '', address: '' },
    { id: 3, name: 'Camila Freitas', phone: '(85) 99731-0452', email: 'camila@email.com', cpf: '', address: '' }
  ],
  suppliers: [
    { id: 1, name: 'Verde Campo Distribuidora', contact: 'contato@verdecampo.com', phone: '(85) 3221-0042', document: '' },
    { id: 2, name: 'Raízes do Brasil', contact: 'comercial@raizes.com', phone: '(11) 4020-8844', document: '' }
  ],
  sales: [
    { id: 2058, clientId: 1, client: 'Mariana Alves', employeeId: 1, items: [{ productId: 6, name: 'Mix de castanhas 250g', quantity: 2, unitPrice: 32.9, total: 65.8 }], subtotal: 65.8, discount: 0, deliveryFee: 0, total: 65.8, payments: [{ method: 'PIX', amount: 65.8 }], status: 'finalizada', shiftId: null, date: isoToday(), createdAt: new Date().toISOString() },
    { id: 2057, clientId: 2, client: 'Rafael Nogueira', employeeId: 1, items: [{ productId: 4, name: 'Blend Energia da Manhã', quantity: 1, unitPrice: 48.9, total: 48.9 }], subtotal: 48.9, discount: 0, deliveryFee: 0, total: 48.9, payments: [{ method: 'CARTAO', cardType: 'credito', installments: 1, amount: 48.9 }], status: 'finalizada', shiftId: null, date: isoToday(), createdAt: new Date().toISOString() }
  ],
  movements: [
    { id: 1, productId: 6, product: 'Mix de castanhas 250g', type: 'saida', quantity: 2, reason: 'Venda #2058', originType: 'venda', originId: 2058, date: isoToday() },
    { id: 2, productId: 1, product: 'Chá verde com limão', type: 'entrada', quantity: 24, reason: 'Recebimento do pedido PED-0103', originType: 'pedido', originId: 103, date: '2026-10-05' }
  ],
  orders: [
    { id: 104, number: 'PED-0104', supplierId: 1, supplier: 'Verde Campo Distribuidora', status: 'pendente', orderDate: isoToday(), expectedDate: isoToday(), notes: '', items: [{ productId: 2, product: 'Granola artesanal 500g', quantity: 30, unitPrice: 14.2, total: 426 }], total: 426, financialControl: true, paid: 0, financialStatus: 'nao_pago' },
    { id: 103, number: 'PED-0103', supplierId: 2, supplier: 'Raízes do Brasil', status: 'recebido', orderDate: '2026-10-03', expectedDate: '2026-10-05', notes: '', items: [{ productId: 1, product: 'Chá verde com limão', quantity: 24, unitPrice: 11.5, total: 276 }], total: 276, financialControl: true, paid: 276, financialStatus: 'quitado' }
  ],
  orderPayments: [],
  cashEntries: [
    { id: 1, type: 'entrada', originType: 'venda', originId: 2058, description: 'Venda #2058', amount: 65.8, method: 'PIX', date: isoToday(), shiftId: null },
    { id: 2, type: 'entrada', originType: 'venda', originId: 2057, description: 'Venda #2057', amount: 48.9, method: 'CARTAO', date: isoToday(), shiftId: null }
  ],
  expenses: [{ id: 1, type: 'saida', category: 'Operacional', description: 'Compra de embalagens', amount: 380, status: 'pago', method: 'PIX', date: '2026-10-06' }],
  receivables: [{ id: 1, clientId: 1, client: 'Mariana Alves', saleId: null, origin: 'MANUAL', description: 'Venda parcelada', amount: 120.5, paidAmount: 0, issueDate: '2026-10-08', dueDate: '2026-10-15', status: 'ABERTA' }],
  budgets: [{ id: 1, clientId: 3, client: 'Camila Freitas', description: 'Kit Bem-estar', amount: 179.9, status: 'EM_ANALISE', date: '2026-10-07' }],
  appointments: [],
  production: [],
  next: 3000
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}
function readData() { ensureData(); return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) { ensureData(); const temp = `${DATA_FILE}.tmp`; fs.writeFileSync(temp, JSON.stringify(data, null, 2)); fs.renameSync(temp, DATA_FILE); }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 2_000_000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } }); req.on('error', reject); }); }
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(value)); }
function noContent(res) { res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); }
function notFound(res) { json(res, 404, { error: 'Rota não encontrada' }); }
function bad(res, message) { json(res, 400, { error: message }); }
function numeric(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function getProduct(data, productId) { return data.products.find(item => Number(item.id) === Number(productId)); }
function getClient(data, clientId) { return data.clients.find(item => Number(item.id) === Number(clientId)); }
function getOpenShift(data) { return data.shifts.find(shift => shift.status === 'aberto'); }
function ensureStock(data, items) { for (const item of items) { const product = getProduct(data, item.productId); if (!product) throw new Error('Produto não encontrado'); if (!product.infinite && numeric(product.stock) < numeric(item.quantity)) throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}`); } }
function registerMovement(data, product, type, quantity, reason, originType, originId) { data.movements.unshift({ id: data.next++, productId: product.id, product: product.name, type, quantity: numeric(quantity), reason, originType, originId, date: isoToday() }); }
function createCashEntry(data, sale, payment, shiftId) { data.cashEntries.unshift({ id: data.next++, type: 'entrada', originType: 'venda', originId: sale.id, description: `Venda #${sale.id}`, amount: numeric(payment.amount), method: payment.method, date: sale.date, shiftId: shiftId || null }); }
function applySale(data, payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Adicione pelo menos um produto à venda');
  const items = payload.items.map(item => { const product = getProduct(data, item.productId); if (!product) throw new Error('Produto não encontrado'); const quantity = numeric(item.quantity); if (quantity <= 0) throw new Error(`Quantidade inválida para ${product.name}`); const unitPrice = numeric(item.unitPrice, numeric(product.price)); return { productId: product.id, name: product.name, quantity, unitPrice, total: Math.round(unitPrice * quantity * 100) / 100 }; });
  ensureStock(data, items);
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = numeric(payload.discount); const deliveryFee = numeric(payload.deliveryFee); const total = Math.max(0, subtotal - discount + deliveryFee);
  const payments = Array.isArray(payload.payments) ? payload.payments.map(payment => ({ ...payment, amount: numeric(payment.amount) })).filter(payment => payment.amount > 0) : [];
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const onCredit = Boolean(payload.onCredit) || String(payload.paymentType || '').toUpperCase() === 'PRAZO';
  if (!onCredit && total > 0 && paid < total - 0.01) throw new Error(`Pagamentos somam ${paid.toFixed(2)} e a venda totaliza ${total.toFixed(2)}`);
  const shift = getOpenShift(data); const sale = { id: data.next++, clientId: payload.clientId || null, client: getClient(data, payload.clientId)?.name || 'Consumidor final', employeeId: 1, items, subtotal, discount, deliveryFee, total, payments, status: 'finalizada', shiftId: shift?.id || null, date: payload.date || isoToday(), observation: payload.observation || '', deliveryAddress: payload.deliveryAddress || '', issueInvoice: Boolean(payload.issueInvoice), createdAt: new Date().toISOString() };
  for (const item of items) { const product = getProduct(data, item.productId); if (!product.infinite) product.stock = Math.round((numeric(product.stock) - item.quantity) * 1000) / 1000; registerMovement(data, product, 'saida', item.quantity, `Venda #${sale.id}`, 'venda', sale.id); }
  for (const payment of payments) createCashEntry(data, sale, payment, shift?.id);
  if (paid < total - 0.01) data.receivables.unshift({ id: data.next++, clientId: sale.clientId, client: sale.client, saleId: sale.id, origin: 'VENDA', description: `Venda #${sale.id}`, amount: total - paid, paidAmount: 0, issueDate: sale.date, dueDate: payload.dueDate || sale.date, status: 'ABERTA' });
  data.sales.unshift(sale); return sale;
}
function receiveOrder(data, order) { if (order.status === 'recebido') return; for (const item of order.items) { const product = getProduct(data, item.productId); if (!product) continue; product.stock = Math.round((numeric(product.stock) + numeric(item.quantity)) * 1000) / 1000; registerMovement(data, product, 'entrada', item.quantity, `Recebimento do pedido ${order.number}`, 'pedido', order.id); } order.status = 'recebido'; order.receivedDate = isoToday(); }
function dashboard(data) { const entradas = data.cashEntries.filter(e => e.type === 'entrada').reduce((sum, e) => sum + numeric(e.amount), 0); const saidas = data.expenses.reduce((sum, e) => sum + numeric(e.amount), 0); return { totalEntradas: entradas, totalSaidas: saidas, saldo: entradas - saidas, clientesComCompras: new Set(data.sales.filter(s => s.clientId).map(s => s.clientId)).size, novosClientes: data.clients.length, estoqueBaixo: data.products.filter(p => !p.infinite && numeric(p.stock) > 0 && numeric(p.stock) <= numeric(p.min)).length, semEstoque: data.products.filter(p => !p.infinite && numeric(p.stock) <= 0).length, aReceber: data.receivables.filter(r => r.status === 'ABERTA').reduce((sum, r) => sum + numeric(r.amount) - numeric(r.paidAmount), 0), estoqueValor: data.products.reduce((sum, p) => sum + numeric(p.stock) * numeric(p.cost), 0) }; }
function saleForApi(sale, data) { return { ...sale, data: sale.date, valor_total: sale.total, forma_pagamento: sale.payments?.[0]?.method || 'PIX', tipo_cartao: sale.payments?.[0]?.cardType || null, parcelas: sale.payments?.[0]?.installments || 1, cliente: sale.clientId ? getClient(data, sale.clientId) ? { id: sale.clientId, nomeCompleto: getClient(data, sale.clientId).name, telefone: getClient(data, sale.clientId).phone } : null : null, funcionario: { id: 1, nomeCompleto: 'Admin', email: 'admin@saudeevida.com' }, itens: sale.items.map(item => ({ id: item.productId, produto_id: item.productId, nome_item: item.name, nome: item.name, quantidade: item.quantity, valor_unitario: item.unitPrice, valor_total: item.total, tipo: 'produto' })) }; }

async function handle(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const pathname = parsed.pathname; const method = req.method; const data = readData();
  if (method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Empresa-Override' }); return res.end(); }
  try {
    if (pathname === '/api/health') return json(res, 200, { ok: true, app: 'saude-e-vida', version: data.version });
    if ((pathname === '/api/login' || pathname === '/api/auth/login') && method === 'POST') { const input = await body(req); const password = input.password ?? input.senha; if (String(input.email || '').trim().toLowerCase() !== 'admin@saudeevida.com' || password !== 'saudevida123') return json(res, 401, { error: 'Credenciais inválidas' }); return json(res, 200, { token: 'local-demo-token', user: { ...data.user, nome: data.user.name, nomeCompleto: data.user.name, cargo: data.user.role, tipo: 'MASTER', empresa_id: data.company.id, permissoes: ['*'] }, company: data.company }); }
    if (pathname === '/api/state' && method === 'GET') return json(res, 200, { data: clone(data) });
    if (pathname === '/api/dashboard' && method === 'GET') return json(res, 200, dashboard(data));
    if (pathname === '/api/state' && method === 'PUT') { const input = await body(req); if (!input.data) return bad(res, 'Estado inválido'); writeData(input.data); return json(res, 200, { saved: true }); }
    if (pathname === '/api/empresas/1' && method === 'GET') return json(res, 200, { ...data.company, nome: data.company.name, cnpj: '' });
    if (pathname === '/api/empresas/1/configuracoes' && method === 'GET') return json(res, 200, {});
    if (pathname === '/api/minha-empresa' && method === 'GET') return json(res, 200, { nome_fantasia: data.company.name, razao_social: data.company.name, nome_exibicao: data.company.name });
    if (pathname === '/api/empresa-config-fiscal/1' && method === 'GET') return json(res, 200, {});
    if (pathname === '/api/users/funcionarios-venda' && method === 'GET') return json(res, 200, [{ id: data.user.id, nome: data.user.name, nomeCompleto: data.user.name, email: data.user.email, cargo: data.user.role }]);
    if (pathname === '/api/services' && method === 'GET') return json(res, 200, []);
    if (pathname === '/api/agendamentos' && method === 'GET') return json(res, 200, []);
    if (pathname === '/api/agendamentos/servicos' && method === 'GET') return json(res, 200, []);
    if (pathname === '/api/estoque-roupas' && method === 'GET') return json(res, 200, []);
    if (pathname === '/api/bairros' && method === 'GET') return json(res, 200, []);
    if (pathname === '/api/vendas' && method === 'GET') return json(res, 200, data.sales.map(sale => saleForApi(sale, data)));
    if (pathname === '/api/vendas' && method === 'POST') { const input = await body(req); const items = (input.itens || []).filter(item => item.tipo !== 'servico' && item.tipo !== 'roupa').map(item => ({ productId: Number(item.produto_id ?? item.id), quantity: Number(item.quantidade), unitPrice: Number(item.valor_unitario ?? item.valor ?? 0) })); const sale = applySale(data, { items, clientId: input.cliente_id || null, discount: input.desconto || 0, deliveryFee: input.taxa_entrega || 0, observation: input.observacao, payments: input.pagamentos || [{ method: input.forma_pagamento || 'DINHEIRO', amount: input.valor_total || 0 }], paymentType: input.forma_pagamento }); writeData(data); return json(res, 201, saleForApi(sale, data)); }
    if (pathname.match(/^\/api\/vendas\/\d+$/) && method === 'DELETE') { const saleId = Number(pathname.split('/')[3]); const sale = data.sales.find(item => item.id === saleId); if (!sale) return notFound(res); for (const item of sale.items) { const product = getProduct(data, item.productId); if (product && !product.infinite) { product.stock += item.quantity; registerMovement(data, product, 'entrada', item.quantity, `Estorno da venda #${sale.id}`, 'estorno_venda', sale.id); } } data.sales = data.sales.filter(item => item.id !== saleId); data.cashEntries = data.cashEntries.filter(item => !(item.originType === 'venda' && item.originId === saleId)); writeData(data); return noContent(res); }
    if (pathname === '/api/turnos-caixa' && method === 'GET') return json(res, 200, data.shifts);
    if (pathname === '/api/turnos-caixa' && method === 'POST') { if (getOpenShift(data)) return bad(res, 'Já existe um turno de caixa aberto'); const input = await body(req); const shift = { id: data.next++, func_abertura_id: 1, func_abertura_nome: 'Admin', valor_abertura: numeric(input.valor_abertura), data_abertura: new Date().toISOString(), status: 'aberto' }; data.shifts.unshift(shift); writeData(data); return json(res, 201, shift); }
    if (pathname.match(/^\/api\/turnos-caixa\/\d+\/fechar$/) && method === 'PUT') { const shift = data.shifts.find(item => item.id === Number(pathname.split('/')[3])); if (!shift || shift.status !== 'aberto') return bad(res, 'Turno aberto não encontrado'); const input = await body(req); shift.valor_fechamento = numeric(input.valor_fechamento); shift.func_fechamento_id = 1; shift.func_fechamento_nome = 'Admin'; shift.data_fechamento = new Date().toISOString(); shift.status = 'fechado'; writeData(data); return json(res, 200, shift); }
    if (pathname === '/api/financeiro/saidas' && method === 'GET') return json(res, 200, data.expenses.map(item => ({ ...item, tipo: item.category, natureza: 'SAIDA', descricao: item.description, valor: item.amount, forma_pagamento: item.method, data: item.date })));
    if (pathname === '/api/financeiro/saidas' && method === 'POST') { const input = await body(req); const expense = { id: data.next++, type: 'saida', category: input.tipo || input.category || 'Outros', description: input.descricao || input.description || '', amount: numeric(input.valor ?? input.amount), status: 'pago', method: input.forma_pagamento || input.method || 'DINHEIRO', date: input.data || isoToday() }; if (!expense.description || expense.amount <= 0) return bad(res, 'Descrição e valor são obrigatórios'); data.expenses.unshift(expense); writeData(data); return json(res, 201, { ...expense, descricao: expense.description, valor: expense.amount }); }
    if (pathname === '/api/financeiro/contas-receber' && method === 'GET') return json(res, 200, data.receivables);
    if (pathname === '/api/products' && method === 'GET') return json(res, 200, data.products.map(product => ({ ...product, currentQuantity: product.stock, minQuantity: product.min, unidade_medida: product.unit, preco_compra: product.cost, sku: product.code, valor: product.price })));
    if (pathname === '/api/products' && method === 'POST') { const input = await body(req); if (!String(input.name || '').trim()) return bad(res, 'Nome do produto é obrigatório'); const product = { id: data.next++, name: String(input.name).trim(), code: input.code || input.sku || `SV-${String(data.next).padStart(4, '0')}`, category: input.category || 'Sem categoria', unit: input.unit || input.unidade_medida || 'UN', stock: numeric(input.stock ?? input.currentQuantity), min: numeric(input.min ?? input.minQuantity), price: numeric(input.price ?? input.valor), cost: numeric(input.cost ?? input.preco_compra), supplierId: input.supplierId || input.fornecedor_id || null, infinite: Boolean(input.infinite) }; data.products.push(product); writeData(data); return json(res, 201, { ...product, currentQuantity: product.stock, minQuantity: product.min }); }
    if (pathname === '/api/stock/movements' && method === 'GET') return json(res, 200, data.movements);
    if (pathname === '/api/stock/entry' && method === 'POST') { const input = await body(req); const product = getProduct(data, input.productId); const quantity = numeric(input.quantity); if (!product || quantity <= 0) return bad(res, 'Produto ou quantidade inválidos'); product.stock = numeric(product.stock) + quantity; if (input.cost != null) product.cost = numeric(input.cost, product.cost); registerMovement(data, product, 'entrada', quantity, input.reason || 'Entrada manual', 'manual', null); writeData(data); return json(res, 201, product); }
    if (pathname === '/api/shifts' && method === 'GET') return json(res, 200, data.shifts);
    if (pathname === '/api/shifts/open' && method === 'POST') { if (getOpenShift(data)) return bad(res, 'Já existe um turno de caixa aberto'); const input = await body(req); const shift = { id: data.next++, employeeId: 1, employee: 'Admin', openingAmount: numeric(input.openingAmount), openedAt: new Date().toISOString(), status: 'aberto' }; data.shifts.unshift(shift); writeData(data); return json(res, 201, shift); }
    if (pathname.match(/^\/api\/shifts\/\d+\/close$/) && method === 'POST') { const shift = data.shifts.find(item => item.id === Number(pathname.split('/')[3])); if (!shift || shift.status !== 'aberto') return bad(res, 'Turno aberto não encontrado'); const input = await body(req); shift.closingAmount = numeric(input.closingAmount); shift.closedAt = new Date().toISOString(); shift.status = 'fechado'; writeData(data); return json(res, 200, shift); }
    if (pathname === '/api/sales' && method === 'GET') return json(res, 200, data.sales);
    if (pathname === '/api/sales' && method === 'POST') { const sale = applySale(data, await body(req)); writeData(data); return json(res, 201, sale); }
    if (pathname.match(/^\/api\/sales\/\d+$/) && method === 'DELETE') { const sale = data.sales.find(item => item.id === Number(pathname.split('/')[3])); if (!sale) return notFound(res); for (const item of sale.items) { const product = getProduct(data, item.productId); if (product && !product.infinite) { product.stock += item.quantity; registerMovement(data, product, 'entrada', item.quantity, `Estorno da venda #${sale.id}`, 'estorno_venda', sale.id); } } data.sales = data.sales.filter(item => item.id !== sale.id); data.cashEntries = data.cashEntries.filter(item => !(item.originType === 'venda' && item.originId === sale.id)); writeData(data); return noContent(res); }
    if (pathname === '/api/orders' && method === 'GET') return json(res, 200, data.orders);
    if (pathname === '/api/orders' && method === 'POST') { const input = await body(req); const supplier = data.suppliers.find(item => item.id === Number(input.supplierId)); if (!supplier) return bad(res, 'Fornecedor é obrigatório'); if (!Array.isArray(input.items) || !input.items.length) return bad(res, 'Adicione pelo menos um item ao pedido'); const items = input.items.map(item => { const product = getProduct(data, item.productId); if (!product) throw new Error('Produto não encontrado'); const quantity = numeric(item.quantity); const unitPrice = numeric(item.unitPrice, product.cost); return { productId: product.id, product: product.name, quantity, unitPrice, total: quantity * unitPrice }; }); const order = { id: data.next++, number: `PED-${String(data.next).padStart(4, '0')}`, supplierId: supplier.id, supplier: supplier.name, status: 'pendente', orderDate: input.orderDate || isoToday(), expectedDate: input.expectedDate || null, notes: input.notes || '', items, total: items.reduce((sum, item) => sum + item.total, 0), financialControl: true, paid: 0, financialStatus: 'nao_pago' }; data.orders.unshift(order); writeData(data); return json(res, 201, order); }
    if (pathname.match(/^\/api\/orders\/\d+$/) && method === 'PUT') { const order = data.orders.find(item => item.id === Number(pathname.split('/')[3])); if (!order) return notFound(res); const input = await body(req); if (input.status === 'recebido') receiveOrder(data, order); else if (input.status) order.status = input.status; if (input.notes != null) order.notes = input.notes; writeData(data); return json(res, 200, order); }
    if (pathname.match(/^\/api\/orders\/\d+\/payments$/) && method === 'POST') { const order = data.orders.find(item => item.id === Number(pathname.split('/')[3])); if (!order) return notFound(res); const input = await body(req); const amount = numeric(input.amount); if (amount <= 0) return bad(res, 'Valor do pagamento inválido'); data.orderPayments.push({ id: data.next++, orderId: order.id, amount, date: isoToday(), note: input.note || '' }); order.paid += amount; order.financialStatus = order.paid >= order.total ? 'quitado' : 'parcial'; writeData(data); return json(res, 201, order); }
    if ((pathname === '/api/clients' || pathname === '/api/clientes') && method === 'GET') return json(res, 200, data.clients.map(client => ({ ...client, nomeCompleto: client.name })));
    if (pathname === '/api/clients' && method === 'POST') { const input = await body(req); if (!String(input.name || '').trim()) return bad(res, 'Nome do cliente é obrigatório'); const client = { id: data.next++, name: String(input.name).trim(), phone: input.phone || '', email: input.email || '', cpf: input.cpf || '', address: input.address || '' }; data.clients.push(client); writeData(data); return json(res, 201, client); }
    if ((pathname === '/api/suppliers' || pathname === '/api/fornecedores') && method === 'GET') return json(res, 200, data.suppliers.map(supplier => ({ ...supplier, nomeCompleto: supplier.name })));
    if (pathname === '/api/suppliers' && method === 'POST') { const input = await body(req); if (!String(input.name || '').trim()) return bad(res, 'Nome do fornecedor é obrigatório'); const supplier = { id: data.next++, name: String(input.name).trim(), contact: input.contact || '', phone: input.phone || '', document: input.document || '' }; data.suppliers.push(supplier); writeData(data); return json(res, 201, supplier); }
    if (pathname === '/api/users' && method === 'GET') return json(res, 200, [{ ...data.user, nomeCompleto: data.user.name, nome: data.user.name, cargo: data.user.role, email: data.user.email }]);
    if (pathname === '/api/finance/entries' && method === 'GET') return json(res, 200, data.cashEntries);
    if (pathname === '/api/finance/expenses' && method === 'GET') return json(res, 200, data.expenses);
    if (pathname === '/api/finance/expenses' && method === 'POST') { const input = await body(req); const expense = { id: data.next++, type: 'saida', category: input.category || 'Outros', description: input.description || '', amount: numeric(input.amount), status: input.status || 'pago', method: input.method || 'DINHEIRO', date: input.date || isoToday() }; if (!expense.description || expense.amount <= 0) return bad(res, 'Descrição e valor são obrigatórios'); data.expenses.unshift(expense); writeData(data); return json(res, 201, expense); }
    if (pathname === '/api/finance/receivables' && method === 'GET') return json(res, 200, data.receivables);
    if (pathname.match(/^\/api\/finance\/receivables\/\d+$/) && method === 'PATCH') { const item = data.receivables.find(row => row.id === Number(pathname.split('/')[4])); if (!item) return notFound(res); const input = await body(req); if (input.status) { item.status = input.status; item.paidAmount = input.status === 'PAGA' ? item.amount : 0; } if (input.dueDate) item.dueDate = input.dueDate; writeData(data); return json(res, 200, item); }
    if (pathname === '/api/budgets' && method === 'GET') return json(res, 200, data.budgets);
    if (pathname === '/api/appointments' && method === 'GET') return json(res, 200, data.appointments);
    return notFound(res);
  } catch (error) { return json(res, 400, { error: error.message || 'Não foi possível concluir a operação' }); }
}

function serve(req, res) { const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname; const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''); const file = path.resolve(ROOT, requested); if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound(res); const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' }[path.extname(file)] || 'application/octet-stream'; res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(res); }
const server = http.createServer((req, res) => { if (req.url.startsWith('/api/')) handle(req, res); else serve(req, res); });
server.listen(PORT, '127.0.0.1', () => console.log(`Saúde e Vida disponível em http://127.0.0.1:${PORT}`));
