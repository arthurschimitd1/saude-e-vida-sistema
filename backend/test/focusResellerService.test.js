import assert from 'node:assert/strict';
import test from 'node:test';

import ConfiguracaoFiscal from '../src/models/ConfiguracaoFiscal.js';
import EmpresaFocusIntegracao from '../src/models/EmpresaFocusIntegracao.js';
import FocusResellerService from '../src/services/focus/FocusResellerService.js';

test('verificação fiscal sem integração retorna a configuração fiscal existente', async (t) => {
  const findIntegracaoOriginal = EmpresaFocusIntegracao.findOne;
  const findFiscalOriginal = ConfiguracaoFiscal.findOne;
  const configuracaoFiscal = { id: 8, empresa_id: 19 };

  t.after(() => {
    EmpresaFocusIntegracao.findOne = findIntegracaoOriginal;
    ConfiguracaoFiscal.findOne = findFiscalOriginal;
  });

  EmpresaFocusIntegracao.findOne = async () => null;
  ConfiguracaoFiscal.findOne = async () => configuracaoFiscal;

  const resultado = await FocusResellerService.verificarConfiguracao(19);

  assert.equal(resultado.configurada, false);
  assert.equal(resultado.configuracao, null);
  assert.equal(resultado.configuracaoFiscal, configuracaoFiscal);
});

test('verificação fiscal retorna integração e configuração quando ambas existem', async (t) => {
  const findIntegracaoOriginal = EmpresaFocusIntegracao.findOne;
  const findFiscalOriginal = ConfiguracaoFiscal.findOne;
  const integracao = { id: 4, tipo_integracao: 'ASSOCIADA' };
  const configuracaoFiscal = { id: 8, empresa_id: 19 };

  t.after(() => {
    EmpresaFocusIntegracao.findOne = findIntegracaoOriginal;
    ConfiguracaoFiscal.findOne = findFiscalOriginal;
  });

  EmpresaFocusIntegracao.findOne = async () => integracao;
  ConfiguracaoFiscal.findOne = async () => configuracaoFiscal;

  const resultado = await FocusResellerService.verificarConfiguracao(19);

  assert.equal(resultado.configurada, true);
  assert.equal(resultado.tipo, 'ASSOCIADA');
  assert.equal(resultado.configuracao, integracao);
  assert.equal(resultado.configuracaoFiscal, configuracaoFiscal);
});
