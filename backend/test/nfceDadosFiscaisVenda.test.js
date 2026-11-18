import test from 'node:test';
import assert from 'node:assert/strict';
import NFCePayloadBuilder from '../src/services/builders/NFCePayloadBuilder.js';

const montarPayload = ({ cfop = '', cstCsosn = '', regimeTributario = 1, taxaEntrega = 0 } = {}) =>
  NFCePayloadBuilder.build({
    venda: {
      cfop,
      cst_csosn: cstCsosn,
      valor_total: 10 + taxaEntrega,
      desconto: 0,
      taxa_entrega: taxaEntrega,
      pagamentos: [{ forma: 'PIX', valor: 10 + taxaEntrega }]
    },
    cliente: null,
    configuracaoFiscal: {
      cnpj: '12345678000190',
      uf: 'PB',
      regime_tributario: regimeTributario
    },
    itens: [{
      quantidade: 1,
      valor_unitario: 10,
      valor_total: 10,
      produto: {
        id: 1,
        code: 'P1',
        name: 'Produto',
        cfop: '5102',
        ncm: '12345678',
        origem: 0,
        cst_csosn: '102',
        cst_pis: '07',
        cst_cofins: '07'
      }
    }]
  });

test('NFC-e usa o CFOP opcional informado na venda', () => {
  assert.equal(montarPayload({ cfop: '6102' }).items[0].cfop, '6102');
});

test('NFC-e mantém o CFOP do produto quando a venda não informa CFOP', () => {
  assert.equal(montarPayload().items[0].cfop, '5102');
});

test('NFC-e envia data de emissão com fuso brasileiro explícito', () => {
  assert.match(montarPayload().data_emissao, /-03:00$/);
});

test('NFC-e aceita CST de 2 dígitos informado na venda', () => {
  assert.equal(montarPayload({ cstCsosn: '00', regimeTributario: 3 }).items[0].icms_situacao_tributaria, '00');
});

test('NFC-e aceita CSOSN de 3 dígitos informado na venda', () => {
  assert.equal(montarPayload({ cstCsosn: '400' }).items[0].icms_situacao_tributaria, '400');
});

test('NFC-e mantém o CST/CSOSN do produto quando a venda não informa', () => {
  assert.equal(montarPayload().items[0].icms_situacao_tributaria, '102');
});

test('NFC-e aplica os dados fiscais opcionais também à taxa de entrega', () => {
  const payload = montarPayload({ cfop: '6102', cstCsosn: '400', taxaEntrega: 5 });
  assert.equal(payload.items[1].cfop, '6102');
  assert.equal(payload.items[1].icms_situacao_tributaria, '400');
});

test('NFC-e rejeita CST incompatível com o Simples Nacional antes da Focus', () => {
  assert.throws(
    () => montarPayload({ cstCsosn: '00', regimeTributario: 1 }),
    /CSOSN com 3 dígitos/
  );
});

test('NFC-e rejeita CSOSN incompatível com o regime normal antes da Focus', () => {
  assert.throws(
    () => montarPayload({ cstCsosn: '102', regimeTributario: 3 }),
    /CST com 2 dígitos/
  );
});
