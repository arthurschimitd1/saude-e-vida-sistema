import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularBaseComissaoUsuario,
  calcularValorComissao,
  valoresDoItem,
} from '../src/services/VendaService.js';

test('venda usa o preco do estoque quando nenhum valor foi editado', () => {
  assert.deepEqual(
    valoresDoItem({ quantidade: 2 }, 20),
    { quantidade: 2, valor_unitario: 20, valor_total: 40 }
  );
});

test('venda preserva o preco editado somente no item da venda', () => {
  assert.deepEqual(
    valoresDoItem({ quantidade: 2, valor_unitario: 17.5 }, 20),
    { quantidade: 2, valor_unitario: 17.5, valor_total: 35 }
  );
});

test('venda combinada calcula cada item com seu proprio valor', () => {
  const itens = [
    valoresDoItem({ quantidade: 1 }, 20),
    valoresDoItem({ quantidade: 2, valor_unitario: 7.5 }, 10),
    valoresDoItem({ quantidade: 0.25, valor_unitario: 80 }, 80),
  ];

  assert.deepEqual(itens.map(item => item.valor_total), [20, 15, 20]);
  assert.equal(itens.reduce((total, item) => total + item.valor_total, 0), 55);
});

test('produto a granel usa quantidade fracionada e preco por unidade', () => {
  assert.deepEqual(
    valoresDoItem({ quantidade: 0.1, valor_unitario: 100 }, 100),
    { quantidade: 0.1, valor_unitario: 100, valor_total: 10 }
  );
});

test('item de venda rejeita quantidade zerada ou negativa', () => {
  assert.throws(
    () => valoresDoItem({ quantidade: 0, valor_unitario: 10 }, 10),
    /quantidade do item deve ser um numero maior que zero/
  );
  assert.throws(
    () => valoresDoItem({ quantidade: -1, valor_unitario: 10 }, 10),
    /quantidade do item deve ser um numero maior que zero/
  );
});

test('venda apenas com produtos mantém a comissão sobre o total da venda', () => {
  assert.equal(calcularBaseComissaoUsuario(120, 0), 120);
  assert.equal(calcularValorComissao('percent', 10, 120), 12);
});

test('venda apenas com serviço agendado não gera comissão duplicada do usuário', () => {
  assert.equal(calcularBaseComissaoUsuario(80, 80), 0);
  assert.equal(calcularValorComissao('percent', 40, 80), 32);
});

test('venda mista separa produto e serviço nas bases de comissão', () => {
  const totalVenda = 180;
  const servicoAgenda = 60;
  const baseProdutos = calcularBaseComissaoUsuario(totalVenda, servicoAgenda);

  assert.equal(baseProdutos, 120);
  assert.equal(calcularValorComissao('percent', 5, baseProdutos), 6);
  assert.equal(calcularValorComissao('percent', 40, servicoAgenda), 24);
});

test('comissão fixa do serviço acompanha a quantidade vendida', () => {
  assert.equal(calcularValorComissao('valor', 7.5, 100, 2), 15);
});

test('desconto nunca deixa a base de produtos negativa', () => {
  assert.equal(calcularBaseComissaoUsuario(50, 60), 0);
});
