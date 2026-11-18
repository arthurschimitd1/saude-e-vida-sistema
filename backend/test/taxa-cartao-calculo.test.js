import test from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import taxaCartaoService, { calcularValorTaxa } from '../src/services/TaxaCartaoService.js';
import TaxaCartao from '../src/models/TaxaCartao.js';

test('calcula e congela bruto, taxa e líquido do cartão', () => {
  assert.deepEqual(calcularValorTaxa(100, 3.5, 0.5), {
    valor_bruto: 100,
    valor_taxa: 4,
    valor_liquido: 96
  });
});

test('arredonda valores monetários em centavos', () => {
  assert.deepEqual(calcularValorTaxa(19.99, 2.99), {
    valor_bruto: 19.99,
    valor_taxa: 0.6,
    valor_liquido: 19.39
  });
});

test('vigência usa a data comercial brasileira da venda', async () => {
  const original = TaxaCartao.findOne;
  let whereRecebido;
  TaxaCartao.findOne = async ({ where }) => {
    whereRecebido = where;
    return null;
  };
  try {
    await taxaCartaoService.aplicar(
      { forma: 'CARTAO', bandeira: 'visa', tipoCartao: 'credito', parcelas: 1, valor: 100 },
      3,
      '2026-09-01T01:30:00.000Z',
    );
    assert.equal(whereRecebido.vigencia_inicio[Op.lte], '2026-08-31');
  } finally {
    TaxaCartao.findOne = original;
  }
});
