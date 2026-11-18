import test from 'node:test';
import assert from 'node:assert/strict';
import NFePayloadBuilder from '../src/services/builders/NFePayloadBuilder.js';

const montarPayload = (
  cfopVenda,
  cstCsosnVenda = '',
  regimeTributario = 1,
  cliente = null,
  destinatarioIsentoIE = false
) => NFePayloadBuilder.build({
  venda: {
    cfop: cfopVenda,
    cst_csosn: cstCsosnVenda,
    valor_total: 10,
    desconto: 0,
    taxa_entrega: 0
  },
  cliente,
  configuracaoFiscal: {
    cnpj: '12345678000190',
    razao_social: 'Empresa Teste',
    regime_tributario: regimeTributario
  },
  destinatarioIsentoIE,
  itens: [{
    quantidade: 1,
    valor_unitario: 10,
    valor_total: 10,
    produto: {
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

test('NF-e usa o CFOP opcional informado na venda', () => {
  assert.equal(montarPayload('6102').items[0].cfop, '6102');
});

test('NF-e mantém o CFOP do produto quando a venda não informa CFOP', () => {
  assert.equal(montarPayload('').items[0].cfop, '5102');
});

test('NF-e envia data de emissão com fuso brasileiro explícito', () => {
  assert.match(montarPayload('').data_emissao, /-03:00$/);
});

test('NF-e aceita CST de 2 dígitos informado na venda', () => {
  assert.equal(montarPayload('', '00', 3).items[0].icms_situacao_tributaria, '00');
});

test('NF-e aceita CSOSN de 3 dígitos informado na venda', () => {
  assert.equal(montarPayload('', '400').items[0].icms_situacao_tributaria, '400');
});

test('NF-e mantém o CST/CSOSN do produto quando a venda não informa', () => {
  assert.equal(montarPayload('', '').items[0].icms_situacao_tributaria, '102');
});

test('NF-e só declara IE isenta quando o operador marcar a opção', () => {
  const cliente = {
    nomeCompleto: 'Cliente isento',
    cnpj: '12345678000199',
    inscricao_estadual: '123456789'
  };

  const normal = montarPayload('', '', 1, cliente);
  assert.equal(normal.inscricao_estadual_destinatario, '123456789');
  assert.equal(normal.indicador_inscricao_estadual_destinatario, 1);

  const isento = montarPayload('', '', 1, cliente, true);
  assert.equal(isento.inscricao_estadual_destinatario, undefined);
  assert.equal(isento.indicador_inscricao_estadual_destinatario, 2);
});

test('NF-e trata marcador ISENTO como ausência de IE quando não há declaração de isenção', () => {
  const payload = montarPayload('', '', 1, {
    nomeCompleto: 'Cliente sem IE',
    cnpj: '12345678000199',
    inscricao_estadual: 'ISENTO'
  });

  assert.equal(payload.inscricao_estadual_destinatario, undefined);
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 9);
});

test('NF-e rejeita CST incompatível com o Simples Nacional antes da Focus', () => {
  assert.throws(
    () => montarPayload('', '00', 1),
    /CSOSN com 3 dígitos/
  );
});

test('NF-e rejeita CSOSN incompatível com o regime normal antes da Focus', () => {
  assert.throws(
    () => montarPayload('', '102', 3),
    /CST com 2 dígitos/
  );
});
