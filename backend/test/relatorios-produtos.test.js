import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparProducaoPorProduto,
  agruparVendasPorProduto,
  resolverPeriodoRelatorio,
} from '../src/utils/relatoriosProdutos.js';

test('relatório de vendas compila produtos e exclui serviços', () => {
  const resultado = agruparVendasPorProduto([
    {
      id: 10,
      itens: [
        { tipo: 'produto', produto_id: 1, quantidade: '2', valor_total: '20.00', Product: { name: 'Ninho com Nutella', category: 'Dindinos', unidade_medida: 'UN' } },
        { tipo: 'servico', nome_item: 'Entrega', quantidade: '1', valor_total: '5.00' },
      ],
    },
    {
      id: 11,
      itens: [
        { tipo: 'produto', produto_id: 1, quantidade: '3', valor_total: '30.00', Product: { name: 'Ninho com Nutella', category: 'Dindinos', unidade_medida: 'UN' } },
        { tipo: 'produto', produto_id: 2, quantidade: '1', valor_total: '8.00', Product: { name: 'Pudim', category: 'Dindinos', unidade_medida: 'UN' } },
      ],
    },
  ]);

  assert.equal(resultado.linhas.length, 2);
  assert.equal(resultado.linhas[0].produto, 'Ninho com Nutella');
  assert.equal(resultado.linhas[0].quantidade, 5);
  assert.equal(resultado.linhas[0].vendas, 2);
  assert.equal(resultado.totais.quantidade, 6);
  assert.equal(resultado.totais.valorVendido, 58);
  assert.equal(resultado.totais.vendas, 2);
});

test('relatório financeiro calcula custo da ficha, venda média e lucro bruto', () => {
  const custosReceita = new Map([[1, { custoUnitario: 2.5 }]]);
  const resultado = agruparVendasPorProduto([
    {
      id: 20,
      itens: [
        { tipo: 'produto', produto_id: 1, quantidade: '4', valor_total: '24.00', Product: { name: 'Ninho com Nutella', category: 'Dindinos', unidade_medida: 'UN', preco_compra: 1 } },
      ],
    },
  ], new Map(), new Map(), {}, custosReceita);

  assert.equal(resultado.linhas[0].custoUnitario, 2.5);
  assert.equal(resultado.linhas[0].custoTotal, 10);
  assert.equal(resultado.linhas[0].precoVendaMedio, 6);
  assert.equal(resultado.linhas[0].lucroBruto, 14);
  assert.equal(resultado.linhas[0].fonteCusto, 'ficha_tecnica');
  assert.equal(resultado.totais.custoTotal, 10);
  assert.equal(resultado.totais.lucroBruto, 14);
});

test('relatório financeiro usa custo cadastrado quando não há ficha técnica', () => {
  const resultado = agruparVendasPorProduto([
    { id: 21, itens: [{ tipo: 'produto', produto_id: 2, quantidade: 3, valor_total: 15, Product: { name: 'Pudim', category: 'Dindinos', preco_compra: 1.25 } }] },
  ]);

  assert.equal(resultado.linhas[0].custoUnitario, 1.25);
  assert.equal(resultado.linhas[0].custoTotal, 3.75);
  assert.equal(resultado.linhas[0].fonteCusto, 'cadastro_produto');
});

test('relatório financeiro rateia desconto e não transforma entrega em venda de produto', () => {
  const resultado = agruparVendasPorProduto([
    {
      id: 22,
      desconto: 5,
      tipo_desconto: 'valor',
      taxa_entrega: 10,
      itens: [
        { tipo: 'produto', produto_id: 1, quantidade: 2, valor_total: 20, Product: { name: 'Ninho', category: 'Dindinos', preco_compra: 2 } },
        { tipo: 'servico', nome_item: 'Serviço', quantidade: 1, valor_total: 10 },
      ],
    },
  ], new Map(), new Map(), { considerarDesconto: true });

  assert.equal(Number(resultado.linhas[0].valorVendido.toFixed(2)), 16.67);
  assert.equal(resultado.linhas[0].custoTotal, 4);
});

test('relatório agrupa roupa pelo produto e preserva resumo das variações', () => {
  const roupas = new Map([[7, { id: 7, nome: 'Camisa Premium', tipo: 'Camisas' }]]);
  const variacoes = new Map([
    [70, { id: 70, cor: 'Preta', tamanho: 'M' }],
    [71, { id: 71, cor: 'Branca', tamanho: 'G' }],
  ]);
  const resultado = agruparVendasPorProduto([
    { id: 1, itens: [{ tipo: 'roupa', roupa_id: 7, variacao_id: 70, quantidade: 2, valor_total: 100 }] },
    { id: 2, itens: [{ tipo: 'roupa', roupa_id: 7, variacao_id: 71, quantidade: 1, valor_total: 50 }] },
  ], roupas, variacoes);

  assert.equal(resultado.linhas.length, 1);
  assert.equal(resultado.linhas[0].quantidade, 3);
  assert.deepEqual(resultado.linhas[0].variacoes, [
    { nome: 'Preta · M', quantidade: 2 },
    { nome: 'Branca · G', quantidade: 1 },
  ]);
});

test('filtros de categoria e nome são aplicados no compilado', () => {
  const resultado = agruparVendasPorProduto([
    { id: 1, itens: [{ tipo: 'produto', produto_id: 1, quantidade: 4, valor_total: 20, Product: { name: 'Ninho com Nutella', category: 'Dindinos' } }] },
    { id: 2, itens: [{ tipo: 'produto', produto_id: 2, quantidade: 9, valor_total: 90, Product: { name: 'Brigadeiro', category: 'Doces' } }] },
  ], new Map(), new Map(), { categoria: 'Dindinos', produto: 'nutella' });

  assert.deepEqual(resultado.linhas.map((linha) => linha.produto), ['Ninho com Nutella']);
  assert.deepEqual(resultado.categorias, ['Dindinos', 'Doces']);
});

test('produção usa a quantidade real das entradas e conta ordens únicas', () => {
  const resultado = agruparProducaoPorProduto([
    { produto_id: 3, quantidade: '1000', origem_id: 20, motivo: 'Produção — Dindino de Pudim', produto: { name: 'Dindino de Pudim', category: 'Dindinos', unidade_medida: 'UN' } },
    { produto_id: 3, quantidade: '500', origem_id: 21, motivo: 'Produção — Dindino de Pudim', produto: { name: 'Dindino de Pudim', category: 'Dindinos', unidade_medida: 'UN' } },
  ]);

  assert.equal(resultado.linhas[0].quantidade, 1500);
  assert.equal(resultado.linhas[0].ordens, 2);
  assert.equal(resultado.totais.ordens, 2);
});

test('período rejeita intervalo invertido', () => {
  assert.throws(() => resolverPeriodoRelatorio('2026-09-30', '2026-09-01'), /data inicial/i);
});
