#!/usr/bin/env node
/**
 * Script de testes integrados — Estoque · Caixa · Movimentos · Agendamentos
 *
 * Uso:
 *   EMAIL=admin@master.com SENHA=suasenha node test-integrado.mjs
 *   (ou edite as constantes abaixo)
 */

const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const EMAIL = process.env.EMAIL ?? 'admin@master.com';
const SENHA = process.env.SENHA ?? '';

// ─── helpers ────────────────────────────────────────────────────────────────

const G = '\x1b[32m✓\x1b[0m';
const R = '\x1b[31m✗\x1b[0m';
const Y = '\x1b[33m⚠\x1b[0m';
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let token = '';
let empresaId = null;
let passed = 0;
let failed = 0;
let skipped = 0;

const api = async (method, path, body, extraHeaders = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, data: json };
};

const ok = (label, condition, detail = '') => {
    if (condition) {
        console.log(`  ${G} ${label}`);
        passed++;
    } else {
        console.log(`  ${R} ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
};

const skip = (label) => {
    console.log(`  ${Y} SKIP ${label}`);
    skipped++;
};

const section = (title) => console.log(`\n${BOLD(title)}`);

// ─── 1. Auth ────────────────────────────────────────────────────────────────

section('1. Autenticação');

if (!SENHA) {
    console.log(`  ${R} Defina a variável SENHA para rodar os testes.\n  Ex: SENHA=minhasenha node test-integrado.mjs`);
    process.exit(1);
}

let loginData;
{
    const r = await api('POST', '/auth/login', { email: EMAIL, senha: SENHA });
    ok('Login retorna token', r.status === 200 && r.data?.token, `status ${r.status}`);
    if (!r.data?.token) { console.log('\n  Sem token — abortando.\n'); process.exit(1); }
    token = r.data.token;
    empresaId = r.data?.user?.empresa_id ?? null;
    loginData = r.data;
}

// ─── 2. Produtos / Estoque ──────────────────────────────────────────────────

section('2. Produtos & Estoque');

let produtoId = null;
let estoqueInicial = null;

{
    const r = await api('GET', '/products');
    ok('GET /products retorna lista', r.status === 200 && Array.isArray(r.data));

    const comEstoque = r.data.find(p => Number(p.currentQuantity) > 0);
    if (comEstoque) {
        produtoId = comEstoque.id;
        estoqueInicial = Number(comEstoque.currentQuantity);
        ok(`Produto com estoque encontrado (id=${produtoId}, qty=${estoqueInicial})`, true);
    } else {
        skip('Nenhum produto com estoque disponível — testes de venda pulados');
    }
}

// ─── 3. Matéria-Prima ───────────────────────────────────────────────────────

section('3. Matéria-Prima');

let mpId = null;
let mpEstoqueInicial = null;

{
    const r = await api('GET', '/raw-materials');
    ok('GET /raw-materials retorna lista', r.status === 200 && Array.isArray(r.data));

    const comEstoque = r.data.find(m => Number(m.currentQuantity) > 0);
    if (comEstoque) {
        mpId = comEstoque.id;
        mpEstoqueInicial = Number(comEstoque.currentQuantity);
        ok(`Matéria-prima com estoque (id=${mpId}, qty=${mpEstoqueInicial})`, true);
    } else {
        skip('Nenhuma matéria-prima com estoque');
    }
}

// ─── 4. Fluxo Venda → Edição → Movimentos ──────────────────────────────────

section('4. Caixa — Criar, Editar e verificar Movimentos');

let vendaId = null;

if (!produtoId) {
    skip('Sem produto — pulando fluxo de venda');
} else {
    // Buscar ou criar funcionário (usa o próprio usuário logado)
    const funcionarioId = loginData?.user?.id;

    // 4a. Criar venda
    const payload = {
        forma_pagamento: 'DINHEIRO',
        pagamentos: [{ forma: 'DINHEIRO', valor: 10 }],
        valor_total: 10,
        funcionario_id: funcionarioId,
        itens: [{ produto_id: produtoId, quantidade: 1, valor_unitario: 10, valor_total: 10 }],
    };

    const rc = await api('POST', '/vendas', payload);
    ok('POST /vendas cria venda', rc.status === 201 || rc.status === 200, `status ${rc.status} — ${JSON.stringify(rc.data).slice(0,120)}`);
    vendaId = rc.data?.id ?? rc.data?.venda?.id ?? null;

    if (vendaId) {
        // 4b. Verificar estoque baixou
        const rp = await api('GET', '/products');
        const prodAtual = rp.data.find(p => p.id === produtoId);
        const estoqueAposCriacao = Number(prodAtual?.currentQuantity);
        ok(`Estoque baixou após criação (${estoqueInicial} → ${estoqueAposCriacao})`,
            estoqueAposCriacao === estoqueInicial - 1);

        // 4c. Verificar movimento criado
        const rm = await api('GET', `/movimentos?empresa_id=${empresaId ?? ''}`);
        const movimentos = Array.isArray(rm.data) ? rm.data : (rm.data?.movimentos ?? []);
        const movVenda = movimentos.filter(m => m.origem_tipo === 'venda' && m.origem_id == vendaId);
        ok(`Movimento de saída criado (${movVenda.length} registro(s))`,
            movVenda.length === 1, `encontrados: ${movVenda.length}`);

        // 4d. Editar venda (mesma qty, mesmo produto)
        const re = await api('PUT', `/vendas/${vendaId}`, {
            ...payload,
            observacao: 'editado pelo teste',
        });
        ok('PUT /vendas/:id edita venda', re.status === 200, `status ${re.status}`);

        // 4e. Verificar estoque manteve
        const rp2 = await api('GET', '/products');
        const prodAposEdicao = rp2.data.find(p => p.id === produtoId);
        ok(`Estoque mantido após edição (esperado ${estoqueInicial - 1}, atual ${Number(prodAposEdicao?.currentQuantity)})`,
            Number(prodAposEdicao?.currentQuantity) === estoqueInicial - 1);

        // 4f. Verificar movimentos NÃO duplicaram (o bug que foi corrigido)
        const rm2 = await api('GET', `/movimentos?empresa_id=${empresaId ?? ''}`);
        const movimentos2 = Array.isArray(rm2.data) ? rm2.data : (rm2.data?.movimentos ?? []);
        const movAposEdicao = movimentos2.filter(m => m.origem_tipo === 'venda' && m.origem_id == vendaId);
        ok(`Movimentos NÃO duplicaram após edição (esperado 1, encontrado ${movAposEdicao.length})`,
            movAposEdicao.length === 1, `bug fix: movimentos duplicados`);

        // 4g. Editar de novo (segunda edição — regressão)
        const re2 = await api('PUT', `/vendas/${vendaId}`, {
            ...payload,
            observacao: 'segunda edicao pelo teste',
        });
        ok('PUT /vendas/:id segunda edição', re2.status === 200, `status ${re2.status}`);

        const rm3 = await api('GET', `/movimentos?empresa_id=${empresaId ?? ''}`);
        const movimentos3 = Array.isArray(rm3.data) ? rm3.data : (rm3.data?.movimentos ?? []);
        const movApos2Edicao = movimentos3.filter(m => m.origem_tipo === 'venda' && m.origem_id == vendaId);
        ok(`Movimentos NÃO duplicaram após 2ª edição (esperado 1, encontrado ${movApos2Edicao.length})`,
            movApos2Edicao.length === 1);

        // 4h. Deletar venda e verificar estoque restaurou
        const rd = await api('DELETE', `/vendas/${vendaId}`);
        ok('DELETE /vendas/:id deleta venda', rd.status === 200 || rd.status === 204, `status ${rd.status}`);

        const rp3 = await api('GET', '/products');
        const prodAposDelete = rp3.data.find(p => p.id === produtoId);
        ok(`Estoque restaurado após delete (esperado ${estoqueInicial}, atual ${Number(prodAposDelete?.currentQuantity)})`,
            Number(prodAposDelete?.currentQuantity) === estoqueInicial);
    }
}

// ─── 5. Fluxo Venda com Matéria-Prima ──────────────────────────────────────

section('5. Caixa — Venda com Matéria-Prima');

// Helper: lê currentQuantity direto do RawMaterial (não do espelho Products)
const getMpQty = async (id) => {
    const r = await api('GET', `/raw-materials/${id}`);
    return Number(r.data?.currentQuantity ?? r.data?.data?.currentQuantity ?? NaN);
};

if (!mpId) {
    skip('Sem matéria-prima — pulando');
} else {
    const funcionarioId = loginData?.user?.id;
    const payload = {
        forma_pagamento: 'DINHEIRO',
        pagamentos: [{ forma: 'DINHEIRO', valor: 5 }],
        valor_total: 5,
        funcionario_id: funcionarioId,
        itens: [{ tipo: 'materia_prima', raw_material_id: mpId, quantidade: 1, valor_unitario: 5, valor_total: 5 }],
    };

    // estoque real antes (endpoint individual, não o espelho da lista)
    const mpQtyAntes = await getMpQty(mpId);

    const rc = await api('POST', '/vendas', payload);
    ok('POST /vendas com matéria-prima', rc.status === 201 || rc.status === 200, `status ${rc.status}`);
    const mpVendaId = rc.data?.id ?? rc.data?.venda?.id ?? null;

    if (mpVendaId) {
        const mpQtyAposCriacao = await getMpQty(mpId);
        ok(`Estoque matéria-prima baixou (${mpQtyAntes} → ${mpQtyAposCriacao})`,
            mpQtyAposCriacao === mpQtyAntes - 1);

        // edição — deve manter estoque
        const re = await api('PUT', `/vendas/${mpVendaId}`, {
            ...payload, observacao: 'editado mp',
        });
        ok('PUT edita venda com matéria-prima', re.status === 200, `status ${re.status}`);

        const mpQtyAposEdicao = await getMpQty(mpId);
        ok(`Estoque matéria-prima mantido após edição (esperado ${mpQtyAntes - 1}, atual ${mpQtyAposEdicao})`,
            mpQtyAposEdicao === mpQtyAntes - 1);

        // limpa
        await api('DELETE', `/vendas/${mpVendaId}`);
        const mpQtyAposDelete = await getMpQty(mpId);
        ok(`Estoque matéria-prima restaurado após delete (esperado ${mpQtyAntes}, atual ${mpQtyAposDelete})`,
            mpQtyAposDelete === mpQtyAntes);
    }
}

// ─── 6. Inventário ──────────────────────────────────────────────────────────

section('6. Inventário');

{
    const r = await api('GET', '/inventarios');
    ok('GET /inventarios retorna lista', r.status === 200 && (Array.isArray(r.data) || typeof r.data === 'object'),
        `status ${r.status}`);
}

// ─── 7. Agendamentos — Bloqueio de Dia ──────────────────────────────────────

section('7. Agendamentos — Bloqueio de Dia');

{
    const hoje = new Date().toISOString().slice(0, 10);

    // buscar colaborador
    const ru = await api('GET', '/agendamentos/colaboradores');
    const colaboradores = Array.isArray(ru.data) ? ru.data : (ru.data?.data ?? []);
    const colab = colaboradores[0];

    if (!colab) {
        skip('Sem colaboradores cadastrados na agenda para testar bloqueio');
    } else {
        const bloqueioPayload = {
            colaboradorId: colab.id,
            data: hoje,
            motivo: 'Teste automatizado',
        };

        const rb = await api('POST', '/agendamentos/bloqueios', bloqueioPayload);
        ok('POST /agendamentos/bloqueios cria bloqueio', rb.status === 200 || rb.status === 201, `status ${rb.status}`);

        const rl = await api('GET', `/agendamentos/bloqueios?data=${hoje}`);
        const lista = Array.isArray(rl.data) ? rl.data : [];
        ok('GET /agendamentos/bloqueios retorna bloqueio criado',
            lista.some(b => b.colaboradorId == colab.id || b.colaborador_id == colab.id));

        const rd = await api('DELETE', '/agendamentos/bloqueios', {
            colaboradorId: colab.id,
            data: hoje,
        });
        ok('DELETE /agendamentos/bloqueios remove bloqueio', rd.status === 200 || rd.status === 204, `status ${rd.status}`);

        const rl2 = await api('GET', `/agendamentos/bloqueios?data=${hoje}`);
        const lista2 = Array.isArray(rl2.data) ? rl2.data : [];
        ok('Bloqueio removido da lista',
            !lista2.some(b => b.colaboradorId == colab.id || b.colaborador_id == colab.id));
    }
}

// ─── 8. Clientes (garantirCliente) ──────────────────────────────────────────

section('8. Clientes — criação automática via agendamento');

{
    const r = await api('GET', '/clientes');
    const clientesList = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
    ok('GET /clientes retorna lista', r.status === 200 && Array.isArray(clientesList), `status ${r.status}`);

    // cria agendamento com cliente novo (sem clienteId, só nome+fone)
    const ru = await api('GET', '/agendamentos/colaboradores');
    const colaboradores = Array.isArray(ru.data) ? ru.data : (ru.data?.data ?? []);
    const colab = colaboradores[0];

    if (!colab) {
        skip('Sem colaboradores para testar criação de cliente via agendamento');
    } else {
        const fone = `119${Math.floor(Math.random() * 90000000 + 10000000)}`;
        const agPayload = {
            colaboradorId: colab.id,
            clienteNome: 'Cliente Teste Auto',
            clienteTelefone: fone,
            servicoNome: 'Teste',
            data: new Date().toISOString().slice(0, 10),
            horario: '10:00',
            duracaoMin: 30,
            status: 'aguardando',
        };

        const ra = await api('POST', '/agendamentos', agPayload);
        ok('POST /agendamentos cria agendamento sem clienteId', ra.status === 200 || ra.status === 201, `status ${ra.status}`);

        // verifica se cliente foi criado
        const rc = await api('GET', '/clientes');
        const listaClientes = Array.isArray(rc.data) ? rc.data : (rc.data?.data ?? []);
        const clienteCriado = listaClientes.find(c => c.telefone?.replace(/\D/g, '') === fone);
        ok('Cliente criado automaticamente na base', !!clienteCriado, `fone buscado: ${fone}`);
    }
}

// ─── Resultado ──────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`${BOLD('Resultado:')} ${G} ${passed} passou  ${R} ${failed} falhou  ${Y} ${skipped} pulado`);
console.log('─'.repeat(52));

if (failed > 0) process.exit(1);
