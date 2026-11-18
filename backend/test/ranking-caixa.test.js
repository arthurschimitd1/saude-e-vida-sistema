import assert from 'node:assert/strict';
import test from 'node:test';

import { montarRankingCaixa, validarPeriodoRanking } from '../src/services/RankingCaixaService.js';

test('ranking do caixa ordena profissionais e compara com o período anterior', () => {
  const resultado = montarRankingCaixa({
    atual: [
      {
        profissional_id: 2, profissional: 'Beatriz', vendas: '4', clientes: '3', faturamento: '800.00',
        servicos_quantidade: '3', servicos_valor: '500.00', produtos_quantidade: '5', produtos_valor: '300.00'
      },
      {
        profissional_id: 1, profissional: 'Alex', vendas: '6', clientes: '5', faturamento: '1200.00',
        servicos_quantidade: '6', servicos_valor: '900.00', produtos_quantidade: '2', produtos_valor: '300.00'
      }
    ],
    anterior: [
      { profissional_id: 1, faturamento: '1000.00' },
      { profissional_id: 2, faturamento: '1000.00' }
    ]
  });

  assert.equal(resultado.ranking[0].profissional, 'Alex');
  assert.equal(resultado.ranking[0].posicao, 1);
  assert.equal(resultado.ranking[0].ticket_medio, 200);
  assert.equal(resultado.ranking[0].variacao_percentual, 20);
  assert.equal(resultado.ranking[1].variacao_percentual, -20);
  assert.deepEqual(resultado.resumo, {
    faturamento: 2000,
    vendas: 10,
    clientes: 8,
    servicos_quantidade: 9,
    servicos_valor: 1400,
    produtos_quantidade: 7,
    produtos_valor: 600,
    ticket_medio: 200
  });
});

test('ranking não inventa variação quando não existe venda no período anterior', () => {
  const resultado = montarRankingCaixa({
    atual: [{ profissional_id: 3, profissional: 'Caio', vendas: 1, clientes: 1, faturamento: 50 }],
    anterior: []
  });

  assert.equal(resultado.ranking[0].variacao_percentual, null);
  assert.equal(resultado.ranking[0].servicos_quantidade, 0);
  assert.equal(resultado.ranking[0].produtos_valor, 0);
});

test('ranking aceita apenas períodos válidos de até um ano', () => {
  assert.deepEqual(validarPeriodoRanking({ inicio: '2026-09-01', fim: '2026-09-30' }), {
    inicio: '2026-09-01', fim: '2026-09-30'
  });
  assert.throws(() => validarPeriodoRanking({ inicio: '2026-09-31', fim: '2026-10-01' }), /período válido/);
  assert.throws(() => validarPeriodoRanking({ inicio: '2025-01-01', fim: '2026-02-01' }), /no máximo um ano/);
});
