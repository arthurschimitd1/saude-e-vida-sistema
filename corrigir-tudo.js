/**
 * corrigir-tudo.js — LucroMais
 * Executa: node corrigir-tudo.js
 *
 * 1. Detecta o pacote de cada empresa e re-aplica as rotas corretas
 *    (inclui /uikit/ponto em TODOS os pacotes)
 * 2. Reconcilia permissões de usuários com cargos customizados
 */

const axios = require('./backend/node_modules/axios').default;

const BASE   = 'http://localhost:3001/api';
const MASTER = { email: 'admin@master.com', senha: '123123' };

// ── Definição atualizada dos pacotes (igual ao gestao-empresas) ───────────
const ROTAS_HOME         = ['/'];
const ROTAS_OPERACIONAL  = ['/uikit/formlayout', '/uikit/overlay', '/uikit/producao', '/uikit/pedidos'];
const ROTAS_COMERCIAL    = ['/uikit/button', '/uikit/tree', '/uikit/input', '/uikit/servicos'];
const ROTAS_FINANCEIRO   = ['/uikit/list', '/uikit/table', '/uikit/comissoes', '/uikit/notas-fiscais'];
const ROTAS_ADMIN        = ['/uikit/invalidstate', '/uikit/panel', '/uikit/media', '/uikit/fiscalconfigempresas'];
const ROTAS_ESTRATEGIA   = ['/uikit/menu', '/uikit/message'];
const ROTAS_DEPTO_PESSOAL = ['/uikit/ponto'];
const ROTAS_ESTOQUE_ROUPAS = ['/uikit/estoque-roupas'];
const ROTAS_JURIDICO     = ['/uikit/contratos', '/uikit/procuracoes'];
const ROTAS_CONTABIL     = [
    '/uikit/contabil-fiscal/dashboard', '/uikit/contabil-fiscal/central-fiscal',
    '/uikit/contabil-fiscal/inteligencia-fiscal', '/uikit/contabil-fiscal/integracao-contabil',
    '/uikit/contabil-fiscal/gestao-tributaria', '/uikit/contabil-fiscal/conciliacao',
    '/uikit/contabil-fiscal/dre-relatorios', '/uikit/contabil-fiscal/centro-custos',
    '/uikit/contabil-fiscal/automacao', '/uikit/contabil-fiscal/portal-contador',
    '/uikit/contabil-fiscal/auditoria',
];
const ROTAS_CRM = [
    '/uikit/prospeccao', '/uikit/prospeccao/dashboard', '/uikit/prospeccao/campanhas',
    '/uikit/prospeccao/historico', '/uikit/prospeccao/scripts',
    '/uikit/prospeccao/relatorios', '/uikit/prospeccao/configuracoes',
];
const ROTAS_FINANCEIRO_PRO = [
    '/financeiro/dashboard', '/financeiro/entradas', '/financeiro/saidas',
    '/financeiro/relatorios', '/uikit/crm', '/uikit/escola-financeiro',
];

const P1_BASE = [...ROTAS_HOME, ...ROTAS_OPERACIONAL, ...ROTAS_COMERCIAL, ...ROTAS_FINANCEIRO, ...ROTAS_ADMIN, ...ROTAS_ESTOQUE_ROUPAS, ...ROTAS_DEPTO_PESSOAL];
const P2_BASE = [...P1_BASE, ...ROTAS_FINANCEIRO_PRO, ...ROTAS_CRM, ...ROTAS_ESTRATEGIA, ...ROTAS_JURIDICO];

const PACOTES = [
    {
        id: 'pacote1',
        label: 'Pacote 1',
        rotas: P1_BASE,
    },
    {
        id: 'pacote2',
        label: 'Pacote 2',
        rotas: P2_BASE,
    },
    {
        id: 'pacote_contador',
        label: 'Pacote Contador',
        rotas: [...P2_BASE, ...ROTAS_CONTABIL],
    },
];

const FLAGS_INTERNAS = ['ponto:todos', 'planejamento:todos', 'senha:ver'];

