import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularComissoesVenda } from '../src/services/ComissaoCalculo.js';

test('separa comissão percentual de produtos e serviços', () => {
  const resultado = calcularComissoesVenda({
    itens: [
      { tipo: 'produto', valor_total: 100 },
      { tipo: 'servico', valor_total: 60 }
    ],
    desconto: 20,
    tipo: 'percent',
    valor: 10
  });
  assert.deepEqual(resultado.map(item => ({ origem: item.origem, base: item.base_calculo, valor: item.valor })), [
    { origem: 'venda_produtos', base: 80, valor: 8 },
    { origem: 'venda_servicos', base: 60, valor: 6 }
  ]);
});

test('comissão fixa permanece uma única vez por venda', () => {
  const resultado = calcularComissoesVenda({
    itens: [{ tipo: 'produto', valor_total: 100 }, { tipo: 'servico', valor_total: 50 }],
    desconto: 0,
    tipo: 'valor',
    valor: 25
  });
  assert.deepEqual(resultado, [{ origem: 'venda', base_calculo: 150, valor: 25 }]);
});

test('desconto excedente de produtos reduz a base dos serviços', () => {
  const resultado = calcularComissoesVenda({
    itens: [{ tipo: 'produto', valor_total: 20 }, { tipo: 'servico', valor_total: 80 }],
    desconto: 30,
    tipo: 'percent',
    valor: 10
  });
  assert.deepEqual(resultado, [{
    origem: 'venda_servicos',
    base_calculo: 70,
    valor: 7,
    detalhes_calculo: { total_itens: 80, desconto_aplicado: 10 }
  }]);
});

test('total líquido preserva desconto percentual sem tratá-lo como reais', () => {
  const resultado = calcularComissoesVenda({
    itens: [{ tipo: 'produto', valor_total: 100 }, { tipo: 'servico', valor_total: 100 }],
    desconto: 10,
    totalVenda: 180,
    tipo: 'percent',
    valor: 10
  });
  assert.deepEqual(resultado.map(item => ({ origem: item.origem, base: item.base_calculo, valor: item.valor })), [
    { origem: 'venda_produtos', base: 80, valor: 8 },
    { origem: 'venda_servicos', base: 100, valor: 10 }
  ]);
});
