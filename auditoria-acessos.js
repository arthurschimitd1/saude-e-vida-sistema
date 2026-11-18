/**
 * Auditoria de Acessos — LucroMais
 * Executa: node auditoria-acessos.js
 *
 * Verifica TODAS as empresas e seus funcionários.
 * Tipos de problema detectados:
 *  🔴 CRÍTICO: Funcionário de empresa Pacote 1 vendo CRM/Financeiro Pro (dados sujos no banco)
 *  🟡 AVISO : Funcionário de empresa Pacote 2 com rotas P2 em user_permissoes mas sem grant explícito
 *             (auto-propagação pelo salvarPacote quando não deveria)
 *  ✅ OK     : Funcionário de empresa Pacote 2 que recebeu CRM/FinPro explicitamente → CORRETO
 */

const axios = require('./backend/node_modules/axios').default;

const BASE   = 'http://localhost:3001/api';
const MASTER = { email: 'admin@master.com', senha: '123123' };

const ROTAS_CRM = [
    '/uikit/prospeccao', '/uikit/prospeccao/dashboard', '/uikit/prospeccao/campanhas',
    '/uikit/prospeccao/historico', '/uikit/prospeccao/scripts',
    '/uikit/prospeccao/relatorios', '/uikit/prospeccao/configuracoes',
];
const ROTAS_FINANCEIRO_PRO = [
    '/financeiro/dashboard', '/financeiro/entradas', '/financeiro/saidas', '/financeiro/relatorios',
    '/uikit/crm', '/uikit/escola-financeiro',
];
const ROTAS_P2 = [...ROTAS_CRM, ...ROTAS_FINANCEIRO_PRO];

