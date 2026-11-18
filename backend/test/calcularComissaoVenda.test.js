import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularComissaoVenda, normalizarNomeServico } from '../src/utils/calcularComissaoVenda.js';

test('sem regra especial mantém exatamente a comissão percentual atual', () => {
  const resultado = calcularComissaoVenda({
    totalVenda: 200,
    itens: [{ nome_item: 'Barba', valor_total: 200 }],
    funcionario: { comissao_tipo: 'percent', comissao_valor: 30 },
    regras: []
  });
  assert.equal(resultado.valor, 60);
  assert.equal(resultado.origem, 'colaborador');
});

test('sem regra especial mantém exatamente a comissão fixa atual', () => {
  const resultado = calcularComissaoVenda({
    totalVenda: 200,
    funcionario: { comissao_tipo: 'valor', comissao_valor: 25 },
    regras: []
  });
  assert.equal(resultado.valor, 25);
});

test('regra especial afeta somente o serviço configurado', () => {
  const resultado = calcularComissaoVenda({
    totalVenda: 150,
    itens: [
      { nome_item: 'Barba', valor_total: 50 },
      { nome_item: 'Corte', valor_total: 100 }
    ],
    funcionario: { comissao_tipo: 'percent', comissao_valor: 30 },
    regras: [{ servico_chave: 'barba', percentual: 45 }]
  });
  assert.equal(resultado.valor, 52.5);
  assert.equal(resultado.origem, 'servico');
  assert.equal(resultado.detalhes.servicos[0].valor, 22.5);
});

test('nome do serviço é comparado sem diferença de acentos e maiúsculas', () => {
  assert.equal(normalizarNomeServico('  Design de Sobrancelha  '), 'design de sobrancelha');
  assert.equal(normalizarNomeServico('COLORAÇÃO'), 'coloracao');
});

test('regra não correspondente não altera o cálculo legado', () => {
  const resultado = calcularComissaoVenda({
    totalVenda: 80,
    itens: [{ nome_item: 'Corte', valor_total: 80 }],
    funcionario: { comissao_tipo: 'percent', comissao_valor: 30 },
    regras: [{ servico_chave: 'barba', percentual: 45 }]
  });
  assert.equal(resultado.valor, 24);
  assert.equal(resultado.origem, 'colaborador');
});
