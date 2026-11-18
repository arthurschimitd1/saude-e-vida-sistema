/**
 * Script de teste de carga — LucroMais
 * Simula múltiplos usuários fazendo vendas simultâneas
 *
 * Uso: node teste-carga.js <URL_BASE_API>
 * Ex:  node teste-carga.js https://seu-backend.vercel.app/api
 */

const API = process.argv[2];
if (!API) {
    console.error('❌  Informe a URL da API: node teste-carga.js <URL_BASE_API>');
    process.exit(1);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const post = (path, body, token) =>
    fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    }).then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(data.error ?? data.message ?? r.statusText), { status: r.status, data });
        return data;
    });

const get = (path, token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API}${path}${qs ? '?' + qs : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(data.error ?? data.message ?? r.statusText), { status: r.status });
        return data;
    });
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const fmt = ms => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

// ─── login ────────────────────────────────────────────────────────────────────

async function login(email, senha) {
    const t0 = Date.now();
    const res = await post('/auth/login', { email, senha });
    return { token: res.token ?? res.data?.token, user: res.user ?? res.data?.user, latency: Date.now() - t0 };
}

// ─── criar conta de teste ─────────────────────────────────────────────────────

async function criarConta(adminToken, idx, empresaId) {
    const email = `teste_carga_${idx}_${Date.now()}@lucromais.test`;
    const senha = 'Teste@123';
    try {
        await post('/users', {
            nomeCompleto: `Usuário Carga ${idx}`,
            email,
            senha,
            cargo: 'Vendedor',
            tipo: 'USUARIO',
            empresa_id: empresaId,
        }, adminToken);
        return { email, senha };
    } catch (e) {
        console.warn(`  ⚠  Não foi possível criar conta ${idx}: ${e.message}`);
        return null;
    }
}

// ─── buscar dados necessários para a venda ────────────────────────────────────

async function buscarDadosVenda(token, empresaId) {
    const [produtos, funcionarios] = await Promise.all([
        get('/products', token, empresaId ? { empresa_id: empresaId } : {}),
        get('/users', token, empresaId ? { empresa_id: empresaId } : {}),
    ]);

    const listaProdutos = Array.isArray(produtos?.data ?? produtos) ? (produtos?.data ?? produtos) : [];
    const listaFuncs = Array.isArray(funcionarios?.data ?? funcionarios) ? (funcionarios?.data ?? funcionarios) : [];

    const produtosValidos = listaProdutos.filter(p =>
        Number(p.currentQuantity ?? p.estoque ?? 0) >= 1 && Number(p.price ?? p.preco ?? 0) > 0
    );

    const funcValidos = listaFuncs.filter(u => u.tipo !== 'MASTER');

    return { produtosValidos, funcValidos };
}

// ─── fazer uma venda ──────────────────────────────────────────────────────────

async function fazerVenda(token, produto, funcionario, empresaId) {
    const t0 = Date.now();
    const valor = Number(produto.price ?? produto.preco ?? 0);
    const payload = {
        forma_pagamento: 'DINHEIRO',
        pagamentos: [{ forma: 'DINHEIRO', valor }],
        valor_total: valor,
        cliente_id: null,
        funcionario_id: funcionario?.id ?? null,
        empresa_id: empresaId ?? undefined,
        com_nota: false,
        desconto: 0,
        tipo_desconto: 'valor',
        taxa_entrega: 0,
        data: new Date().toISOString(),
        itens: [{ produto_id: produto.id, quantidade: 1, valor_unitario: valor, valor_total: valor }],
    };
    const res = await post('/vendas', payload, token);
    return { id: res.id ?? res.venda?.id, latency: Date.now() - t0 };
}

// ─── runner de um usuário ─────────────────────────────────────────────────────

async function rodarUsuario(label, token, produto, funcionario, rodadas, empresaId) {
    const resultados = { label, ok: 0, erros: 0, latencias: [], falhas: [] };

    if (!produto) {
        resultados.falhas.push('DADOS: nenhum produto com estoque disponível');
        resultados.erros++;
        return resultados;
    }

    for (let i = 0; i < rodadas; i++) {
        try {
            const { latency } = await fazerVenda(token, produto, funcionario, empresaId);
            resultados.ok++;
            resultados.latencias.push(latency);
        } catch (e) {
            resultados.erros++;
            resultados.falhas.push(`VENDA #${i + 1}: ${e.message} (${e.status ?? '?'})`);
        }
    }

    return resultados;
}

