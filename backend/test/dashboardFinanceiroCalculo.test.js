import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chaveMes,
  montarSerieFinanceira,
  STATUS_PAGAMENTO_REALIZADO,
} from '../src/services/financeiro/DashboardFinanceiroCalculo.js';

test('considera somente pagamentos realizados de recorrencias', () => {
  assert.deepEqual(STATUS_PAGAMENTO_REALIZADO, ['PAGO', 'PAGO_ATRASADO']);
});

test('monta entradas e saidas por mes sem repetir valores futuros', () => {
  const meses = [
    { chave: '2026-07', label: 'jul. 26' },
    { chave: '2026-08', label: 'ago. 26' },
  ];

  const { serieEntradas, serieSaidas } = montarSerieFinanceira({
    meses,
    vendasPorChave: { '2026-07': 100 },
    manualEntradaPorChave: { '2026-08': 25 },
    manualSaidaPorChave: { '2026-08': 10 },
    recorrenciaEntradaPorChave: { '2026-07': 40, '2026-08': 90 },
    recorrenciaSaidaPorChave: { '2026-08': 15 },
    comissoesPorChave: { '2026-08': 5 },
    custoFolha: 200,
    mesAtual: '2026-08',
  });

  assert.deepEqual(serieEntradas, [140, 115]);
  assert.deepEqual(serieSaidas, [0, 230]);
});

test('gera a chave mensal de forma estavel para datas do banco', () => {
  assert.equal(chaveMes('2026-08-20T00:00:00.000Z'), '2026-08');
});

test('aceita a chave usada pela sequencia mensal do dashboard', () => {
  const { serieEntradas } = montarSerieFinanceira({
    meses: [{ key: '2026-08', label: 'ago. 26' }],
    vendasPorChave: { '2026-08': 125 },
  });

  assert.deepEqual(serieEntradas, [125]);
});
