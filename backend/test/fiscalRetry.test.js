import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classificarErroParaReemissao,
  notaPodeSerReemitida,
  notaTemEmissaoAtiva,
  prepararPayloadParaReemissao
} from '../src/services/focus/fiscalRetry.js';

test('tentativa com erro de autorização não bloqueia a reemissão', () => {
  assert.equal(notaPodeSerReemitida('erro_autorizacao'), true);
  assert.equal(notaTemEmissaoAtiva('erro_autorizacao'), false);
  assert.equal(notaPodeSerReemitida('ERRO'), true);
  assert.equal(notaTemEmissaoAtiva('ERRO'), false);
});

test('tentativas autorizadas ou em processamento continuam bloqueando duplicidade', () => {
  assert.equal(notaTemEmissaoAtiva('autorizado'), true);
  assert.equal(notaTemEmissaoAtiva('processando_autorizacao'), true);
  assert.equal(notaTemEmissaoAtiva('aguardando_autorizacao'), true);
});

test('tentativas rejeitadas, denegadas ou canceladas não são ativas', () => {
  assert.equal(notaTemEmissaoAtiva('rejeitado'), false);
  assert.equal(notaTemEmissaoAtiva('denegado'), false);
  assert.equal(notaTemEmissaoAtiva('cancelado'), false);
});

test('reemissão substitui a data UTC rejeitada pelo horário fiscal brasileiro atual', () => {
  const payload = prepararPayloadParaReemissao(
    { data_emissao: '2026-09-01T00:42:48.739Z', items: [] },
    {},
    { agora: new Date('2026-09-01T00:50:00.000Z') }
  );
  assert.equal(payload.data_emissao, '2026-08-31T21:50:00-03:00');
});

test('reemissão aceita a data fiscal escolhida sem reaproveitar o UTC rejeitado', () => {
  const payload = prepararPayloadParaReemissao(
    { data_emissao: '2026-09-01T00:42:48.739Z', items: [] },
    { data_emissao: '2026-08-30' },
    { agora: new Date('2026-09-01T00:50:00.000Z') }
  );
  assert.equal(payload.data_emissao, '2026-08-30T21:50:00-03:00');
});

test('erro 253 não sugere correção fiscal dos produtos', () => {
  assert.deepEqual(classificarErroParaReemissao({
    codigo_retorno: '253',
    mensagem_retorno: 'Dígito Verificador da chave de acesso composta inválida'
  }), {
    destinatario: false,
    pagamento: false,
    items: false,
    erroNaoClassificado: true
  });
});

test('reemissão pode declarar o destinatário como contribuinte isento de IE', () => {
  const payload = prepararPayloadParaReemissao(
    {
      items: [],
      inscricao_estadual_destinatario: '123456789',
      indicador_inscricao_estadual_destinatario: 1
    },
    { destinatario: { isento_inscricao_estadual: true } }
  );

  assert.equal(payload.inscricao_estadual_destinatario, undefined);
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 2);
});

test('reemissão desmarcada volta ao indicador normal do destinatário', () => {
  const payload = prepararPayloadParaReemissao(
    {
      items: [],
      inscricao_estadual_destinatario: '123456789',
      indicador_inscricao_estadual_destinatario: 2
    },
    { destinatario: { isento_inscricao_estadual: false } }
  );

  assert.equal(payload.indicador_inscricao_estadual_destinatario, 1);
});

test('reemissão com IE vazia remove marcador antigo e envia destinatário não contribuinte', () => {
  const payload = prepararPayloadParaReemissao(
    {
      items: [],
      inscricao_estadual_destinatario: 'ISENTO',
      indicador_inscricao_estadual_destinatario: 2
    },
    { destinatario: { inscricao_estadual: '', isento_inscricao_estadual: false } }
  );

  assert.equal(payload.inscricao_estadual_destinatario, undefined);
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 9);
});
