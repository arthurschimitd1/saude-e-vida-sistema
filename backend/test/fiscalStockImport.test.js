import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chaveExternaItem,
  dadosAtualizacaoProdutoExistente,
  parseNFeXml
} from '../src/services/FiscalStockImportService.js';

const XML_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe25260753180523000123550010000001231000001234">
      <ide><nNF>123</nNF><dhEmi>2026-09-10T14:30:00-03:00</dhEmi></ide>
      <emit>
        <CNPJ>53180523000123</CNPJ>
        <xNome>Fornecedor Teste</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>FORN-10</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Café Torrado Especial 500g</xProd>
          <NCM>09012100</NCM>
          <CEST>1709600</CEST>
          <uCom>UN</uCom>
          <qCom>12.0000</qCom>
          <vUnCom>18.7500</vUnCom>
          <vProd>225.00</vProd>
        </prod>
        <imposto>
          <ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>25260753180523000123550010000001231000001234</chNFe></infProt></protNFe>
</nfeProc>`;

test('parser extrai os produtos da NF-e sem depender do nome cadastrado no estoque', () => {
  const parsed = parseNFeXml(XML_NFE);

  assert.equal(parsed.access_key, '25260753180523000123550010000001231000001234');
  assert.equal(parsed.invoice_number, '123');
  assert.equal(parsed.issued_at, '2026-09-10T14:30:00-03:00');
  assert.equal(parsed.supplier_document, '53180523000123');
  assert.equal(parsed.supplier_snapshot.nomeCompleto, 'Fornecedor Teste');
  assert.equal(parsed.supplier_snapshot.cnpj, '53180523000123');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0], {
    item_key: '1',
    external_code: 'FORN-10',
    description: 'Café Torrado Especial 500g',
    quantity: 12,
    unit_cost: 18.75,
    total: 225,
    commercial_unit: 'UN',
    taxable_unit: 'UN',
    barcode: '7891234567890',
    ncm: '09012100',
    cest: '1709600',
    origem: 0,
    cst_csosn: '00'
  });
});

test('vinculo usa codigo externo e recorre ao nome quando a nota nao possui codigo', () => {
  assert.equal(chaveExternaItem({
    external_code: ' ABC-10 ',
    description: 'Nome ignorado'
  }), 'codigo:abc 10');
  assert.equal(chaveExternaItem({
    external_code: null,
    description: 'Café com Leite 500 ml'
  }), 'descricao:cafe com leite 500 ml');
});

test('parser rejeita arquivos que nao sejam uma NF-e com produtos validos', () => {
  assert.throws(() => parseNFeXml('<root />'), /não contém uma NF-e válida/);
});

test('vinculo existente atualiza somente estoque, custo de compra e fornecedor', () => {
  const updates = dadosAtualizacaoProdutoExistente(
    {
      currentQuantity: '8.000',
      preco_compra: '10.00',
      fornecedor_id: 2,
      unidade_medida: 'KG',
      unidade_comercial: 'KG',
      unidade_tributavel: 'G',
      ncm: 'NCM_INTERNO',
      cest: 'CEST_INTERNO',
      cst_csosn: '102',
      price: '25.00'
    },
    {
      quantity: 3,
      unit_cost: 12.5,
      commercial_unit: 'CX',
      taxable_unit: 'UN',
      ncm: 'NCM_DA_NOTA',
      cest: 'CEST_DA_NOTA',
      cst_csosn: '060'
    },
    { id: 7 }
  );

  assert.deepEqual(updates, {
    currentQuantity: 11,
    preco_compra: 12.5,
    fornecedor_id: 7
  });
});
