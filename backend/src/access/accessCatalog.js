export const CENTRAL_GESTAO_ROUTE = '/central-gestao';
export const CENTRAL_GESTAO_VISUALIZAR_FLAG = 'central_gestao:visualizar';

export const INTERNAL_ACCESS_FLAGS = [
  CENTRAL_GESTAO_VISUALIZAR_FLAG,
  'central_gestao:comercial',
  'central_gestao:estoque',
  'ponto:todos',
  'planejamento:todos',
  'agendamento:todos',
  'comissoes:todos',
  'senha:ver',
  'caixa:pular_senha'
];

const modules = [
  ['central_gestao', CENTRAL_GESTAO_ROUTE, 'Central de Gestão', 'Central de Gestão'],
  ['home', '/', 'Inicio', 'Home'],
  ['dashboard', '/dashboard', 'Dashboard', 'Home'],
  ['estoque', '/uikit/formlayout', 'Estoque', 'Operacional'],
  ['estoque_roupas', '/uikit/estoque-roupas', 'Estoque de roupas', 'Operacional'],
  ['materia_prima', '/uikit/overlay', 'Materia-prima', 'Operacional'],
  ['producao', '/uikit/producao', 'Producao', 'Operacional'],
  ['relatorios_produtos', '/uikit/relatorios-produtos', 'Relatorios de produtos', 'Operacional'],
  ['pedidos', '/uikit/pedidos', 'Pedidos', 'Operacional'],
  ['fornecedores', '/uikit/fornecedores', 'Fornecedores', 'Operacional'],
  ['agendamentos', '/uikit/agendamentos', 'Agendamentos', 'Operacional'],
  ['clientes', '/uikit/button', 'Clientes', 'Comercial'],
  ['orcamentos', '/uikit/tree', 'Orcamentos', 'Comercial'],
  ['caixa', '/uikit/input', 'Caixa', 'Comercial'],
  ['loja_online', '/loja/gestao', 'Lojinha online', 'Comercial'],
  ['loja_online_configuracao', '/loja/configuracao', 'Configurar lojinha', 'Comercial'],
  ['servicos_nfse', '/uikit/servicos', 'Servicos / NFS-e', 'Comercial'],
  ['nfe', '/uikit/servicos-nfe', 'NF-e', 'Comercial'],
  ['nfce', '/uikit/servicos-nfce', 'NFC-e', 'Comercial'],
  ['historico_notas', '/uikit/historico-notas', 'Historico de notas', 'Comercial'],
  ['manifestos', '/uikit/manifestos', 'Manifestos', 'Comercial'],
  ['whatsapp_crm', '/uikit/automacao-whatsapp', 'WhatsApp CRM', 'Comercial'],
  ['recorrencia', '/uikit/list', 'Recorrencia', 'Financeiro'],
  ['custos_funcionarios', '/uikit/table', 'Custos por funcionarios', 'Financeiro'],
  ['comissoes', '/uikit/comissoes', 'Comissoes', 'Financeiro'],
  ['notas_fiscais', '/uikit/notas-fiscais', 'Notas fiscais', 'Financeiro'],
  ['financeiro_dashboard', '/financeiro/dashboard', 'Dashboard financeiro', 'Financeiro'],
  ['financeiro_entradas', '/financeiro/entradas', 'Entradas', 'Financeiro'],
  ['contas_receber', '/financeiro/contas-receber', 'Contas a receber', 'Financeiro'],
  ['financeiro_saidas', '/financeiro/saidas', 'Saidas', 'Financeiro'],
  ['financeiro_relatorios', '/financeiro/relatorios', 'Relatorios financeiros', 'Financeiro'],
  ['crm_rfm', '/uikit/crm', 'CRM / RFM', 'Financeiro'],
  ['financeiro_escolar', '/uikit/escola-financeiro', 'Financeiro escolar', 'Financeiro'],
  ['usuarios', '/uikit/invalidstate', 'Usuarios', 'Administracao'],
  ['gestao_acessos', '/uikit/panel', 'Gestao de acessos', 'Administracao'],
  ['minha_empresa', '/uikit/media', 'Minha empresa', 'Administracao'],
  ['configuracao_fiscal', '/uikit/integracao-focus', 'Configuracao fiscal', 'Administracao'],
  ['controle_ponto', '/uikit/ponto', 'Controle de ponto', 'Departamento Pessoal'],
  ['contratos', '/uikit/contratos', 'Contratos', 'Juridico'],
  ['procuracoes', '/uikit/procuracoes', 'Procuracoes', 'Juridico'],
  ['marketing', '/uikit/menu', 'Marketing', 'Estrategia'],
  ['planejamento', '/uikit/message', 'Planejamento', 'Estrategia'],
  ['crm_prospeccao', '/uikit/prospeccao', 'Empresas e leads', 'CRM Comercial'],
  ['crm_dashboard', '/uikit/prospeccao/dashboard', 'Visao geral', 'CRM Comercial'],
  ['crm_pipeline', '/uikit/prospeccao/pipeline', 'Pipeline', 'CRM Comercial'],
  ['crm_campanhas', '/uikit/prospeccao/campanhas', 'Campanhas', 'CRM Comercial'],
  ['crm_historico', '/uikit/prospeccao/historico', 'Historico comercial', 'CRM Comercial'],
  ['crm_scripts', '/uikit/prospeccao/scripts', 'Scripts IA', 'CRM Comercial'],
  ['crm_relatorios', '/uikit/prospeccao/relatorios', 'Relatorios CRM', 'CRM Comercial'],
  ['crm_configuracoes', '/uikit/prospeccao/configuracoes', 'Configuracoes CRM', 'CRM Comercial'],
  ['contabil_dashboard', '/uikit/contabil-fiscal/dashboard', 'Dashboard contabil', 'Contabil e Fiscal'],
  ['contabil_central', '/uikit/contabil-fiscal/central-fiscal', 'Central fiscal', 'Contabil e Fiscal'],
  ['contabil_historico', '/uikit/contabil-fiscal/historico-notas', 'Historico contabil', 'Contabil e Fiscal'],
  ['inteligencia_negocio', '/uikit/inteligencia', 'Inteligencia do negocio', 'Contabil e Fiscal'],
  ['inteligencia_fiscal', '/uikit/contabil-fiscal/inteligencia-fiscal', 'Inteligencia fiscal', 'Contabil e Fiscal'],
  ['integracao_contabil', '/uikit/contabil-fiscal/integracao-contabil', 'Integracao contabil', 'Contabil e Fiscal'],
  ['gestao_tributaria', '/uikit/contabil-fiscal/gestao-tributaria', 'Gestao tributaria', 'Contabil e Fiscal'],
  ['conciliacao_financeira', '/uikit/contabil-fiscal/conciliacao', 'Conciliacao financeira', 'Contabil e Fiscal'],
  ['dre_relatorios', '/uikit/contabil-fiscal/dre-relatorios', 'DRE e relatorios', 'Contabil e Fiscal'],
  ['centro_custos', '/uikit/contabil-fiscal/centro-custos', 'Centro de custos', 'Contabil e Fiscal'],
  ['automacao_fiscal', '/uikit/contabil-fiscal/automacao', 'Automacao fiscal', 'Contabil e Fiscal'],
  ['portal_contador', '/uikit/contabil-fiscal/portal-contador', 'Portal do contador', 'Contabil e Fiscal'],
  ['auditoria', '/uikit/contabil-fiscal/auditoria', 'Auditoria', 'Contabil e Fiscal']
];

