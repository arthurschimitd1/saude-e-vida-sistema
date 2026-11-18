const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '../app/(main)/uikit/input');
const compile = source => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const helper = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'saidasCaixa.ts'), 'utf8')), helper);
const { normalizarSaidasServidor } = helper.exports;
const source = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');

test('normaliza somente saídas retornadas pelo servidor da empresa', () => {
    const rows = normalizarSaidasServidor([
        { id: 7, natureza: 'SAIDA', tipo: 'Água', valor: '10.50', data: '2026-09-14T12:00:00Z' },
        { id: 8, natureza: 'ENTRADA', tipo: 'Aporte', valor: 20 },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 7);
    assert.equal(rows[0].valor, 10.5);
    assert.equal(rows[0]._uid, 'saida-7');
});

test('histórico consulta vendas e saídas no servidor com a empresa selecionada', () => {
    assert.match(source, /api\.get\('\/vendas', \{ params \}\)/);
    assert.match(source, /api\.get\('\/financeiro\/saidas', \{ params: \{ \.\.\.params, natureza: 'SAIDA' \} \}\)/);
    assert.match(source, /const params = \{ empresa_id: id \}/);
});

test('saídas não são mais gravadas em armazenamento local compartilhado', () => {
    assert.doesNotMatch(source, /localStorage\.(setItem|removeItem)\(['"]lucromais_caixa_saidas/);
    assert.match(source, /api\.post\('\/financeiro\/saidas'/);
    assert.match(source, /api\.put\(`\/financeiro\/saidas\/\$\{editingSaidaId\}`/);
    assert.match(source, /api\.delete\(`\/financeiro\/saidas\/\$\{item.id\}`/);
});
