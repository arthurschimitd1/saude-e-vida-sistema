import test from 'node:test';
import assert from 'node:assert/strict';
import requireCargo, { PERM_USUARIOS_FULL } from '../src/middlewares/requireCargo.js';
import { normalizarBooleano } from '../src/services/ProductService.js';

const executarGuard = (user, params = {}) => {
  let statusCode = null;
  let continuou = false;
  const req = { user, params };
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; }
  };
  requireCargo({ permissoes: PERM_USUARIOS_FULL, permitirProprio: true })(req, res, () => { continuou = true; });
  return { statusCode, continuou };
};

test('booleano textual false não vira matéria-prima por engano', () => {
  assert.equal(normalizarBooleano('false'), false);
  assert.equal(normalizarBooleano('0'), false);
  assert.equal(normalizarBooleano('true'), true);
  assert.equal(normalizarBooleano(true), true);
});

test('guard de usuários permite a própria ficha, mas bloqueia administração direta', () => {
  const proprio = executarGuard({ id: 7, tipo: 'USUARIO', permissoes: [] }, { id: '7' });
  assert.equal(proprio.continuou, true);

  const bloqueado = executarGuard({ id: 7, tipo: 'USUARIO', permissoes: [] }, { id: '8' });
  assert.equal(bloqueado.continuou, false);
  assert.equal(bloqueado.statusCode, 403);
});
