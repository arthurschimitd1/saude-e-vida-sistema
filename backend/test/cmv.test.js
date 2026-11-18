import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConsumoTeorico,
  calcularCustoRealCompetencia,
  consolidarCompras,
  consolidarCustosHistoricos,
  montarComparativo,
  reconstruirEstoqueNoPeriodo,
} from '../src/utils/cmv.js';

test('reconstrói os estoques inicial e final a partir do saldo atual e dos movimentos', () => {
  const inicio = new Date('2026-09-01T00:00:00Z');
  const fim = new Date('2026-10-01T00:00:00Z');
  const resultado = reconstruirEstoqueNoPeriodo(
    [{ id: 1, currentQuantity: 8 }],
    [
      { produto_id: 1, tipo: 'entrada', quantidade: 10, data: '2026-09-05T12:00:00Z' },
      { produto_id: 1, tipo: 'saida', quantidade: 4, data: '2026-09-20T12:00:00Z' },
      { produto_id: 1, tipo: 'saida', quantidade: 2, data: '2026-10-03T12:00:00Z' },
    ],
    inicio,
    fim,
  );
  assert.deepEqual(resultado, [{ produtoId: 1, estoqueInicial: 4, estoqueFinal: 10 }]);
});

test('CMV financeiro consolida quantidade e valor exato das notas de entrada', () => {
  const resultado = consolidarCompras(
    [{ id: 8, supplier_name: 'Fornecedor A', issued_at: '2026-09-03', imported_at: '2026-09-04', invoice_number: '123' }],
    [
      { id: 1, import_id: 8, product_id: 2, description: 'Leite', quantity: 10, unit_cost: 4.5 },
      { id: 2, import_id: 8, product_id: 2, description: 'Leite', quantity: 5, unit_cost: 5 },
    ],
    new Map([[2, { id: 2, name: 'Leite integral', category: 'Insumos', unidade_medida: 'L' }]]),
  );
  assert.deepEqual(resultado.porProduto.get(2), { quantidade: 15, valor: 70 });
  assert.equal(resultado.detalhes[0].fornecedor, 'Fornecedor A');
  assert.equal(resultado.detalhes[0].dataOriginalDisponivel, true);
});

test('CMV teórico aplica rendimento da ficha às vendas e aponta venda sem ficha', () => {
  const ingrediente = { id: 9, name: 'Leite', unidade_medida: 'L', preco_compra: 5 };
  const resultado = calcularConsumoTeorico(
    [{ itens: [
      { tipo: 'produto', produto_id: 20, quantidade: 100, Product: { name: 'Dindino' } },
      { tipo: 'produto', produto_id: 21, quantidade: 5, Product: { name: 'Pudim' } },
    ] }],
    [{ produto_id: 20, nome: 'Dindino', rendimento: 50, itens: [{ quantidade: 2, produtoMP: ingrediente }] }],
  );
  assert.deepEqual(resultado.porIngrediente.get(9), { quantidade: 4, valor: 20 });
  assert.equal(resultado.semFicha[0].produto, 'Pudim');
  assert.equal(resultado.coberturaPercentual, 95.2);
});