export const ACCESS_MODULES = modules.map(([code, route, label, group]) => ({
  code,
  route,
  label,
  group
}));

const routes = (...groups) => ACCESS_MODULES
  .filter((module) => groups.includes(module.group))
  .map((module) => module.route);

const baseRoutes = [
  CENTRAL_GESTAO_ROUTE,
  ...routes('Home', 'Operacional', 'Comercial', 'Administracao'),
  '/uikit/list',
  '/uikit/table',
  '/uikit/comissoes',
  '/uikit/notas-fiscais',
  '/financeiro/entradas',
  '/financeiro/contas-receber',
  '/financeiro/saidas'
].filter((route) => route !== '/uikit/automacao-whatsapp');

const package2Routes = [
  ...baseRoutes,
  '/uikit/automacao-whatsapp',
  ...routes('Financeiro', 'Departamento Pessoal', 'Juridico', 'Estrategia', 'CRM Comercial')
];

export const ACCESS_PLANS = [
  {
    code: 'pacote1',
    name: 'Pacote 1',
    description: 'Operacional, comercial, financeiro essencial e administracao',
    version: 7,
    routes: [...new Set([...baseRoutes, '/uikit/manifestos'])]
  },
  {
    code: 'pacote2',
    name: 'Pacote 2',
    description: 'Pacote 1 com financeiro completo, WhatsApp, DP, juridico, estrategia e CRM',
    version: 7,
    routes: [...new Set([...package2Routes, '/uikit/manifestos'])]
  },
  {
    code: 'pacote_contador',
    name: 'Pacote Contador',
    description: 'Acesso completo aos modulos',
    version: 7,
    routes: [...new Set([...package2Routes, ...routes('Contabil e Fiscal'), '/uikit/manifestos'])]
  }
];

