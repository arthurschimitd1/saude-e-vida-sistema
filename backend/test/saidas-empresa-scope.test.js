import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { empresaParaGravar } from '../src/utils/empresaScope.js';

test('empresa selecionada pelo MASTER prevalece no escopo das saídas', () => {
  assert.equal(empresaParaGravar({ tipo: 'MASTER', empresa_id: 1, empresa_id_override: 42 }), 42);
  assert.equal(empresaParaGravar({ tipo: 'USUARIO', empresa_id: 9, empresa_id_override: 42 }), 9);
  assert.equal(empresaParaGravar({ tipo: 'MASTER', empresa_id: 1, empresa_id_override: null }), null);
});

test('CRUD financeiro de saídas exige empresa e sempre filtra por ela', () => {
  const source = readFileSync(new URL('../src/controllers/financeiroController.js', import.meta.url), 'utf8');
  for (const nome of ['listarSaidas', 'criarSaida', 'atualizarSaida', 'deletarSaida']) {
    const inicio = source.indexOf(`export const ${nome} =`);
    assert.notEqual(inicio, -1);
    const fim = source.indexOf('\n};', inicio);
    const bloco = source.slice(inicio, fim);
    assert.match(bloco, /exigirEmpresaId\(req, res\)/);
  }
  assert.match(source, /where\.empresa_id = empresaId/);
});

test('rotas alternativas de saídas também usam o escopo centralizado', () => {
  const source = readFileSync(new URL('../src/controllers/SaidaController.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /req\.user\?\.empresa_id \|\| req\.user\?\.empresa_id_override/);
  assert.match(source, /empresaParaGravar\(req\.user\)/);
  assert.match(source, /const where = \{ empresa_id \}/);
});
