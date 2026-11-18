const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../app/landing/diagnosisRules.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox);
const { recommendPlan } = sandbox.exports;

const base = { operation: 'one', priority: 'operations', implementation: 'standard' };

test('operação padrão com foco em estoque e financeiro indica plano 1', () => {
    assert.equal(recommendPlan(base).plan, 'plano1');
    assert.equal(recommendPlan(base).target, 'plano1');
});

test('necessidade de DP ou estratégia/CRM indica plano 2', () => {
    for (const priority of ['management', 'intelligence']) {
        assert.equal(recommendPlan({ ...base, priority }).plan, 'plano2');
    }
});

test('múltiplas unidades, integrações ou implantação sob medida indicam personalizado', () => {
    for (const answers of [
        { ...base, operation: 'complex' },
        { ...base, priority: 'integrations' },
        { ...base, implementation: 'tailored' },
    ]) {
        assert.equal(recommendPlan(answers).plan, 'personalizado');
        assert.equal(recommendPlan(answers).target, 'plano-personalizado');
    }
});

test('equipe por si só não muda plano sem necessidade de módulos avançados', () => {
    assert.equal(recommendPlan({ ...base, operation: 'team' }).plan, 'plano1');
});
