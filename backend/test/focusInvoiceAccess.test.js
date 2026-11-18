import assert from 'node:assert/strict';
import test from 'node:test';

import resolveFiscalEmpresa from '../src/middlewares/resolveFiscalEmpresa.js';
import { PERM_FISCAL, temAcesso } from '../src/middlewares/requireCargo.js';

const criarResposta = () => {
  const resposta = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return resposta;
};

test('middleware mantém a empresa válida para o controller atual', () => {
  const req = {
    user: { tipo: 'USUARIO', empresa_id: 19 },
    params: { empresaId: '19' }
  };
  const res = criarResposta();
  let prosseguiu = false;

  resolveFiscalEmpresa(req, res, () => {
    prosseguiu = true;
  });

  assert.equal(prosseguiu, true);
  assert.equal(req.fiscalEmpresaId, 19);
  assert.equal(req.params.empresaId, '19');
});

test('middleware bloqueia tentativa de acessar empresa diferente', () => {
  const req = {
    user: { tipo: 'USUARIO', empresa_id: 19 },
    params: { empresaId: '20' }
  };
  const res = criarResposta();

  resolveFiscalEmpresa(req, res, () => {
    assert.fail('não deveria prosseguir');
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('permissão da tela atual de histórico continua liberando acesso fiscal', () => {
  assert.equal(PERM_FISCAL.includes('/uikit/historico-notas'), true);
  assert.equal(
    temAcesso(
      { tipo: 'USUARIO', cargo: 'Atendente', permissoes: ['/uikit/historico-notas'] },
      { cargos: [], permissoes: PERM_FISCAL }
    ),
    true
  );
});

test('alias legado do histórico fiscal continua liberando acesso', () => {
  assert.equal(
    temAcesso(
      {
        tipo: 'USUARIO',
        cargo: 'Atendente',
        permissoes: ['/uikit/contabil-fiscal/historico-notas']
      },
      { cargos: [], permissoes: PERM_FISCAL }
    ),
    true
  );
});
