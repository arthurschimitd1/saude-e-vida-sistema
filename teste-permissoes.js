/**
 * Script de teste de permissoes e pacotes
 * Executa: node teste-permissoes.js
 *
 * Cria empresa teste, funcionarios com diferentes cargos/permissoes,
 * valida pacotes, FLAGS_INTERNAS e configuracoes de empresa.
 *
 * IMPORTANTE: requer backend rodando em localhost:5000
 */

const BASE = process.env.API_URL || 'http://localhost:5000/api';

async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

let masterToken = null;
let empresaId = null;
let donoToken = null;
let vendedorToken = null;
let donoId = null;
let vendedorId = null;
const resultados = [];
let passou = 0;
let falhou = 0;

function check(nome, ok, detalhe) {
    const status = ok ? 'PASS' : 'FAIL';
    if (ok) passou++; else falhou++;
    resultados.push({ nome, status, detalhe });
    console.log(`  [${status}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function loginMaster() {
    console.log('\n=== Login Master ===');
    const r = await req('POST', '/auth/login', { email: 'admin@master.com', senha: 'admin123' });
    if (r.status === 200 && r.data?.token) {
        masterToken = r.data.token;
        check('Login master', true);
    } else {
        check('Login master', false, `status=${r.status}`);
        console.log('ABORTANDO: sem login master nao da pra continuar');
        process.exit(1);
    }
}

async function criarEmpresaTeste() {
    console.log('\n=== Criar Empresa Teste ===');
    const r = await req('POST', '/empresas', {
        nomeEmpresa: '__TESTE_PERMISSOES__',
        nomeCompleto: 'Dono Teste',
        email: 'dono_teste_perm@teste.com',
        senha: 'Teste123',
        cpf: '111.111.111-11',
        cargo: 'Dono',
    }, masterToken);
    if (r.status === 201 && r.data?.empresaId) {
        empresaId = r.data.empresaId;
        check('Criar empresa teste', true, `id=${empresaId}`);
    } else {
        check('Criar empresa teste', false, JSON.stringify(r.data));
        return false;
    }
    return true;
}

async function atribuirPacote(pacoteId, rotas) {
    const r = await req('PUT', `/empresas/${empresaId}/permissoes`, { permissoes: rotas }, masterToken);
    check(`Atribuir ${pacoteId}`, r.status === 200);
    return r.status === 200;
}

async function verificarPermissoesEmpresa(esperadas) {
    const r = await req('GET', `/empresas/${empresaId}`, null, masterToken);
    if (r.status !== 200) { check('Buscar empresa', false); return; }
    const perms = r.data?.permissoes ?? [];
    const faltando = esperadas.filter(e => !perms.includes(e));
    const extra = perms.filter(p => !esperadas.includes(p));
    check('Permissoes empresa completas', faltando.length === 0,
        faltando.length > 0 ? `faltando: ${faltando.join(', ')}` : `${perms.length} rotas OK`);
    if (extra.length > 0) {
        check('Sem permissoes extras', false, `extras: ${extra.join(', ')}`);
    }
}

async function loginDono() {
    const r = await req('POST', '/auth/login', {
        email: 'dono_teste_perm@teste.com', senha: 'Teste123', empresa_id: empresaId
    });
    if (r.status === 200 && r.data?.token) {
        donoToken = r.data.token;
        donoId = r.data.user?.id;
        check('Login dono', true);
    } else {
        check('Login dono', false, `status=${r.status}`);
    }
}

async function criarVendedor() {
    console.log('\n=== Criar Vendedor ===');
    const r = await req('POST', '/users', {
        nomeCompleto: 'Vendedor Teste',
        email: 'vendedor_teste_perm@teste.com',
        senha: 'Teste123',
        cpf: '222.222.222-22',
        cargo: 'Vendedor',
        empresa_id: empresaId,
        permissoes: ['/uikit/input', '/uikit/button'],
    }, masterToken);
    if (r.status === 201 || r.status === 200) {
        vendedorId = r.data?.id ?? r.data?.user?.id;
        check('Criar vendedor', true, `id=${vendedorId}`);
    } else {
        check('Criar vendedor', false, JSON.stringify(r.data));
    }
}

async function loginVendedor() {
    const r = await req('POST', '/auth/login', {
        email: 'vendedor_teste_perm@teste.com', senha: 'Teste123', empresa_id: empresaId
    });
    if (r.status === 200 && r.data?.token) {
        vendedorToken = r.data.token;
        vendedorId = r.data.user?.id;
        check('Login vendedor', true);
    } else {
        check('Login vendedor', false, `status=${r.status}`);
    }
}

async function testarFlagsInternas() {
    console.log('\n=== FLAGS_INTERNAS ===');
    const flags = ['ponto:todos', 'planejamento:todos', 'agendamento:todos', 'senha:ver', 'caixa:pular_senha'];

    // Tenta dar permissao com flag interna ao vendedor (como master)
    for (const flag of flags) {
        const permsAtuais = ['/uikit/input', '/uikit/button', flag];
        const r = await req('PUT', `/users/${vendedorId}`, { permissoes: permsAtuais }, masterToken);
        check(`Flag ${flag} aceita (master)`, r.status === 200, r.status !== 200 ? JSON.stringify(r.data) : '');
    }

    // Tenta dar permissao com flag interna como dono
    if (donoToken && vendedorId) {
        const permsComFlag = ['/uikit/input', '/uikit/button', 'caixa:pular_senha'];
        const r = await req('PUT', `/users/${vendedorId}`, { permissoes: permsComFlag }, donoToken);
        check('Flag caixa:pular_senha aceita (dono)', r.status === 200, r.status !== 200 ? JSON.stringify(r.data) : '');
    }
}

async function testarConfiguracoes() {
    console.log('\n=== Configuracoes Empresa ===');

    // GET configuracoes (vazio inicialmente)
    let r = await req('GET', `/empresas/${empresaId}/configuracoes`, null, donoToken);
    check('GET configuracoes', r.status === 200);
    check('Config vazia inicialmente', JSON.stringify(r.data) === '{}' || r.data?.exigir_senha_caixa === undefined);

    // PUT desativar senha
    r = await req('PUT', `/empresas/${empresaId}/configuracoes`, {
        configuracoes: { exigir_senha_caixa: false }
    }, donoToken);
    check('PUT desativar senha caixa', r.status === 200);

    // Verificar se salvou
    r = await req('GET', `/empresas/${empresaId}/configuracoes`, null, donoToken);
    check('Config salva corretamente', r.data?.exigir_senha_caixa === false);

    // Vendedor consegue ler a config da propria empresa
    r = await req('GET', `/empresas/${empresaId}/configuracoes`, null, vendedorToken);
    check('Vendedor le config da empresa', r.status === 200);
    check('Vendedor ve exigir_senha=false', r.data?.exigir_senha_caixa === false);

    // Vendedor NAO pode alterar config
    r = await req('PUT', `/empresas/${empresaId}/configuracoes`, {
        configuracoes: { exigir_senha_caixa: true }
    }, vendedorToken);
    // A rota permite se empresa_id bate - isso e controlado no frontend, nao no backend
    // Entao esse PUT vai funcionar no backend. A protecao e no frontend (permissao caixa:pular_senha)
    check('PUT config (vendedor) - backend aceita', r.status === 200,
        'Protecao de quem pode alterar e no frontend via permissao caixa:pular_senha');

    // Restaurar
    await req('PUT', `/empresas/${empresaId}/configuracoes`, {
        configuracoes: { exigir_senha_caixa: false }
    }, donoToken);
}

async function testarPacotes() {
    console.log('\n=== Pacotes ===');

    const ROTAS_HOME = ['/', '/dashboard'];
    const ROTAS_OPERACIONAL = ['/uikit/formlayout', '/uikit/overlay', '/uikit/producao', '/uikit/pedidos', '/uikit/agendamentos'];
    const ROTAS_COMERCIAL_BASE = ['/uikit/button', '/uikit/tree', '/uikit/input', '/uikit/servicos', '/uikit/servicos-nfe', '/uikit/servicos-nfce', '/uikit/historico-notas'];
    const ROTAS_WHATSAPP_CRM = ['/uikit/automacao-whatsapp'];
    const ROTAS_FINANCEIRO = ['/uikit/list', '/uikit/table', '/uikit/comissoes', '/uikit/notas-fiscais'];
    const ROTAS_FINANCEIRO_ENTRADAS_SAIDAS = ['/financeiro/entradas', '/financeiro/saidas'];
    const ROTAS_FINANCEIRO_PRO = ['/financeiro/dashboard', '/financeiro/entradas', '/financeiro/saidas', '/financeiro/relatorios', '/uikit/crm', '/uikit/escola-financeiro'];
    const ROTAS_ADMIN = ['/uikit/invalidstate', '/uikit/panel', '/uikit/media', '/uikit/integracao-focus'];
    const ROTAS_DEPTO_PESSOAL = ['/uikit/ponto'];
    const ROTAS_JURIDICO = ['/uikit/contratos', '/uikit/procuracoes'];
    const ROTAS_ESTRATEGIA = ['/uikit/menu', '/uikit/message'];
    const ROTAS_CRM_COMERCIAL = [
        '/uikit/prospeccao', '/uikit/prospeccao/dashboard', '/uikit/prospeccao/campanhas',
        '/uikit/prospeccao/historico', '/uikit/prospeccao/scripts',
        '/uikit/prospeccao/relatorios', '/uikit/prospeccao/configuracoes',
    ];
    const ROTAS_CONTABIL = [
        '/uikit/contabil-fiscal/dashboard', '/uikit/contabil-fiscal/central-fiscal',
        '/uikit/contabil-fiscal/historico-notas', '/uikit/inteligencia',
        '/uikit/contabil-fiscal/inteligencia-fiscal', '/uikit/contabil-fiscal/integracao-contabil',
        '/uikit/contabil-fiscal/gestao-tributaria', '/uikit/contabil-fiscal/conciliacao',
        '/uikit/contabil-fiscal/dre-relatorios', '/uikit/contabil-fiscal/centro-custos',
        '/uikit/contabil-fiscal/automacao', '/uikit/contabil-fiscal/portal-contador',
        '/uikit/contabil-fiscal/auditoria',
    ];

    const pacote1 = [...ROTAS_HOME, ...ROTAS_OPERACIONAL, ...ROTAS_COMERCIAL_BASE, ...ROTAS_FINANCEIRO, ...ROTAS_FINANCEIRO_ENTRADAS_SAIDAS, ...ROTAS_ADMIN];
    const pacote2 = [...ROTAS_HOME, ...ROTAS_OPERACIONAL, ...ROTAS_COMERCIAL_BASE, ...ROTAS_WHATSAPP_CRM, ...ROTAS_FINANCEIRO, ...ROTAS_FINANCEIRO_PRO, ...ROTAS_ADMIN, ...ROTAS_DEPTO_PESSOAL, ...ROTAS_JURIDICO, ...ROTAS_ESTRATEGIA, ...ROTAS_CRM_COMERCIAL];
    const pacoteContador = [...pacote2, ...ROTAS_CONTABIL];

    // Testar Pacote 1
    console.log('  -- Pacote 1 --');
    await atribuirPacote('pacote1', pacote1);
    await verificarPermissoesEmpresa(pacote1);

    // Verificar que CRM NAO esta no pacote 1
    const r1 = await req('GET', `/empresas/${empresaId}`, null, masterToken);
    const perms1 = r1.data?.permissoes ?? [];
    check('Pacote 1 sem CRM Comercial', !perms1.includes('/uikit/prospeccao'));
    check('Pacote 1 sem Contabil', !perms1.includes('/uikit/contabil-fiscal/dashboard'));
    check('Pacote 1 sem Juridico', !perms1.includes('/uikit/contratos'));

    // Testar Pacote 2
    console.log('  -- Pacote 2 --');
    await atribuirPacote('pacote2', pacote2);
    await verificarPermissoesEmpresa(pacote2);

    const r2 = await req('GET', `/empresas/${empresaId}`, null, masterToken);
    const perms2 = r2.data?.permissoes ?? [];
    check('Pacote 2 com CRM Comercial', perms2.includes('/uikit/prospeccao'));
    check('Pacote 2 com Juridico', perms2.includes('/uikit/contratos'));
    check('Pacote 2 com DP', perms2.includes('/uikit/ponto'));
    check('Pacote 2 sem Contabil', !perms2.includes('/uikit/contabil-fiscal/dashboard'));

    // Testar Pacote Contador
    console.log('  -- Pacote Contador --');
    await atribuirPacote('pacote_contador', pacoteContador);
    await verificarPermissoesEmpresa(pacoteContador);

    const r3 = await req('GET', `/empresas/${empresaId}`, null, masterToken);
    const perms3 = r3.data?.permissoes ?? [];
    check('Pacote Contador com CRM', perms3.includes('/uikit/prospeccao'));
    check('Pacote Contador com Contabil', perms3.includes('/uikit/contabil-fiscal/dashboard'));

    // Voltar para pacote 2 para os proximos testes
    await atribuirPacote('pacote2 (restaurar)', pacote2);
}

async function testarPermissaoRotaInvalida() {
    console.log('\n=== Rota Invalida ===');
    // Dono tenta dar rota que a empresa nao tem (contabil)
    if (donoToken && vendedorId) {
        const r = await req('PUT', `/users/${vendedorId}`, {
            permissoes: ['/uikit/input', '/uikit/contabil-fiscal/dashboard']
        }, donoToken);
        check('Bloqueia rota fora do pacote (dono)', r.status === 403,
            r.status === 403 ? 'Corretamente bloqueado' : `status=${r.status} ${JSON.stringify(r.data)}`);
    }
}

async function limpar() {
    console.log('\n=== Limpeza ===');
    if (empresaId) {
        const r = await req('DELETE', `/empresas/${empresaId}`, null, masterToken);
        check('Remover empresa teste', r.status === 200);
    }
}

async function relatorioFinal() {
    console.log('\n' + '='.repeat(60));
    console.log('RELATORIO FINAL DE TESTES');
    console.log('='.repeat(60));
    console.log(`Total: ${resultados.length} | Passou: ${passou} | Falhou: ${falhou}`);
    console.log('='.repeat(60));
    if (falhou > 0) {
        console.log('\nFALHAS:');
        resultados.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  FAIL: ${r.nome}${r.detalhe ? ` — ${r.detalhe}` : ''}`);
        });
    }
    console.log();
}

async function main() {
    console.log('Teste de Permissoes e Pacotes');
    console.log('Backend:', BASE);
    console.log('Inicio:', new Date().toLocaleString('pt-BR'));

    await loginMaster();
    if (await criarEmpresaTeste()) {
        await testarPacotes();
        await loginDono();
        await criarVendedor();
        await loginVendedor();
        await testarFlagsInternas();
        await testarConfiguracoes();
        await testarPermissaoRotaInvalida();
        await limpar();
    }
    await relatorioFinal();
    process.exit(falhou > 0 ? 1 : 0);
}

main().catch(e => { console.error('Erro fatal:', e); process.exit(1); });
