import test from 'node:test';
import assert from 'node:assert/strict';
import { selecionarItensFiscais } from '../src/utils/prepararVendaFiscal.js';

const montarVenda = () => ({
  cfop: '6102',
  cst_csosn: '400',
  desconto: 10,
  tipo_desconto: 'valor',
  taxa_entrega: 5,
  valor_total: 195,
  pagamentos: [{ forma: 'PIX', valor: 195 }],
  itens: [
    { id: 1, valor_total: 100 },
    { id: 2, valor_total: 100 }
  ],
  toJSON() {
    return { ...this };
  }
});

test('emissão parcial preserva CFOP e CST/CSOSN opcionais da venda', () => {
  const { vendaFiscal, emissaoParcial } = selecionarItensFiscais(montarVenda(), [1]);

  assert.equal(emissaoParcial, true);
  assert.equal(vendaFiscal.cfop, '6102');
  assert.equal(vendaFiscal.cst_csosn, '400');
  assert.equal(vendaFiscal.itens.length, 1);
  assert.equal(vendaFiscal.taxa_entrega, 0);
});