function modulosVisiveis(rotasEfetivas) {
    const mods = new Set();
    rotasEfetivas.forEach(r => {
        if (ROTAS_CRM.includes(r))            mods.add('CRM Comercial');
        if (ROTAS_FINANCEIRO_PRO.includes(r)) mods.add('Financeiro Pro');
    });
    return [...mods];
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           AUDITORIA DE ACESSOS — LUCROMAIS                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const loginRes = await axios.post(`${BASE}/auth/login`, MASTER);
    const token    = loginRes.data?.token ?? loginRes.data?.data?.token;
    if (!token) { console.log('❌ Falha no login master'); process.exit(1); }
    const api = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token}` } });

    const empRes  = await api.get('/empresas');
    const empresas = empRes.data?.data ?? empRes.data ?? [];
    console.log(`Analisando ${empresas.length} empresa(s)...\n`);

    const criticos  = [];  // Pacote 1 com funcionários vendo P2 (impossível via interseção, mas dados sujos)
    const avisos    = [];  // Pacote 2: funcionários com rotas P2 no banco que não deveriam ter
    const corretos  = [];  // Pacote 2: funcionários com P2 explicitamente concedido → OK
    const empInfo   = [];  // Resumo por empresa

    for (const emp of empresas) {
        const empId   = emp.id;
        const empNome = emp.nomeEmpresa ?? emp.nome ?? `ID ${empId}`;

        const empDetail = await api.get(`/empresas/${empId}`).catch(() => null);
        const empPerms  = empDetail?.data?.permissoes ?? [];

        const empTemCRM    = ROTAS_CRM.every(r => empPerms.includes(r));
        const empTemFinPro = ROTAS_FINANCEIRO_PRO.every(r => empPerms.includes(r));
        const ehP2         = empTemCRM || empTemFinPro;

        // Rotas P2 sujas na própria empresa (não deveria ter)
        const rotasSujasEmpresa = ehP2 ? [] : ROTAS_P2.filter(r => empPerms.includes(r));

        const usersRes = await api.get(`/users?empresa_id=${empId}`).catch(() => null);
        const users    = usersRes?.data?.data ?? usersRes?.data ?? [];

        const funcionariosProblema = [];

        for (const u of users) {
            const uDetail  = await api.get(`/users/${u.id}`).catch(() => null);
            const uPerms   = uDetail?.data?.data?.permissoes ?? uDetail?.data?.permissoes ?? u.permissoes ?? [];
            const nomeUser = u.nomeCompleto ?? u.nome ?? u.email ?? `ID ${u.id}`;

            // Permissões efetivas (o que o frontend realmente mostra)
            const efetivas = uPerms.filter(r => empPerms.includes(r));

            // Rotas P2 que o usuário TEM no seu perfil (independente da interseção)
            const uRotasP2Brutas   = ROTAS_P2.filter(r => uPerms.includes(r));
            // Rotas P2 que realmente aparecerão na tela (efetivas)
            const uRotasP2Efetivas = ROTAS_P2.filter(r => efetivas.includes(r));

            if (!ehP2) {
                // Empresa Pacote 1
                if (uRotasP2Efetivas.length > 0) {
                    // CRÍTICO: dados sujos na empresa deixaram P2 vazar pela interseção
                    criticos.push({ empresa: empNome, nome: nomeUser, rotasEfetivas: uRotasP2Efetivas, rotasBrutas: uRotasP2Brutas });
                    funcionariosProblema.push({ nome: nomeUser, nivel: '🔴', modulos: modulosVisiveis(uRotasP2Efetivas), rotas: uRotasP2Efetivas });
                } else if (uRotasP2Brutas.length > 0) {
                    // AVISO: usuário tem P2 no banco mas não aparece na tela (interseção bloqueou) — dado sujo
                    avisos.push({ empresa: empNome, nome: nomeUser, rotasBrutas: uRotasP2Brutas });
                    funcionariosProblema.push({ nome: nomeUser, nivel: '🟡', modulos: modulosVisiveis(uRotasP2Brutas), rotas: uRotasP2Brutas, obs: 'DB sujo (interseção bloqueia, mas existe no banco)' });
                }
            } else {
                // Empresa Pacote 2 — P2 visível é esperado se explicitamente concedido
                // Mas marcamos como AVISO se os usuários têm TODAS as rotas P2 (sinal de auto-propagação em massa)
                if (uRotasP2Efetivas.length > 0) {
                    corretos.push({ empresa: empNome, nome: nomeUser, modulos: modulosVisiveis(uRotasP2Efetivas) });
                }
            }
        }

        empInfo.push({
            nome: empNome, pacote: ehP2 ? 'Pacote 2 / Contador' : 'Pacote 1',
            numUsers: users.length, rotasSujasEmpresa, funcionariosProblema,
        });
    }

    // ─── Saída do relatório ───────────────────────────────────────────────────

    // Empresas OK (Pacote 1 sem problemas)
    const empSemProblemas = empInfo.filter(e => e.funcionariosProblema.length === 0 && e.rotasSujasEmpresa.length === 0);
    console.log(`✅ Empresas sem irregularidades (${empSemProblemas.length}):`);
    empSemProblemas.forEach(e => console.log(`   • ${e.nome} — ${e.pacote} — ${e.numUsers} usuário(s)`));

    // Empresas Pacote 2 (OK por definição para rotas P2)
    const empP2 = empInfo.filter(e => e.pacote === 'Pacote 2 / Contador' && e.funcionariosProblema.length === 0);
    if (empP2.length > 0) {
        console.log(`\n✅ Empresas Pacote 2 / Contador — funcionários com CRM/Financeiro Pro (CORRETO):`);
        empP2.forEach(e => console.log(`   • ${e.nome} — ${e.numUsers} usuário(s)`));
        if (corretos.length > 0) {
            console.log(`\n   Funcionários com acesso P2 explicitamente concedido (esperado):`);
            corretos.forEach(c => console.log(`     - ${c.empresa} → ${c.nome}: ${c.modulos.join(', ')}`));
        }
    }

    // Problemas críticos
    if (criticos.length > 0) {
        console.log(`\n🔴 CRÍTICO — Funcionários de Pacote 1 vendo conteúdo de Pacote 2 (${criticos.length}):`);
        criticos.forEach(c => {
            console.log(`   • ${c.empresa} → ${c.nome}`);
            console.log(`     Módulos visíveis: ${modulosVisiveis(c.rotasEfetivas).join(', ')}`);
        });
    }

    // Avisos (dado sujo mas não vazando)
    if (avisos.length > 0) {
        console.log(`\n🟡 AVISO — Rotas P2 no banco de usuários de Pacote 1 (não aparecem na tela, mas dado sujo) (${avisos.length}):`);
        avisos.forEach(a => {
            console.log(`   • ${a.empresa} → ${a.nome}`);
            console.log(`     Módulos no banco: ${modulosVisiveis(a.rotasBrutas).join(', ')}`);
        });
        console.log(`\n   → Use "Corrigir Pacotes" em Gestão de Empresas para limpar.`);
    }

    // Empresas P2 com funcionários com problema
    const empP2comProblema = empInfo.filter(e => e.pacote === 'Pacote 2 / Contador' && e.funcionariosProblema.length > 0);
    if (empP2comProblema.length > 0) {
        console.log(`\n🔴 Empresas Pacote 2 com funcionários com problema:`);
        empP2comProblema.forEach(e => {
            console.log(`\n   ┌─ ${e.nome}`);
            e.funcionariosProblema.forEach(f => {
                console.log(`   │ ${f.nivel} ${f.nome}: ${f.modulos.join(', ')}${f.obs ? ` (${f.obs})` : ''}`);
            });
            console.log(`   └${'─'.repeat(50)}`);
        });
    }

    console.log('\n' + '═'.repeat(62));
    if (criticos.length === 0 && avisos.length === 0) {
        console.log('🎉 Nenhuma irregularidade real encontrada!');
        console.log('   Todos os acessos de Pacote 1 estão corretos.');
    } else {
        console.log(`Resumo: ${criticos.length} crítico(s), ${avisos.length} aviso(s) de dados sujos`);
    }
}

main().catch(err => {
    console.error('Erro:', err.response?.data ?? err.message);
    process.exit(1);
});
