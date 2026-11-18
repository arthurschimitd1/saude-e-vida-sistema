const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../app/(main)/uikit/estoque-roupas/page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = {};
function visit(node) {
    if (ts.isVariableDeclaration(node) && ['salvar', 'abrirEditar'].includes(node.name.getText(ast))) functions[node.name.getText(ast)] = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
}
visit(ast);
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const variacao = (changes = {}) => ({ id: 3, tamanho: 'Único', cor: null, quantidade_atual: 5, quantidade_minima: 1, fotos: [], ...changes });
const formBase = changes => ({ id: 9, nome: 'Relógio', tipo: 'acessorio', codigo: '001', preco_venda: 25, preco_compra: 10, variacoes: [variacao()], ...changes });
function harness(form, failure) {
    const calls = [], messages = [], saving = [], dialogs = [];
    const ctx = vm.createContext({ form, editingId: 9, salvando: false, FormData,
        show: (...args) => messages.push(args), setSalvando: value => saving.push(value),
        setFormDialog: value => dialogs.push(value), fetchRoupas: () => calls.push('refresh'),
        api: { put: async (...args) => { if (failure) throw failure; calls.push(args); }, post: async () => assert.fail('edição não pode criar outra peça') },
    });
    return { calls, messages, saving, dialogs, run: () => vm.runInContext(compile(`(${functions.salvar})()`), ctx) };
}

test('foto nova em peça sem cor é enviada junto das fotos antigas sem mudar IDs ou estoque', async () => {
    const file = new File(['foto-teste'], 'foto.png', { type: 'image/png' });
    const oldPhoto = { id: 7, foto_url: 'https://fotos.test/antiga.png', public_id: 'roupa/antiga', ordem: 0 };
    const form = formBase({ variacoes: [variacao({ fotos: [oldPhoto, { file, preview: 'blob:teste' }] })] });
    const h = harness(form);
    await h.run();
    assert.equal(h.calls[0][0], '/estoque-roupas/9');
    const data = h.calls[0][1];
    assert.deepEqual(JSON.parse(data.get('variacoes')), [{ id: 3, tamanho: 'Único', cor: null, quantidade_atual: 5, quantidade_minima: 1 }]);
    assert.deepEqual(JSON.parse(data.get('fotos_existentes_0')), [{ foto_url: oldPhoto.foto_url, public_id: oldPhoto.public_id, ordem: 0 }]);
    assert.equal(await data.get('fotos_variacao_0').text(), 'foto-teste');
    assert.equal(data.get('codigo'), '001');
    assert.equal(form.variacoes[0].fotos[1].file, file);
    assert.deepEqual(h.saving, [true, false]);
    assert.deepEqual(h.dialogs, [false]);
    assert.deepEqual(h.messages, [['success', 'Peça atualizada!']]);
});

test('abrir edição normaliza cor nula preservando fotos e identificadores', () => {
    let result;
    const original = formBase({ variacoes: [variacao({ fotos: [{ foto_url: '/foto.png' }] })] });
    const ctx = vm.createContext({ setForm: value => result = value, setEditingId: () => {}, setFotoPainelAberto: () => {}, setFormDialog: () => {}, original });
    vm.runInContext(compile(`(${functions.abrirEditar})(original)`), ctx);
    assert.equal(result.variacoes[0].cor, '');
    assert.equal(result.variacoes[0].id, 3);
    assert.equal(result.variacoes[0].fotos, original.variacoes[0].fotos);
    assert.equal(original.variacoes[0].cor, null);
});

test('edição mantém visíveis tamanhos personalizados vindos da Nuvemshop', () => {
    assert.match(source, /options=\{opcoesTamanho\(v\.tamanho\)\}/);
    assert.match(source, /placeholder="Tamanho" editable/);
});

for (const tamanho of [null, undefined, '', '   ']) test(`tamanho inválido (${String(tamanho)}) mostra validação sem travar`, async () => {
    const h = harness(formBase({ variacoes: [variacao({ tamanho })] }));
    await h.run();
    assert.equal(h.calls.length, 0);
    assert.match(h.messages[0][1], /precisam de tamanho/);
});

test('cor nula e cor vazia no mesmo tamanho continuam sendo variações duplicadas', async () => {
    const h = harness(formBase({ variacoes: [variacao(), variacao({ id: 4, cor: '', tamanho: ' único ' })] }));
    await h.run();
    assert.equal(h.calls.length, 0);
    assert.match(h.messages[0][1], /Não repita/);
});

test('nome nulo mostra validação em vez de erro de trim', async () => {
    const h = harness(formBase({ nome: null }));
    await h.run();
    assert.match(h.messages[0][1], /Nome e tipo/);
});

test('falha de upload exibe a mensagem da API e mantém o formulário aberto', async () => {
    const h = harness(formBase(), { message: 'Arquivo acima do limite' });
    await h.run();
    assert.deepEqual(h.messages, [['error', 'Arquivo acima do limite']]);
    assert.deepEqual(h.dialogs, []);
    assert.deepEqual(h.saving, [true, false]);
});
