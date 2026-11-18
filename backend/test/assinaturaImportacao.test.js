import test from 'node:test';
import assert from 'node:assert/strict';
import service from '../src/services/AssinaturaImportacaoService.js';

test('normaliza valores, planos e telefones sem perder o nome original', () => {
  const planos = service.normalizePlans([
    { descricao: 'Dom club CUT', valor: 'R$ 89,90', periodicidade: 'Mensal', tipo: 'Plano comum' },
  ]);
  assert.equal(planos[0].nome, 'Dom club CUT');
  assert.equal(planos[0].nomeNormalizado, 'dom club cut');
  assert.equal(planos[0].valor, 89.9);

  const assinantes = service.normalizeSubscribers([
    { nome: 'Pessoa Teste', plano: 'DOM CLUB CUT', contratacao: '20/08/2026', proximoVencimento: '20/09/2026', celular: '(83) 99999-0000' },
  ]);
  assert.equal(assinantes[0].celularNormalizado, '83999990000');
  assert.equal(assinantes[0].contratacao, '2026-08-20');
});

test('não escolhe plano automaticamente quando há duplicidade no PDF', () => {
  const planos = service.normalizePlans([
    { descricao: 'DOM CLUB CUT', valor: '89,90', tipo: 'Plano com recorrência' },
    { descricao: 'DOM CLUB CUT', valor: '89,90', tipo: 'Plano comum' },
  ]);
  const assinantes = service.normalizeSubscribers([
    { nome: 'Pessoa Teste', plano: 'DOM CLUB CUT', contratacao: '20/08/2026', proximoVencimento: '20/09/2026' },
  ]);
  const mapped = service.buildMapping(planos, assinantes);
  assert.equal(mapped[0].situacaoImportacao, 'PENDENTE_MAPEAMENTO');
  assert.equal(mapped[0].planoMapeado, null);
  assert.equal(mapped[0].planoCandidatos.length, 2);
});

test('identifica plano único e plano inexistente', () => {
  const planos = service.normalizePlans([{ descricao: 'DOM CLUB EXECUTIVO', valor: '149,90' }]);
  const assinantes = service.normalizeSubscribers([
    { nome: 'A', plano: 'DOM CLUB EXECUTIVO' },
    { nome: 'B', plano: 'PLANO AUSENTE' },
  ]);
  const mapped = service.buildMapping(planos, assinantes);
  assert.equal(mapped[0].situacaoImportacao, 'PRONTO');
  assert.equal(mapped[1].situacaoImportacao, 'PLANO_NAO_ENCONTRADO');
});

test('aceita escolha explícita da linha do plano quando o nome é ambíguo', () => {
  const planos = service.normalizePlans([
    { descricao: 'DOM CLUB CUT', valor: '89,90', tipo: 'Plano com recorrência', origemLinha: 4 },
    { descricao: 'DOM CLUB CUT', valor: '89,90', tipo: 'Plano comum', origemLinha: 5 },
  ]);
  const assinantes = service.normalizeSubscribers([
    { nome: 'Pessoa Teste', plano: 'DOM CLUB CUT', planoOrigemLinha: 5 },
  ]);
  const mapped = service.buildMapping(planos, assinantes);
  assert.equal(mapped[0].situacaoImportacao, 'PRONTO');
  assert.equal(mapped[0].planoMapeado.origemLinha, 5);
});