// ─── relatório ────────────────────────────────────────────────────────────────

function relatorio(todos) {
    console.log('\n' + '═'.repeat(60));
    console.log('  RESULTADO DO TESTE DE CARGA');
    console.log('═'.repeat(60));

    let totalOk = 0, totalErros = 0, todasLatencias = [];

    for (const r of todos) {
        const avg = r.latencias.length
            ? fmt(Math.round(r.latencias.reduce((a, b) => a + b, 0) / r.latencias.length))
            : '—';
        const max = r.latencias.length ? fmt(Math.max(...r.latencias)) : '—';
        const status = r.erros === 0 ? '✅' : r.ok > 0 ? '⚠️ ' : '❌';
        console.log(`\n  ${status}  ${r.label}`);
        console.log(`      Vendas OK: ${r.ok} | Erros: ${r.erros} | Latência média: ${avg} | Máx: ${max}`);
        if (r.falhas.length) {
            r.falhas.slice(0, 3).forEach(f => console.log(`      ↳ ${f}`));
            if (r.falhas.length > 3) console.log(`      ↳ ... e mais ${r.falhas.length - 3} erros`);
        }
        totalOk += r.ok;
        totalErros += r.erros;
        todasLatencias.push(...r.latencias);
    }

    const avgGeral = todasLatencias.length
        ? fmt(Math.round(todasLatencias.reduce((a, b) => a + b, 0) / todasLatencias.length))
        : '—';
    const maxGeral = todasLatencias.length ? fmt(Math.max(...todasLatencias)) : '—';

    console.log('\n' + '─'.repeat(60));
    console.log(`  Total vendas OK: ${totalOk} | Total erros: ${totalErros}`);
    console.log(`  Latência média geral: ${avgGeral} | Pico: ${maxGeral}`);
    console.log('═'.repeat(60) + '\n');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🚀  Iniciando teste de carga`);
    console.log(`    API: ${API}`);
    console.log(`    Conta principal: gustavo@teste.com\n`);

    // 1. Login com a conta principal para descobrir empresa_id e criar contas extras
    console.log('1/3  Autenticando conta principal...');
    let adminToken, empresaId;
    try {
        const { token, user } = await login('gustavo@teste.com', '123123');
        adminToken = token;
        empresaId = user?.empresa_id ?? null;
        console.log(`     ✅  Login OK — empresa_id: ${empresaId ?? '(nenhuma)'}\n`);
    } catch (e) {
        console.error(`     ❌  Falha no login: ${e.message}`);
        process.exit(1);
    }

    // 2. Buscar produto e funcionário para usar em todas as vendas
    console.log('2/3  Buscando dados da conta...');
    let produto, funcionario;
    try {
        const { produtosValidos, funcValidos } = await buscarDadosVenda(adminToken, empresaId);
        produto = produtosValidos[0];
        funcionario = funcValidos[0];
        console.log(`     ✅  Produto: "${produto?.name ?? produto?.nome ?? '?'}" | Funcionário: "${funcionario?.nomeCompleto ?? '?'}"\n`);
    } catch (e) {
        console.error(`     ❌  Falha ao buscar dados: ${e.message}`);
        process.exit(1);
    }

    // 3. Disparar 20 workers em paralelo compartilhando o mesmo token,
    //    cada um fazendo 10 vendas = 200 vendas concorrentes
    console.log('3/3  Disparando 20 workers × 10 vendas = 200 requisições simultâneas...');
    const NUM_WORKERS = 20;
    const RODADAS_POR_USUARIO = 10;
    const tarefas = Array.from({ length: NUM_WORKERS }, (_, i) =>
        rodarUsuario(`worker_${i + 1}`, adminToken, produto, funcionario, RODADAS_POR_USUARIO, empresaId)
    );

    const t0 = Date.now();
    const resultados = await Promise.all(tarefas);
    const duracao = fmt(Date.now() - t0);

    console.log(`\n     ✅  Todas as tarefas concluídas em ${duracao}\n`);

    relatorio(resultados);
}

main().catch(e => {
    console.error('Erro inesperado:', e);
    process.exit(1);
});
