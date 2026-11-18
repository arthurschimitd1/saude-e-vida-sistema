const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../app/(main)/uikit/input/quantidadeRoupa.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports });
const { limitesQuantidadeRoupa } = moduleRef.exports;

test('variação sem estoque usa mínimo e máximo zero sem alternar entre 0 e 1', () => {
    assert.deepEqual(
        JSON.parse(JSON.stringify(limitesQuantidadeRoupa({ quantidade_atual: 0, estoque_infinito: false }))),
        { min: 0, max: 0, disabled: true },
    );
});

test('variação com saldo usa limites válidos para a quantidade', () => {
    assert.deepEqual(
        JSON.parse(JSON.stringify(limitesQuantidadeRoupa({ quantidade_atual: 9, estoque_infinito: false }))),
        { min: 1, max: 9, disabled: false },
    );
});

test('estoque infinito não define quantidade máxima', () => {
    const limites = limitesQuantidadeRoupa({ quantidade_atual: 0, estoque_infinito: true });
    assert.equal(limites.min, 1);
    assert.equal(limites.max, undefined);
    assert.equal(limites.disabled, false);
});
