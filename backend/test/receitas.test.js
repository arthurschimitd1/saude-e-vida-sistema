import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCalculadoraCustosReceitas, resolverRendimentoReceita } from '../src/utils/receitas.js';

test('rendimento ausente é inferido somente por embalagem discreta', () => {
  const resolvido = resolverRendimentoReceita({
    rendimento: null,
    itens: [
      { quantidade: 2, produtoMP: { name: 'Ovos', unidade_medida: 'UN' } },
      { quantidade: 15, produtoMP: { name: 'Saquinho Gourmet', unidade_medida: 'UN' } },
    ],
  });
  assert.deepEqual(resolvido, { valor: 15, origem: 'inferido_embalagem', inferido: true, pendente: false });
});
test('custo de receita intermediária é convertido em custo unitário antes de compor outra ficha', () => {
  const saquinho = { id: 1, name: 'Saquinho Gourmet', unidade_medida: 'UN', preco_compra: 0.1 };
  const nutella = { id: 2, name: 'Nutella', unidade_medida: 'KG', preco_compra: 50 };
  const leite = { id: 3, name: 'Leite', unidade_medida: 'LT', preco_compra: 6 };
  const intermediario = { id: 10, name: 'Saq. Nutelíssimo', unidade_medida: 'UN', preco_compra: 196.04 };
  const receitas = [
    { produto_id: 20, nome: 'Dindino Nutelíssimo', rendimento: null, itens: [
      { quantidade: 15, produtoMP: intermediario },
      { quantidade: 1, produtoMP: leite },
    ] },
    { produto_id: 10, nome: 'Saq. Nutelíssimo', rendimento: null, itens: [
      { quantidade: 96, produtoMP: saquinho },
      { quantidade: 3.168, produtoMP: nutella },
    ] },
  ];
  const calculadora = criarCalculadoraCustosReceitas(receitas);
  const custo = calculadora.custoDaReceita(receitas[0]);

  assert.equal(custo.rendimento.valor, 15);
  assert.equal(Number(custo.custoLote.toFixed(2)), 32.25);
  assert.equal(Number(custo.custoUnitario.toFixed(2)), 2.15);
});
