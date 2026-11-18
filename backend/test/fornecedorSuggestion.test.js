import test from 'node:test';
import assert from 'node:assert/strict';
import { montarSugestoesFornecedorXml } from '../src/services/FornecedorService.js';

test('sugestoes de fornecedor agrupam notas do mesmo CNPJ', () => {
  const suggestions = montarSugestoesFornecedorXml([
    {
      id: 2,
      supplier_document: '53.180.523/0001-23',
      supplier_name: 'Fornecedor Atual',
      supplier_snapshot: {
        nomeCompleto: 'Fornecedor Atual',
        telefone: '83999999999',
        cidade: 'João Pessoa',
        estado: 'PB'
      },
      imported_at: '2026-07-29T12:00:00.000Z'
    },
    {
      id: 1,
      supplier_document: '53180523000123',
      supplier_name: 'Fornecedor Antigo',
      supplier_snapshot: {
        email: 'contato@fornecedor.test',
        cep: '58000000'
      },
      imported_at: '2026-07-28T12:00:00.000Z'
    }
  ], []);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].invoice_count, 2);
  assert.equal(suggestions[0].cnpj, '53.180.523/0001-23');
  assert.equal(suggestions[0].nomeCompleto, 'Fornecedor Atual');
  assert.equal(suggestions[0].email, 'contato@fornecedor.test');
  assert.equal(suggestions[0].cep, '58000-000');
});

test('fornecedor já cadastrado na empresa não volta como sugestão', () => {
  const suggestions = montarSugestoesFornecedorXml([
    {
      id: 3,
      supplier_document: '53180523000123',
      supplier_name: 'Fornecedor Repetido',
      supplier_snapshot: {}
    }
  ], [
    { cnpj: '53.180.523/0001-23', cpf: null }
  ]);

  assert.deepEqual(suggestions, []);
});

test('documentos diferentes continuam gerando sugestões separadas', () => {
  const suggestions = montarSugestoesFornecedorXml([
    { id: 1, supplier_document: '53180523000123', supplier_name: 'Empresa A' },
    { id: 2, supplier_document: '12345678901', supplier_name: 'Pessoa B' }
  ], []);

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].cnpj, '53.180.523/0001-23');
  assert.equal(suggestions[1].cpf, '123.456.789-01');
});
