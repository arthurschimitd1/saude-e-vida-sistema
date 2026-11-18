/**
 * Teste completo do sistema LucroMais
 * Executa: node teste-sistema-completo.js
 * Requer backend rodando (default: http://localhost:5000)
 */

const BASE = process.env.API_URL || 'http://localhost:5000/api';
const MASTER_EMAIL = 'admin@master.com';
const MASTER_SENHA = 'mssolucoes123';

// ── helpers ─────────────────────────────────────────────────────────
let passou = 0, falhou = 0, pulou = 0;
const resultados = [];
const grupoAtual = { nome: '' };

async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(`${BASE}${path}`, opts);
        const data = await res.json().catch(() => null);
        return { status: res.status, data, ok: res.status >= 200 && res.status < 300 };
    } catch (e) {
        return { status: 0, data: null, ok: false, erro: e.message };
    }
}

function check(nome, ok, detalhe) {
    const s = ok ? 'PASS' : 'FAIL';
    if (ok) passou++; else falhou++;
    resultados.push({ grupo: grupoAtual.nome, nome, status: s, detalhe: detalhe || '' });
    const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

function skip(nome, motivo) {
    pulou++;
    resultados.push({ grupo: grupoAtual.nome, nome, status: 'SKIP', detalhe: motivo });
    console.log(`  \x1b[33m- ${nome} — ${motivo}\x1b[0m`);
}

function grupo(nome) {
    grupoAtual.nome = nome;
    console.log(`\n\x1b[1m═══ ${nome} ═══\x1b[0m`);
}

// ── estado global ───────────────────────────────────────────────────
let masterToken = null;
let empresaId = null;
let donoToken = null;
let donoId = null;
let vendedorToken = null;
let vendedorId = null;

// IDs criados durante o teste (para cleanup)
const criados = {
    produto: null,
    categoria: null,
    cliente: null,
    materiaPrima: null,
    recorrencia: null,
    orcamento: null,
    pedido: null,
    funcionarioCusto: null,
    bairro: null,
    servico: null,
    contrato: null,
    departamento: null,
    centroCusto: null,
    receita: null,
    tarefa: null,
};

// ═══════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════

async function testarHealthCheck() {
    grupo('Health Check');
    const r1 = await req('GET', '/../');
    check('GET / (status)', r1.ok);
    const r2 = await req('GET', '/../health');
    check('GET /health', r2.ok);
}

async function testarAuth() {
    grupo('Autenticação');

    // Login master
    const r = await req('POST', '/auth/login', { email: MASTER_EMAIL, senha: MASTER_SENHA });
    check('Login master', r.ok && !!r.data?.token);
    if (r.ok) masterToken = r.data.token;

    // Login com credenciais erradas
    const r2 = await req('POST', '/auth/login', { email: 'naoexiste@x.com', senha: '123' });
    check('Login invalido retorna erro', !r2.ok);

    // Rota protegida sem token
    const r3 = await req('GET', '/users');
    check('Rota protegida sem token retorna 401', r3.status === 401);
}

async function criarEmpresaTeste() {
    grupo('Empresa Teste');

    const r = await req('POST', '/empresas', {
        nomeEmpresa: '__TESTE_SISTEMA_COMPLETO__',
        nomeCompleto: 'Dono Teste Sistema',
        email: 'dono_teste_sistema@teste.com',
        senha: 'Teste123',
        cpf: '999.999.999-99',
        cargo: 'Dono',
    }, masterToken);
    check('Criar empresa', r.ok && !!r.data?.empresaId, r.ok ? `id=${r.data.empresaId}` : JSON.stringify(r.data));
    if (r.ok) empresaId = r.data.empresaId;

    // Atribuir pacote 2 (completo)
    const PACOTE2 = [
        '/', '/dashboard',
        '/uikit/formlayout', '/uikit/overlay', '/uikit/producao', '/uikit/pedidos', '/uikit/agendamentos',
        '/uikit/button', '/uikit/tree', '/uikit/input', '/uikit/servicos', '/uikit/servicos-nfe', '/uikit/servicos-nfce', '/uikit/historico-notas',
        '/uikit/automacao-whatsapp',
        '/uikit/list', '/uikit/table', '/uikit/comissoes', '/uikit/notas-fiscais',
        '/financeiro/dashboard', '/financeiro/entradas', '/financeiro/saidas', '/financeiro/relatorios', '/uikit/crm', '/uikit/escola-financeiro',
        '/uikit/invalidstate', '/uikit/panel', '/uikit/media', '/uikit/integracao-focus',
        '/uikit/ponto',
        '/uikit/contratos', '/uikit/procuracoes',
        '/uikit/menu', '/uikit/message',
        '/uikit/prospeccao', '/uikit/prospeccao/dashboard', '/uikit/prospeccao/campanhas',
        '/uikit/prospeccao/historico', '/uikit/prospeccao/scripts', '/uikit/prospeccao/relatorios', '/uikit/prospeccao/configuracoes',
    ];
    const rp = await req('PUT', `/empresas/${empresaId}/permissoes`, { permissoes: PACOTE2 }, masterToken);
    check('Atribuir pacote 2', rp.ok);

    // Login dono
    const rl = await req('POST', '/auth/login', { email: 'dono_teste_sistema@teste.com', senha: 'Teste123', empresa_id: empresaId });
    check('Login dono', rl.ok && !!rl.data?.token);
    if (rl.ok) { donoToken = rl.data.token; donoId = rl.data.user?.id; }

    // Atualizar permissoes do dono
    if (donoId) {
        await req('PUT', `/users/${donoId}`, { permissoes: PACOTE2 }, masterToken);
    }
}

async function criarVendedorTeste() {
    grupo('Vendedor Teste');

    const r = await req('POST', '/users', {
        nomeCompleto: 'Vendedor Teste Sistema',
        email: 'vendedor_teste_sistema@teste.com',
        senha: 'Teste123',
        cpf: '888.888.888-88',
        cargo: 'Vendedor',
        empresa_id: empresaId,
        permissoes: ['/uikit/input', '/uikit/button', '/uikit/formlayout'],
    }, masterToken);
    check('Criar vendedor', r.ok || r.status === 200, r.ok ? '' : JSON.stringify(r.data));
    vendedorId = r.data?.id ?? r.data?.user?.id;

    const rl = await req('POST', '/auth/login', { email: 'vendedor_teste_sistema@teste.com', senha: 'Teste123', empresa_id: empresaId });
    check('Login vendedor', rl.ok);
    if (rl.ok) { vendedorToken = rl.data.token; vendedorId = vendedorId || rl.data.user?.id; }
}

async function testarUsuarios() {
    grupo('Usuários (CRUD)');

    const r1 = await req('GET', '/users', null, masterToken);
    check('Listar usuarios', r1.ok && Array.isArray(r1.data?.data ?? r1.data));

    if (donoId) {
        const r2 = await req('GET', `/users/${donoId}`, null, masterToken);
        check('Buscar usuario por ID', r2.ok);
    }

    if (vendedorId) {
        const r3 = await req('PUT', `/users/${vendedorId}`, { cargo: 'Vendedor Senior' }, masterToken);
        check('Atualizar usuario', r3.ok);
        // Reverter
        await req('PUT', `/users/${vendedorId}`, { cargo: 'Vendedor' }, masterToken);
    }

    // Vendedor nao pode listar todos
    const r4 = await req('GET', '/users', null, vendedorToken);
    check('Vendedor lista usuarios', r4.ok, `total=${(r4.data?.data ?? r4.data)?.length ?? 0}`);
}

async function testarEmpresas() {
    grupo('Empresas');

    const r1 = await req('GET', '/empresas', null, masterToken);
    check('Listar empresas (master)', r1.ok && Array.isArray(r1.data));

    const r2 = await req('GET', `/empresas/${empresaId}`, null, masterToken);
    check('Buscar empresa por ID', r2.ok);

    // Dono so ve a propria
    const r3 = await req('GET', '/empresas', null, donoToken);
    check('Dono lista empresas', r3.ok);
    const lista = Array.isArray(r3.data) ? r3.data : [];
    check('Dono ve apenas sua empresa', lista.length === 1 && lista[0]?.id === empresaId);

    // Cargos
    const r4 = await req('GET', `/empresas/${empresaId}/cargos`, null, donoToken);
    check('GET cargos', r4.ok);

    const r5 = await req('PUT', `/empresas/${empresaId}/cargos`, {
        cargos: [{ nome: 'Vendedor', permissoes: ['/uikit/input', '/uikit/button'] }]
    }, donoToken);
    check('PUT cargos', r5.ok);

    // Configuracoes
    const r6 = await req('GET', `/empresas/${empresaId}/configuracoes`, null, donoToken);
    check('GET configuracoes', r6.ok);

    const r7 = await req('PUT', `/empresas/${empresaId}/configuracoes`, {
        configuracoes: { exigir_senha_caixa: false }
    }, donoToken);
    check('PUT configuracoes', r7.ok);

    const r8 = await req('GET', `/empresas/${empresaId}/configuracoes`, null, vendedorToken);
    check('Vendedor le configuracoes', r8.ok);
    check('Config exigir_senha_caixa=false', r8.data?.exigir_senha_caixa === false);
}

async function testarCategorias() {
    grupo('Categorias de Produto');

    const r1 = await req('POST', '/product-categories', { name: '__CAT_TESTE__' }, donoToken);
    check('Criar categoria', r1.ok);
    criados.categoria = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/product-categories', null, donoToken);
    check('Listar categorias', r2.ok);

    if (criados.categoria) {
        const r3 = await req('PUT', `/product-categories/${criados.categoria}`, { name: '__CAT_TESTE_UP__' }, donoToken);
        check('Atualizar categoria', r3.ok);
    }
}

async function testarProdutos() {
    grupo('Produtos (CRUD)');

    const r1 = await req('POST', '/products', {
        name: '__PROD_TESTE__',
        price: 29.90,
        currentQuantity: 100,
        code: 'TST001',
        unidade_medida: 'UN',
        empresa_id: empresaId,
    }, donoToken);
    check('Criar produto', r1.ok);
    criados.produto = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/products', null, donoToken);
    check('Listar produtos', r2.ok);
    const prods = r2.data?.data ?? r2.data ?? [];
    check('Produtos retorna array', Array.isArray(prods));

    if (criados.produto) {
        const r3 = await req('PUT', `/products/${criados.produto}`, { price: 35.00 }, donoToken);
        check('Atualizar produto', r3.ok);
    }
}

async function testarClientes() {
    grupo('Clientes (CRUD)');

    const r1 = await req('POST', '/clientes', {
        nomeCompleto: '__CLIENTE_TESTE__',
        telefone: '11999999999',
        email: 'cliente_teste@teste.com',
        empresa_id: empresaId,
    }, donoToken);
    check('Criar cliente', r1.ok);
    criados.cliente = r1.data?.id ?? r1.data?.data?.id ?? r1.data?.cliente?.id;

    const r2 = await req('GET', '/clientes', null, donoToken);
    check('Listar clientes', r2.ok);

    if (criados.cliente) {
        const r3 = await req('GET', `/clientes/${criados.cliente}`, null, donoToken);
        check('Buscar cliente por ID', r3.ok);

        const r4 = await req('PUT', `/clientes/${criados.cliente}`, { telefone: '11888888888' }, donoToken);
        check('Atualizar cliente', r4.ok);
    }
}

async function testarMateriaPrima() {
    grupo('Matéria Prima (CRUD)');

    const r1 = await req('POST', '/raw-materials', {
        name: '__MP_TESTE__',
        unit: 'KG',
        quantity: 50,
        min_quantity: 5,
        cost: 10.00,
        empresa_id: empresaId,
    }, donoToken);
    check('Criar materia prima', r1.ok);
    criados.materiaPrima = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/raw-materials', null, donoToken);
    check('Listar materias primas', r2.ok);

    if (criados.materiaPrima) {
        const r3 = await req('PUT', `/raw-materials/${criados.materiaPrima}`, { cost: 12.50 }, donoToken);
        check('Atualizar materia prima', r3.ok);
    }
}

async function testarProducao() {
    grupo('Produção (Receitas e Ordens)');

    const r1 = await req('GET', '/producao/receitas', null, donoToken);
    check('Listar receitas', r1.ok);

    const r2 = await req('GET', '/producao/ordens', null, donoToken);
    check('Listar ordens', r2.ok);
}

async function testarVendas() {
    grupo('Vendas (CRUD)');

    const r1 = await req('GET', '/vendas', null, donoToken);
    check('Listar vendas', r1.ok);

    // Criar venda simples
    if (criados.produto) {
        const r2 = await req('POST', '/vendas', {
            itens: [{ produto_id: criados.produto, quantidade: 2, preco_unitario: 29.90 }],
            forma_pagamento: 'dinheiro',
            total: 59.80,
            empresa_id: empresaId,
        }, donoToken);
        check('Criar venda', r2.ok, !r2.ok ? JSON.stringify(r2.data) : '');
    } else {
        skip('Criar venda', 'produto nao criado');
    }
}

async function testarMovimentos() {
    grupo('Movimentos de Estoque');

    const r1 = await req('GET', '/movimentos', null, donoToken);
    check('Listar movimentos', r1.ok);
    const movs = r1.data?.data ?? r1.data ?? [];
    check('Movimentos retorna array', Array.isArray(movs));
}

async function testarOrcamentos() {
    grupo('Orçamentos (CRUD)');

    const r1 = await req('POST', '/orcamentos', {
        cliente_nome: '__CLIENTE_ORC__',
        itens: [{ descricao: 'Servico teste', quantidade: 1, valor_unitario: 100 }],
        total: 100,
        empresa_id: empresaId,
    }, donoToken);
    check('Criar orcamento', r1.ok);
    criados.orcamento = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/orcamentos', null, donoToken);
    check('Listar orcamentos', r2.ok);
}

async function testarPedidos() {
    grupo('Pedidos (CRUD)');

    const r1 = await req('POST', '/pedidos', {
        cliente_nome: '__CLIENTE_PED__',
        itens: [{ produto_id: criados.produto, quantidade: 1, preco_unitario: 29.90, nome: '__PROD_TESTE__' }],
        total: 29.90,
        status: 'pendente',
        empresa_id: empresaId,
    }, donoToken);
    check('Criar pedido', r1.ok, !r1.ok ? JSON.stringify(r1.data) : '');
    criados.pedido = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/pedidos', null, donoToken);
    check('Listar pedidos', r2.ok);
}

async function testarComissoes() {
    grupo('Comissões');

    const r1 = await req('GET', '/comissoes', null, donoToken);
    check('Listar comissoes', r1.ok);

    const r2 = await req('GET', '/comissoes/resumo', null, donoToken);
    check('Resumo comissoes', r2.ok);
}

async function testarRecorrencias() {
    grupo('Recorrências');

    const r1 = await req('POST', '/recorrencias', {
        descricao: '__REC_TESTE__',
        valor: 99.90,
        tipo: 'mensal',
        dia_cobranca: 15,
        empresa_id: empresaId,
    }, donoToken);
    check('Criar recorrencia', r1.ok);
    criados.recorrencia = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/recorrencias', null, donoToken);
    check('Listar recorrencias', r2.ok);

    if (criados.recorrencia) {
        const r3 = await req('PATCH', `/recorrencias/${criados.recorrencia}/toggle-status`, null, donoToken);
        check('Toggle status recorrencia', r3.ok);
    }
}

async function testarFinanceiro() {
    grupo('Financeiro');

    const r1 = await req('GET', '/financeiro/resumo', null, donoToken);
    check('Resumo financeiro', r1.ok);

    const r2 = await req('GET', '/financeiro/dashboard', null, donoToken);
    check('Dashboard financeiro', r2.ok);

    const r3 = await req('GET', '/financeiro/entradas', null, donoToken);
    check('Entradas consolidadas', r3.ok);

    const r4 = await req('GET', '/financeiro/saidas-consolidado', null, donoToken);
    check('Saidas consolidadas', r4.ok);

    const r5 = await req('GET', '/financeiro/vendas', null, donoToken);
    check('Vendas financeiro', r5.ok);
}

async function testarSaidas() {
    grupo('Saídas (Despesas)');

    const r1 = await req('POST', '/saidas', {
        descricao: '__SAIDA_TESTE__',
        valor: 150,
        categoria: 'Fornecedores',
        data_vencimento: new Date().toISOString().slice(0, 10),
        empresa_id: empresaId,
    }, donoToken);
    check('Criar saida', r1.ok, !r1.ok ? JSON.stringify(r1.data) : '');

    const r2 = await req('GET', '/saidas', null, donoToken);
    check('Listar saidas', r2.ok);
}

async function testarFuncionariosCustos() {
    grupo('Funcionários Custos');

    const r1 = await req('POST', '/funcionarios-custos', {
        nome: '__FUNC_CUSTO_TESTE__',
        cargo: 'Operador',
        salario: 2500,
        empresa_id: empresaId,
    }, donoToken);
    check('Criar funcionario custo', r1.ok);
    criados.funcionarioCusto = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/funcionarios-custos', null, donoToken);
    check('Listar funcionarios custos', r2.ok);
}

async function testarPonto() {
    grupo('Controle de Ponto');

    const r1 = await req('GET', '/attendance', null, donoToken);
    check('Listar registros ponto', r1.ok);
}

async function testarBairros() {
    grupo('Bairros (Taxas de entrega)');

    const r1 = await req('POST', '/bairros', { nome: '__BAIRRO_TESTE__', taxa: 8.50 }, donoToken);
    check('Criar bairro', r1.ok);
    criados.bairro = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/bairros', null, donoToken);
    check('Listar bairros', r2.ok);
}

async function testarServicos() {
    grupo('Serviços');

    const r1 = await req('POST', '/services', {
        nome: '__SERVICO_TESTE__',
        valor: 200,
        empresa_id: empresaId,
    }, donoToken);
    check('Criar servico', r1.ok);
    criados.servico = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/services', null, donoToken);
    check('Listar servicos', r2.ok);
}

async function testarTurnosCaixa() {
    grupo('Turnos de Caixa');

    const r1 = await req('GET', '/turnos-caixa', null, donoToken);
    check('Listar turnos', r1.ok);
}

async function testarCalendario() {
    grupo('Calendário');

    const r1 = await req('GET', '/calendario', null, donoToken);
    check('Listar eventos', r1.ok);

    const r2 = await req('GET', '/calendario/proximos', null, donoToken);
    check('Proximos eventos', r2.ok);
}

async function testarAgendamentos() {
    grupo('Agendamentos');

    const r1 = await req('GET', '/agendamentos', null, donoToken);
    check('Listar agendamentos', r1.ok);

    const r2 = await req('GET', '/agendamentos/colaboradores', null, donoToken);
    check('Listar colaboradores agendamento', r2.ok);

    const r3 = await req('GET', '/agendamentos/servicos', null, donoToken);
    check('Listar servicos agendamento', r3.ok);
}

async function testarPlanejamento() {
    grupo('Planejamento (Tarefas)');

    const r1 = await req('POST', '/planejamento', {
        titulo: '__TAREFA_TESTE__',
        descricao: 'Tarefa de teste automatizado',
        status: 'pendente',
        empresa_id: empresaId,
    }, donoToken);
    check('Criar tarefa', r1.ok);
    criados.tarefa = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/planejamento', null, donoToken);
    check('Listar tarefas', r2.ok);

    const r3 = await req('GET', '/kanban-colunas', null, donoToken);
    check('Listar colunas kanban', r3.ok);

    const r4 = await req('GET', '/setores-planejamento', null, donoToken);
    check('Listar setores', r4.ok);
}

async function testarMarketing() {
    grupo('Marketing');

    const r1 = await req('GET', '/marketing', null, donoToken);
    check('Listar projetos marketing', r1.ok);
}

async function testarContratos() {
    grupo('Contratos');

    const r1 = await req('GET', '/contratos', null, donoToken);
    check('Listar contratos', r1.ok);
}

async function testarProcuracoes() {
    grupo('Procurações');

    const r1 = await req('GET', '/procuracoes', null, donoToken);
    check('Listar procuracoes', r1.ok);
}

async function testarNotasFiscais() {
    grupo('Notas Fiscais');

    const r1 = await req('GET', '/notas-fiscais', null, donoToken);
    check('Listar notas fiscais', r1.ok);

    const r2 = await req('GET', '/focus-nfe', null, donoToken);
    check('Listar NF-e', r2.ok);

    const r3 = await req('GET', '/focus-nfce', null, donoToken);
    check('Listar NFC-e', r3.ok);
}

async function testarCRM() {
    grupo('CRM Comercial');

    const r1 = await req('GET', '/crm/campanhas', null, donoToken);
    check('Listar campanhas', r1.ok);

    const r2 = await req('GET', '/crm/prospects', null, donoToken);
    check('Listar prospects', r2.ok);

    const r3 = await req('GET', '/crm/scripts', null, donoToken);
    check('Listar scripts', r3.ok);

    const r4 = await req('GET', '/crm/dashboard', null, donoToken);
    check('Dashboard CRM', r4.ok);

    const r5 = await req('GET', '/crm/interacoes', null, donoToken);
    check('Listar interacoes', r5.ok);
}

async function testarDepartamentos() {
    grupo('Departamentos');

    const r1 = await req('POST', '/departamentos', { nome: '__DEPTO_TESTE__', empresa_id: empresaId }, donoToken);
    check('Criar departamento', r1.ok);
    criados.departamento = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/departamentos', null, donoToken);
    check('Listar departamentos', r2.ok);
}

async function testarCentrosCusto() {
    grupo('Centros de Custo');

    const r1 = await req('POST', '/centros-de-custos', {
        nome: '__CC_TESTE__',
        descricao: 'Centro teste',
        empresa_id: empresaId,
    }, donoToken);
    check('Criar centro de custo', r1.ok);
    criados.centroCusto = r1.data?.id ?? r1.data?.data?.id;

    const r2 = await req('GET', '/centros-de-custos', null, donoToken);
    check('Listar centros de custo', r2.ok);
}

async function testarAutomacao() {
    grupo('Automação');

    const r1 = await req('GET', '/automacao', null, donoToken);
    check('Listar regras automacao', r1.ok);

    const r2 = await req('GET', '/automacao/resumo', null, donoToken);
    check('Resumo automacao', r2.ok);

    const r3 = await req('GET', '/automacao/templates', null, donoToken);
    check('Templates automacao', r3.ok);
}

async function testarInventarios() {
    grupo('Inventários');

    const r1 = await req('GET', '/inventarios', null, donoToken);
    check('Listar inventarios', r1.ok);
}

async function testarClienteRecorrencias() {
    grupo('Cliente Recorrências');

    const r1 = await req('GET', '/cliente-recorrencias/clientes-recorrencias', null, donoToken);
    check('Listar clientes com recorrencias', r1.ok);

    const r2 = await req('GET', '/cliente-recorrencias/dashboard-faturamento', null, donoToken);
    check('Dashboard faturamento', r2.ok);
}

async function testarPermissoes() {
    grupo('Permissões e FLAGS_INTERNAS');

    const FLAGS = ['ponto:todos', 'planejamento:todos', 'agendamento:todos', 'senha:ver', 'caixa:pular_senha'];

    for (const flag of FLAGS) {
        const r = await req('PUT', `/users/${vendedorId}`, {
            permissoes: ['/uikit/input', '/uikit/button', flag]
        }, masterToken);
        check(`Flag ${flag} aceita`, r.ok, !r.ok ? JSON.stringify(r.data) : '');
    }

    // Rota fora do pacote
    const r = await req('PUT', `/users/${vendedorId}`, {
        permissoes: ['/uikit/input', '/uikit/contabil-fiscal/dashboard']
    }, donoToken);
    check('Bloqueia rota fora do pacote', r.status === 403);

    // Restaurar
    await req('PUT', `/users/${vendedorId}`, {
        permissoes: ['/uikit/input', '/uikit/button', '/uikit/formlayout']
    }, masterToken);
}

async function testarIsolamentoMultitenant() {
    grupo('Isolamento Multi-tenant');

    // Vendedor nao pode acessar empresa diferente
    const r1 = await req('GET', '/empresas/99999', null, vendedorToken);
    check('Vendedor nao acessa outra empresa', r1.status === 403);

    // Vendedor nao pode alterar config de outra empresa
    const r2 = await req('PUT', '/empresas/99999/configuracoes', {
        configuracoes: { teste: true }
    }, vendedorToken);
    check('Vendedor nao altera config de outra empresa', r2.status === 403);
}

// ── CLEANUP ─────────────────────────────────────────────────────────
async function limpar() {
    grupo('Limpeza');

    // Deletar registros criados (ordem inversa de dependencia)
    const deletes = [
        ['tarefa', '/planejamento'],
        ['departamento', '/departamentos'],
        ['centroCusto', '/centros-de-custos'],
        ['servico', '/services'],
        ['bairro', '/bairros'],
        ['funcionarioCusto', '/funcionarios-custos'],
        ['recorrencia', '/recorrencias'],
        ['materiaPrima', '/raw-materials'],
        ['cliente', '/clientes'],
        ['produto', '/products'],
        ['categoria', '/product-categories'],
    ];

    for (const [key, path] of deletes) {
        if (criados[key]) {
            const r = await req('DELETE', `${path}/${criados[key]}`, null, masterToken);
            check(`Deletar ${key}`, r.ok, !r.ok ? `status=${r.status}` : '');
        }
    }

    // Deletar empresa (cascade)
    if (empresaId) {
        const r = await req('DELETE', `/empresas/${empresaId}`, null, masterToken);
        check('Deletar empresa teste', r.ok);
    }
}

// ── RELATÓRIO ───────────────────────────────────────────────────────
function gerarRelatorio() {
    const total = passou + falhou + pulou;
    const pct = total > 0 ? ((passou / total) * 100).toFixed(1) : 0;

    console.log('\n' + '═'.repeat(60));
    console.log('\x1b[1m  RELATÓRIO FINAL — Teste Completo do Sistema\x1b[0m');
    console.log('═'.repeat(60));
    console.log(`  Data:    ${new Date().toLocaleString('pt-BR')}`);
    console.log(`  Backend: ${BASE}`);
    console.log('─'.repeat(60));
    console.log(`  Total:   ${total} testes`);
    console.log(`  \x1b[32mPassou:  ${passou}\x1b[0m`);
    console.log(`  \x1b[31mFalhou:  ${falhou}\x1b[0m`);
    console.log(`  \x1b[33mPulou:   ${pulou}\x1b[0m`);
    console.log(`  Taxa:    ${pct}%`);
    console.log('─'.repeat(60));

    // Resumo por grupo
    const grupos = [...new Set(resultados.map(r => r.grupo))];
    console.log('\n  Por módulo:');
    for (const g of grupos) {
        const gResults = resultados.filter(r => r.grupo === g);
        const gPass = gResults.filter(r => r.status === 'PASS').length;
        const gFail = gResults.filter(r => r.status === 'FAIL').length;
        const gSkip = gResults.filter(r => r.status === 'SKIP').length;
        const icon = gFail > 0 ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
        console.log(`  ${icon} ${g}: ${gPass}/${gResults.length}${gFail > 0 ? ` (${gFail} falhas)` : ''}${gSkip > 0 ? ` (${gSkip} pulados)` : ''}`);
    }

    if (falhou > 0) {
        console.log('\n\x1b[31m  Falhas:\x1b[0m');
        resultados.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  \x1b[31m✗\x1b[0m [${r.grupo}] ${r.nome}${r.detalhe ? ` — ${r.detalhe}` : ''}`);
        });
    }

    console.log('\n' + '═'.repeat(60) + '\n');
}

// ── MAIN ────────────────────────────────────────────────────────────
async function main() {
    console.log('\x1b[1m\nTeste Completo do Sistema LucroMais\x1b[0m');
    console.log(`Backend: ${BASE}`);
    console.log(`Inicio: ${new Date().toLocaleString('pt-BR')}\n`);

    await testarHealthCheck();
    await testarAuth();
    await criarEmpresaTeste();
    await criarVendedorTeste();
    await testarUsuarios();
    await testarEmpresas();
    await testarPermissoes();
    await testarIsolamentoMultitenant();
    await testarCategorias();
    await testarProdutos();
    await testarClientes();
    await testarMateriaPrima();
    await testarProducao();
    await testarVendas();
    await testarMovimentos();
    await testarOrcamentos();
    await testarPedidos();
    await testarComissoes();
    await testarRecorrencias();
    await testarFinanceiro();
    await testarSaidas();
    await testarFuncionariosCustos();
    await testarPonto();
    await testarBairros();
    await testarServicos();
    await testarTurnosCaixa();
    await testarCalendario();
    await testarAgendamentos();
    await testarPlanejamento();
    await testarMarketing();
    await testarContratos();
    await testarProcuracoes();
    await testarNotasFiscais();
    await testarCRM();
    await testarDepartamentos();
    await testarCentrosCusto();
    await testarAutomacao();
    await testarInventarios();
    await testarClienteRecorrencias();
    await limpar();
    gerarRelatorio();

    process.exit(falhou > 0 ? 1 : 0);
}

main().catch(e => { console.error('Erro fatal:', e); process.exit(1); });
