// Middleware de AUTORIZAÇÃO por cargo/permissão (fábrica).
// Reusa a lógica do guard de GET /users/:id/senha (userRoutes): libera se
//   - req.user.tipo === 'MASTER' (ou o e-mail master legado), OU
//   - req.user.cargo está na lista de cargos permitidos (padrão: gestão), OU
//   - req.user.permissoes contém QUALQUER permissão-chave passada em `permissoes`
//     (no produto, as "permissões" são rotas do front, ex. '/uikit/panel',
//      mais chaves nomeadas como 'senha:ver').
// Caso contrário: 403 no MESMO formato de erro do guard de /senha ({ error }).
// IMPORTANTE: isto NÃO substitui o `auth` — usa-se DEPOIS dele (opt-in por rota).

export const CARGOS_GESTAO = ['Gerente', 'Dono', 'Administrador'];

// Telas/chaves que liberam acesso COMPLETO aos dados de usuários (lista com
// CPF/endereço/email). Fora disso, GET /users devolve campos reduzidos.
export const PERM_USUARIOS_FULL = ['usuarios:ver', 'usuarios:gerenciar', '/uikit/invalidstate', '/uikit/panel'];

// Telas que precisam LER a lista completa de usuários (com CPF, p/ importação
// de custos) sem ganhar poder de mutação: só entram na régua de LEITURA.
export const PERM_USUARIOS_LISTA_FULL = [...PERM_USUARIOS_FULL, '/uikit/table'];

// Telas/chaves que legitimamente operam a base de clientes completa
// (Clientes, Caixa, Orçamentos, Protocolos, Procurações, Recorrências).
export const PERM_CLIENTES_FULL = [
    'clientes:ver', 'clientes:gerenciar',
    '/uikit/button', '/uikit/input', '/uikit/tree',
    '/uikit/protocolos', '/uikit/procuracoes', '/uikit/list'
];

// Telas que legitimamente operam vendas (Caixa, Clientes, NF-e/NFC-e).
export const PERM_VENDAS = [
    'vendas:ver', '/uikit/input', '/uikit/button',
    '/uikit/servicos-nfe', '/uikit/servicos-nfce'
];

// Comissões: financeiro (gestão) — tela Comissões.
export const PERM_COMISSOES = ['comissoes:ver', '/uikit/comissoes'];

// Recorrências de cliente: mesma sensibilidade de clientes (o service devolve
// CPF/email) — libera gestão, telas comerciais de cliente OU a tela Recorrência.
export const PERM_RECORRENCIA = [...PERM_CLIENTES_FULL, 'recorrencias:ver'];

// Orçamentos: dado comercial de cliente — telas Orçamentos/Clientes/Caixa.
export const PERM_ORCAMENTOS = ['orcamentos:ver', '/uikit/tree', '/uikit/button', '/uikit/input'];

// Custos de funcionários (CPF + salário): RH/financeiro — só gestão ou a tela.
export const PERM_CUSTOS = ['custos:ver', '/uikit/table'];

// Jurídico (contratos/procurações têm anexos baixáveis com dado sensível).
export const PERM_CONTRATOS = ['contratos:ver', '/uikit/contratos'];
export const PERM_PROCURACOES = ['procuracoes:ver', '/uikit/procuracoes'];

// Fiscal: notas fiscais / NFS-e carregam CPF/CNPJ do tomador — telas fiscais.
export const PERM_FISCAL = [
    'fiscal:ver', '/uikit/notas-fiscais', '/uikit/servicos',
    '/uikit/servicos-nfe', '/uikit/servicos-nfce',
    '/uikit/historico-notas', '/uikit/contabil-fiscal/historico-notas',
    '/uikit/contabil-fiscal/dashboard',
    '/uikit/contabil-fiscal/central-fiscal',
    '/uikit/contabil-fiscal/integracao-contabil', '/uikit/integracao-focus',
    '/uikit/manifestos'
];

/**
 * Checagem pura (sem HTTP) — usada também pelos services para decidir
 * escopo de dados (ex.: lista completa vs. reduzida).
 */
export function temAcesso(user, { cargos = CARGOS_GESTAO, permissoes = [] } = {}) {
    if (!user) return false;
    if (user.tipo === 'MASTER' || user.email === 'admin@master.com') return true;
    if (user.cargo && Array.isArray(cargos) && cargos.includes(user.cargo)) return true;
    const userPerms = Array.isArray(user.permissoes) ? user.permissoes : [];
    return Array.isArray(permissoes) && permissoes.some((p) => userPerms.includes(p));
}

/**
 * Fábrica de middleware.
 * @param {object} opcoes
 * @param {string[]} [opcoes.cargos]     cargos liberados (padrão CARGOS_GESTAO)
 * @param {string[]} [opcoes.permissoes] permissões-chave que também liberam
 * @param {boolean}  [opcoes.permitirProprio] libera quando req.params.id === req.user.id
 * @param {boolean}  [opcoes.apenasMaster] só MASTER passa (ignora cargo/permissão)
 * @param {string}   [opcoes.mensagem]   mensagem do 403
 */
const requireCargo = (opcoes = {}) => {
    const { permitirProprio = false, apenasMaster = false, mensagem = 'Sem permissão para acessar este recurso' } = opcoes;
    return (req, res, next) => {
        const user = req.user;
        if (apenasMaster) {
            if (user?.tipo === 'MASTER' || user?.email === 'admin@master.com') return next();
            return res.status(403).json({ error: mensagem });
        }
        if (permitirProprio && user?.id != null && String(req.params?.id) === String(user.id)) {
            return next();
        }
        if (temAcesso(user, opcoes)) return next();
        return res.status(403).json({ error: mensagem });
    };
};

export default requireCargo;