export const LEGACY_PLAN_ROUTES = Object.fromEntries(
  ACCESS_PLANS.map((plan) => [
    plan.code,
    plan.routes.filter((route) => ![
      CENTRAL_GESTAO_ROUTE,
      '/uikit/manifestos',
      '/uikit/fornecedores'
    ].includes(route))
  ])
);

export const normalizeAccessRoutes = (values = []) => [
  ...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string'))
].sort();

export const splitInternalFlags = (values = []) => {
  const normalized = normalizeAccessRoutes(values);
  return {
    flags: normalized.filter((value) => INTERNAL_ACCESS_FLAGS.includes(value)),
    routes: normalized.filter((value) => !INTERNAL_ACCESS_FLAGS.includes(value))
  };
};

export const computeCompanyRoutes = (planRoutes = [], overrides = []) => {
  const result = new Set(normalizeAccessRoutes(planRoutes));
  for (const override of overrides) {
    if (!override?.route) continue;
    if (override.enabled) result.add(override.route);
    else result.delete(override.route);
  }
  return [...result].sort();
};

export const computeUserRoutes = ({
  companyRoutes = [],
  userPermissions = [],
  mode = 'EXPLICIT'
} = {}) => {
  // A empresa não funciona mais como um teto de módulos. O pacote pode
  // continuar registrado por compatibilidade, mas o acesso efetivo é definido
  // exclusivamente pelas permissões gravadas no usuário/cargo.
  const { flags, routes: userRoutes } = splitInternalFlags(userPermissions);
  return [...new Set([...userRoutes, ...flags])].sort();
};

export const inferUserAccessMode = ({
  companyPermissions = [],
  userPermissions = [],
  tipo,
  cargo
} = {}) => {
  const privileged = tipo === 'EMPRESA' || ['Dono', 'Administrador', 'Gerente'].includes(cargo);
  if (!privileged) return 'EXPLICIT';
  const company = normalizeAccessRoutes(companyPermissions);
  const { routes: userRoutes } = splitInternalFlags(userPermissions);
  return company.length === userRoutes.length
    && company.every((route, index) => route === userRoutes[index])
    ? 'INHERIT_COMPANY'
    : 'EXPLICIT';
};

export const computeAutoAddRoutes = (currentRoutes = [], nextPlanRoutes = []) =>
  normalizeAccessRoutes([...currentRoutes, ...nextPlanRoutes]);
