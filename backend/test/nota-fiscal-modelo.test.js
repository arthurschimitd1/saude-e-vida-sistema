import test from 'node:test';
import assert from 'node:assert/strict';
import NotaFiscal from '../src/models/NotaFiscal.js';

test('modelo de notas fiscais aponta para a tabela e campos fiscais corretos', () => {
  assert.equal(NotaFiscal.getTableName(), 'notas_fiscais');
  assert.equal(NotaFiscal.name, 'NotaFiscal');
  assert.ok(NotaFiscal.rawAttributes.empresa_id);
  assert.ok(NotaFiscal.rawAttributes.venda_id);
  assert.ok(NotaFiscal.rawAttributes.payload_enviado);
  assert.ok(NotaFiscal.rawAttributes.resposta_api);
  assert.equal(NotaFiscal.rawAttributes.name, undefined);
});