function detectarPacote(permissoes) {
    if (!permissoes || permissoes.length === 0) return null;
    // Verifica do maior pro menor
    for (const p of [...PACOTES].reverse()) {
        if (p.rotas.every(r => permissoes.includes(r))) return p;
    }
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          CORRIGIR TUDO — PACOTES + CARGOS — LUCROMAIS        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const loginRes = await axios.post(`${BASE}/auth/login`, MASTER);
    const token = loginRes.data?.token ?? loginRes.data?.data?.token;
    if (!token) { console.error('❌ Falha no login master'); process.exit(1); }
    const api = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token}` } });

    const empRes = await api.get('/empresas');
    const empresas = empRes.data?.data ?? empRes.data ?? [];
    console.log(`${empresas.length} empresa(s) encontrada(s)\n`);

    let totalEmpresasCorrigidas = 0;
    let totalUsersAlterados = 0;
    let totalUsersVerificados = 0;

    // ── FASE 1: Corrigir pacotes das empresas ─────────────────────────────
    console.log('━━━ FASE 1: Corrigir pacotes das empresas ━━━\n');

    for (const emp of empresas) {
        const empId   = emp.id;
        const empNome = emp.nome ?? emp.nomeEmpresa ?? `ID ${empId}`;
        const permsAtuais = Array.isArray(emp.permissoes) ? emp.permissoes : [];

        const pacoteDetectado = detectarPacote(permsAtuais);

        if (!pacoteDetectado) {
            console.log(`⚪ ${empNome} — pacote não identificado (${permsAtuais.length} rotas), pulando`);
            continue;
        }

        const rotasCorretas = pacoteDetectado.rotas;

        // Verifica se as rotas já estão corretas
        const jaCorreta = rotasCorretas.every(r => permsAtuais.includes(r)) &&
                          permsAtuais.every(r => rotasCorretas.includes(r));

        if (jaCorreta) {
            console.log(`✅ ${empNome} — ${pacoteDetectado.label} já correto`);
            continue;
        }

        // Re-aplica as rotas corretas do pacote detectado
        await api.put(`/empresas/${empId}/permissoes`, { permissoes: rotasCorretas });
        console.log(`🔧 ${empNome} — ${pacoteDetectado.label} corrigido (${permsAtuais.length} → ${rotasCorretas.length} rotas)`);
        totalEmpresasCorrigidas++;
    }

    // ── FASE 2: Reconciliar permissões dos usuários pelos cargos ─────────
    console.log('\n━━━ FASE 2: Reconciliar permissões de usuários pelos cargos ━━━\n');

    // Rebusca empresas com permissoes atualizadas
    const empResAtualizado = await api.get('/empresas');
    const empresasAtualizadas = empResAtualizado.data?.data ?? empResAtualizado.data ?? [];

    for (const emp of empresasAtualizadas) {
        const empId   = emp.id;
        const empNome = emp.nome ?? emp.nomeEmpresa ?? `ID ${empId}`;

        const empPerms = Array.isArray(emp.permissoes) ? emp.permissoes : [];
        const empCargos = await api.get(`/empresas/${empId}/cargos`).then(r => r.data ?? []).catch(() => []);

        if (!Array.isArray(empCargos) || empCargos.length === 0) {
            console.log(`⚪ ${empNome} — sem cargos customizados`);
            continue;
        }

        // Mapa: nome_cargo → permissões válidas pelo plano da empresa
        const mapaCargoPerms = {};
        for (const cargo of empCargos) {
            if (!cargo.nome || !Array.isArray(cargo.permissoes)) continue;
            mapaCargoPerms[cargo.nome] = cargo.permissoes.filter(
                p => FLAGS_INTERNAS.includes(p) || empPerms.includes(p)
            );
        }
        const nomesComDefinicao = Object.keys(mapaCargoPerms);
        if (nomesComDefinicao.length === 0) continue;

        const usersRes = await api.get(`/users?empresa_id=${empId}`).catch(() => null);
        const users    = usersRes?.data?.data ?? usersRes?.data ?? [];

        const afetados = [];

        for (const u of users) {
            if (!u.cargo || !nomesComDefinicao.includes(u.cargo)) continue;

            const uDetail = await api.get(`/users/${u.id}`).catch(() => null);
            const uPerms  = uDetail?.data?.data?.permissoes ?? uDetail?.data?.permissoes ?? u.permissoes ?? [];

            const cargoPermitidas = mapaCargoPerms[u.cargo];
            const nomeUser = u.nomeCompleto ?? u.email ?? `ID ${u.id}`;

            const uFlags     = uPerms.filter(p => FLAGS_INTERNAS.includes(p));
            const uRotas     = uPerms.filter(p => !FLAGS_INTERNAS.includes(p));
            const cargoRotas = cargoPermitidas.filter(p => !FLAGS_INTERNAS.includes(p));
            const cargoFlags = cargoPermitidas.filter(p => FLAGS_INTERNAS.includes(p));

            const rotasReconciliadas = uRotas.length === 0
                ? cargoRotas
                : uRotas.filter(r => cargoRotas.includes(r));

            const flagsReconciliadas = [...new Set([...uFlags, ...cargoFlags])].filter(
                f => cargoPermitidas.includes(f)
            );

            const permsNovas  = [...rotasReconciliadas, ...flagsReconciliadas].sort();
            const permsAtual  = [...uPerms].sort();

            totalUsersVerificados++;

            const igual = permsNovas.length === permsAtual.length &&
                          permsNovas.every((p, i) => p === permsAtual[i]);
            if (igual) continue;

            await api.put(`/users/${u.id}`, { permissoes: permsNovas });
            afetados.push({ nome: nomeUser, cargo: u.cargo, de: uPerms.length, para: permsNovas.length });
            totalUsersAlterados++;
        }

        if (afetados.length > 0) {
            console.log(`🔧 ${empNome} — ${afetados.length} usuário(s):`);
            afetados.forEach(a => console.log(`   • ${a.nome} (${a.cargo}): ${a.de} → ${a.para} permissão(ões)`));
        } else {
            console.log(`✅ ${empNome} — usuários ok`);
        }
    }

    console.log('\n' + '═'.repeat(62));
    console.log(`Empresas corrigidas : ${totalEmpresasCorrigidas}`);
    console.log(`Usuários verificados: ${totalUsersVerificados}`);
    console.log(`Usuários alterados  : ${totalUsersAlterados}`);
    if (totalEmpresasCorrigidas === 0 && totalUsersAlterados === 0) {
        console.log('🎉 Tudo já estava correto!');
    } else {
        console.log('✅ Correção concluída.');
    }
}

main().catch(err => {
    console.error('Erro fatal:', err.response?.data ?? err.message);
    process.exit(1);
});
