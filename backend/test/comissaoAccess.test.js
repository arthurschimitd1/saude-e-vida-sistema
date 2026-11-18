import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarEscopoComissoes,
  exigirGestaoComissoes,
  podeVerTodasComissoes
} from '../src/utils/comissaoAccess.js';

test('MASTER e conta da empresa continuam vendo todas as comissoes', () => {
  assert.equal(podeVerTodasComissoes({ tipo: 'MASTER', permissoes: [] }), true);
  assert.equal(podeVerTodasComissoes({ tipo: 'EMPRESA', permissoes: [] }), true);
});

test('flag comissoes:todos libera todas as comissoes da empresa', () => {
  assert.equal(podeVerTodasComissoes({
    id: 10,
    tipo: 'USUARIO',
    permissoes: ['/uikit/comissoes', 'comissoes:todos']
  }), true);
});

test('usuario restrito consulta somente as proprias comissoes', () => {
  const where = { funcionario_id: 999, status: 'pendente', empresa_id: 19 };
  aplicarEscopoComissoes(where, {
    id: 42,
    tipo: 'USUARIO',
    permissoes: ['/uikit/comissoes']
  });

  assert.deepEqual(where, {
    funcionario_id: 42,
    status: 'pendente',
    empresa_id: 19
  });
});

test('usuario sem identificacao nunca recebe comissoes de terceiros', () => {
  const where = { empresa_id: 19 };
  aplicarEscopoComissoes(where, null);
  assert.equal(where.funcionario_id, -1);
});

test('usuario restrito nao pode pagar nem excluir comissoes pela API', () => {
  assert.throws(
    () => exigirGestaoComissoes({ id: 41, tipo: 'USUARIO', permissoes: ['/uikit/comissoes'] }),
    (error) => error.status === 403 && error.message === 'Sem permissão para gerenciar comissões'
  );
});

test('usuario com escopo total pode gerenciar comissoes', () => {
  assert.doesNotThrow(() => exigirGestaoComissoes({
    id: 8,
    tipo: 'USUARIO',
    permissoes: ['/uikit/comissoes', 'comissoes:todos']
  }));
});
