import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_PLANS,
  INTERNAL_ACCESS_FLAGS,
  LEGACY_PLAN_ROUTES,
  computeAutoAddRoutes,
  computeCompanyRoutes,
  computeUserRoutes,
  inferUserAccessMode
} from '../src/access/accessCatalog.js';
import { validarAcessoCentral } from '../src/services/centralGestao/CentralGestaoAccessService.js';

test('versoes antigas sao preservadas enquanto a atual recebe os novos modulos', () => {
  const currentPlan = ACCESS_PLANS.find((plan) => plan.code === 'pacote1');

  assert.equal(LEGACY_PLAN_ROUTES.pacote1.includes('/uikit/manifestos'), false);
  assert.equal(LEGACY_PLAN_ROUTES.pacote1.includes('/uikit/fornecedores'), false);
  assert.equal(LEGACY_PLAN_ROUTES.pacote1.includes('/central-gestao'), false);
  assert.equal(currentPlan.routes.includes('/uikit/manifestos'), true);
  assert.equal(currentPlan.routes.includes('/uikit/fornecedores'), true);
});

test('visao geral faz parte de todos os pacotes, mas exige a flag do dono', () => {
  for (const plan of ACCESS_PLANS) {
    assert.equal(plan.version, 7);
    assert.equal(plan.routes.includes('/central-gestao'), true);
  }
  assert.equal(INTERNAL_ACCESS_FLAGS.includes('central_gestao:visualizar'), true);
});

test('visao geral libera o dono e bloqueia funcionario mesmo com a rota do pacote', () => {
  const empresa = { empresa_id: 12, permissions: ['/central-gestao'] };
  const contexto = validarAcessoCentral(
    { id: 9, tipo: 'EMPRESA', empresa_id: 12 },
    empresa,
    { permissions: ['/central-gestao', 'central_gestao:visualizar'] },
    true
  );
  assert.equal(contexto.empresaId, 12);
  assert.throws(
    () => validarAcessoCentral(
      { id: 10, tipo: 'FUNCIONARIO', empresa_id: 12 },
      empresa,
      { permissions: ['/central-gestao'] },
      true
    ),
    /Sem permissão/
  );
});

test('usuario privilegiado com restricao existente permanece explicito', () => {
  const mode = inferUserAccessMode({
    companyPermissions: ['/dashboard', '/uikit/formlayout', '/uikit/input'],
    userPermissions: ['/dashboard', '/uikit/input'],
    tipo: 'EMPRESA',
    cargo: 'Dono'
  });

  assert.equal(mode, 'EXPLICIT');
});

test('usuario privilegiado que ja espelha a empresa pode herdar o pacote', () => {
  const mode = inferUserAccessMode({
    companyPermissions: ['/dashboard', '/uikit/formlayout'],
    userPermissions: ['/uikit/formlayout', 'senha:ver', '/dashboard'],
    tipo: 'EMPRESA',
    cargo: 'Dono'
  });

  assert.equal(mode, 'INHERIT_COMPANY');
});

test('acesso explicito e limitado pela empresa sem perder flags internas', () => {
  const permissions = computeUserRoutes({
    companyRoutes: ['/dashboard', '/uikit/input'],
    userPermissions: ['/dashboard', '/uikit/formlayout', 'caixa:pular_senha', 'comissoes:todos'],
    mode: 'EXPLICIT'
  });

  assert.deepEqual(permissions, ['/dashboard', 'caixa:pular_senha', 'comissoes:todos']);
  assert.equal(INTERNAL_ACCESS_FLAGS.includes('comissoes:todos'), true);
});

test('acesso explicito legado preserva exatamente as permissoes anteriores', () => {
  const permissions = computeUserRoutes({
    companyRoutes: ['/dashboard'],
    userPermissions: ['/dashboard', '/uikit/formlayout', 'caixa:pular_senha'],
    mode: 'LEGACY_EXPLICIT'
  });

  assert.deepEqual(permissions, ['/dashboard', '/uikit/formlayout', 'caixa:pular_senha']);
});

test('sincronizacao automatica apenas adiciona e nunca remove', () => {
  const current = ['/dashboard', '/rota-personalizada'];
  const next = computeAutoAddRoutes(current, ['/dashboard', '/uikit/manifestos']);

  assert.deepEqual(next, ['/dashboard', '/rota-personalizada', '/uikit/manifestos']);
});

test('overrides preservam perfil customizado e excecoes do pacote', () => {
  const permissions = computeCompanyRoutes(
    ['/dashboard', '/uikit/input'],
    [
      { route: '/uikit/input', enabled: false },
      { route: '/uikit/manifestos', enabled: true }
    ]
  );

  assert.deepEqual(permissions, ['/dashboard', '/uikit/manifestos']);
});
