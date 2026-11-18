import assert from 'node:assert/strict';
import test from 'node:test';

import resolveManifestoEmpresa from '../src/middlewares/resolveManifestoEmpresa.js';

const resposta = () => ({
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
});

test('Manifestos usa automaticamente a empresa do usuário', () => {
  const req = { user: { tipo: 'USUARIO', empresa_id: 31 } };
  const res = resposta();
  let passou = false;

  resolveManifestoEmpresa(req, res, () => {
    passou = true;
  });

  assert.equal(passou, true);
  assert.equal(req.manifestoEmpresaId, 31);
});

test('MASTER precisa selecionar uma empresa antes de consultar Manifestos', () => {
  const req = { user: { tipo: 'MASTER' } };
  const res = resposta();

  resolveManifestoEmpresa(req, res, () => {
    assert.fail('não deveria prosseguir sem empresa selecionada');
  });

  assert.equal(res.statusCode, 400);
});

test('override do MASTER define o escopo de Manifestos', () => {
  const req = { user: { tipo: 'MASTER', empresa_id_override: 44 } };
  const res = resposta();
  resolveManifestoEmpresa(req, res, () => {});

  assert.equal(req.manifestoEmpresaId, 44);
});
