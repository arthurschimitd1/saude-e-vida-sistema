import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FiscalEmpresaScopeError,
  resolverEmpresaFiscal
} from '../src/utils/fiscalEmpresaScope.js';

test('usuário comum acessa a própria empresa', () => {
  assert.equal(
    resolverEmpresaFiscal({ tipo: 'USUARIO', empresa_id: 19 }, '19'),
    19
  );
});

test('usuário comum não acessa outra empresa', () => {
  assert.throws(
    () => resolverEmpresaFiscal({ tipo: 'USUARIO', empresa_id: 19 }, '20'),
    (error) => error instanceof FiscalEmpresaScopeError && error.statusCode === 403
  );
});

test('empresa do JWT é usada quando a rota não informa ID', () => {
  assert.equal(
    resolverEmpresaFiscal({ tipo: 'EMPRESA', empresa_id: 27 }, undefined),
    27
  );
});

test('MASTER com empresa selecionada fica limitado ao override', () => {
  assert.equal(
    resolverEmpresaFiscal(
      { tipo: 'MASTER', empresa_id_override: 31 },
      '31'
    ),
    31
  );
});

test('MASTER não pode misturar URL e empresa selecionada', () => {
  assert.throws(
    () => resolverEmpresaFiscal(
      { tipo: 'MASTER', empresa_id_override: 31 },
      '32'
    ),
    (error) => error instanceof FiscalEmpresaScopeError && error.statusCode === 403
  );
});

test('MASTER sem override mantém compatibilidade com ID da rota atual', () => {
  assert.equal(
    resolverEmpresaFiscal({ tipo: 'MASTER' }, '42'),
    42
  );
});