test('CMV teórico infere rendimento pela embalagem e decompõe fichas intermediárias', () => {
  const saquinho = { id: 1, name: 'Saquinho Gourmet', unidade_medida: 'UN', preco_compra: 0.1 };
  const nutella = { id: 2, name: 'Nutella', unidade_medida: 'KG', preco_compra: 50 };
  const leite = { id: 3, name: 'Leite', unidade_medida: 'LT', preco_compra: 6 };
  const saqNutelissimo = { id: 10, name: 'Saq. Nutelíssimo', unidade_medida: 'UN', preco_compra: 196.04 };
  const resultado = calcularConsumoTeorico(
    [{ itens: [{ tipo: 'produto', produto_id: 20, quantidade: 469, Product: { name: 'Dindino Nutelíssimo' } }] }],
    [
      { produto_id: 20, nome: 'Dindino Nutelíssimo', rendimento: null, itens: [
        { quantidade: 15, produtoMP: saqNutelissimo },
        { quantidade: 1, produtoMP: leite },
      ] },
      { produto_id: 10, nome: 'Saq. Nutelíssimo', rendimento: null, itens: [
        { quantidade: 96, produtoMP: saquinho },
        { quantidade: 3.168, produtoMP: nutella },
      ] },
    ],
  );

  assert.equal(resultado.porIngrediente.has(10), false);
  assert.deepEqual(resultado.porIngrediente.get(1), { quantidade: 469, valor: 46.9 });
  assert.deepEqual(resultado.porIngrediente.get(2), { quantidade: 15.477, valor: 773.85 });
  assert.deepEqual(resultado.porIngrediente.get(3), { quantidade: 31.267, valor: 187.6 });
  assert.equal(resultado.fichas, undefined);
  assert.equal(resultado.detalhes[0].rendimento, 15);
  assert.equal(resultado.detalhes[0].rendimentoInferido, true);
  assert.deepEqual(resultado.produtosIntermediarios, [10]);
});

test('CMV teórico não inventa custo quando o rendimento não pode ser determinado', () => {
  const leite = { id: 3, name: 'Leite', unidade_medida: 'LT', preco_compra: 6 };
  const resultado = calcularConsumoTeorico(
    [{ itens: [{ tipo: 'produto', produto_id: 20, quantidade: 10, Product: { name: 'Produto sem rendimento' } }] }],
    [{ produto_id: 20, nome: 'Produto sem rendimento', rendimento: null, itens: [{ quantidade: 1, produtoMP: leite }] }],
  );

  assert.equal(resultado.porIngrediente.size, 0);
  assert.equal(resultado.semFicha[0].motivo, 'rendimento_pendente');
  assert.equal(resultado.coberturaPercentual, 0);
});

test('comparativo calcula CMV real e divergência contra o teórico', () => {
  const [linha] = montarComparativo({
    produtos: [{ id: 1, name: 'Leite', category: 'Insumos', unidade_medida: 'L', preco_compra: 4 }],
    posicoes: [{ produtoId: 1, estoqueInicial: 20, estoqueFinal: 12 }],
    comprasPorProduto: new Map([[1, { quantidade: 10, valor: 50 }]]),
    teoricoPorProduto: new Map([[1, { quantidade: 15, valor: 75 }]]),
  });
  assert.equal(linha.consumoReal, 18);
  assert.equal(linha.valorReal, 90);
  assert.equal(linha.diferencaQuantidade, 3);
  assert.equal(linha.diferencaValor, 15);
});

test('CMV real da competência usa o custo histórico anterior à venda, mesmo sem compra no período', () => {
  const leite = { id: 9, name: 'Leite', unidade_medida: 'L', preco_compra: 12 };
  const produto = { id: 20, name: 'Dindino', category: 'Produção', unidade_medida: 'UN', preco_compra: 0 };
  const importacoes = [
    { id: 1, issued_at: '2026-08-20T12:00:00Z', imported_at: '2026-08-20T12:00:00Z' },
    { id: 2, issued_at: '2026-09-10T12:00:00Z', imported_at: '2026-09-10T12:00:00Z' },
  ];
  const custos = consolidarCustosHistoricos(importacoes, [
    { import_id: 1, product_id: 9, quantity: 10, unit_cost: 5, action: 'link' },
    { import_id: 2, product_id: 9, quantity: 10, unit_cost: 10, action: 'link' },
  ]);
  const [linha] = calcularCustoRealCompetencia({
    vendas: [{ data: '2026-09-05T12:00:00Z', itens: [{ tipo: 'produto', produto_id: 20, quantidade: 2 }] }],
    produtos: [produto, leite],
    receitas: [{ produto_id: 20, nome: 'Dindino', rendimento: 1, itens: [{ quantidade: 2, produtoMP: leite }] }],
    custosHistoricos: custos,
  });

  assert.equal(linha.quantidadeVendida, 2);
  assert.equal(linha.custoUnitarioReal, 10);
  assert.equal(linha.valorRealCompetencia, 20);
});
