const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../app/(main)/uikit/input');
const compile = source => ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function load(file, deps = require) {
    const context = { exports: {}, require: deps };
    vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8')), context);
    return context.exports;
}
const { obterFotoRoupaCaixa } = load('fotoRoupaCaixa.ts');
const Miniatura = load('MiniaturaRoupaCaixa.tsx').default;
const foto = (url, ordem = 0) => ({ foto_url: url, ordem });
const source = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let carregar;
function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'fetchRoupasCaixa') carregar = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
}
visit(ast);

test('foto principal e fotos das variações pertencem ao produto, mesmo com nomes iguais', () => {
    const a = { nome: 'Camisa', foto_url: 'https://fotos.test/a.jpg' };
    const b = { nome: 'Camisa', variacoes: [{ id: 2, fotos: [foto('https://fotos.test/b.jpg')] }] };
    assert.equal(obterFotoRoupaCaixa(a), a.foto_url);
    assert.equal(obterFotoRoupaCaixa(b), 'https://fotos.test/b.jpg');
    assert.equal(obterFotoRoupaCaixa({ nome: 'Camisa' }), null);
});

test('foto é escolhida em ordem estável sem reordenar as variações/fotos originais', () => {
    const roupa = { variacoes: [{ id: 2, fotos: [foto('/outra.jpg')] },
        { id: 1, fotos: [foto('/segunda.jpg', 1), foto('/primeira.jpg', 0)] }] };
    const before = JSON.stringify(roupa);
    assert.equal(obterFotoRoupaCaixa(roupa), '/primeira.jpg');
    assert.equal(JSON.stringify(roupa), before);
});

test('cadastros sem imagens ou URLs inválidas continuam selecionáveis', () => {
    assert.equal(obterFotoRoupaCaixa({ foto_url: ' ', variacoes: [] }), null);
    assert.equal(obterFotoRoupaCaixa({ foto_url: 'javascript:alert(1)' }), null);
    assert.equal(obterFotoRoupaCaixa({ variacoes: [{ fotos: [foto(''), foto('/valida.jpg')] }] }), '/valida.jpg');
});

test('carregamento real do caixa conserva foto, ID, preço, cor, tamanho e saldo', async () => {
    let resultado;
    const context = { obterFotoRoupaCaixa, api: { get: async url => {
        assert.equal(url, '/estoque-roupas');
        return { data: [{ id: '9', nome: 'Camisa', preco_venda: '45.90', codigo: '001',
            variacoes: [{ id: '4', tamanho: 'M', cor: 'azul', quantidade_atual: '3', fotos: [foto('/camisa-9.jpg')] }] },
        { id: 10, nome: 'Camisa', preco_venda: 20, variacoes: [{ id: 5, tamanho: 'P', quantidade_atual: 2 }] }] };
    } }, setCarregandoRoupasCaixa: () => {}, setRoupasDisponiveis: value => { resultado = value; } };
    await vm.runInNewContext(compile(`(${carregar})()`), context);
    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].foto_url, '/camisa-9.jpg');
    assert.equal(resultado[0].id, 9);
    assert.equal(resultado[0].preco_venda, 45.9);
    assert.equal(resultado[0].variacoes[0].cor, 'azul');
    assert.equal(resultado[0].variacoes[0].tamanho, 'M');
    assert.equal(resultado[0].variacoes[0].quantidade_atual, 3);
    assert.equal(resultado[1].foto_url, null);
});

test('miniatura usa a foto do cadastro e reserva 40px sem distorcer a imagem', () => {
    const html = renderToStaticMarkup(React.createElement(Miniatura, { nome: 'Camisa', fotoUrl: '/camisa.jpg' }));
    assert.match(html, /src="\/camisa.jpg"/);
    assert.match(html, /width="40" height="40"/);
    assert.match(html, /object-fit:contain/);
    assert.match(html, /loading="lazy"/);
    const semFoto = renderToStaticMarkup(React.createElement(Miniatura, { nome: 'Camisa' }));
    assert.match(semFoto, /sem foto disponível/);
    assert.doesNotMatch(semFoto, /<img /);
});

test('imagem com falha vira ícone e selecionar outra peça mostra a foto dela', () => {
    let failed = null;
    const Component = load('MiniaturaRoupaCaixa.tsx', name => name === 'react'
        ? { useState: () => [failed, value => { failed = value; }] } : require(name)).default;
    let tree = Component({ nome: 'A', fotoUrl: '/falhou.jpg' });
    tree.props.children.props.onError();
    tree = Component({ nome: 'A', fotoUrl: '/falhou.jpg' });
    assert.equal(tree.props.children.type, 'i');
    tree = Component({ nome: 'B', fotoUrl: '/outra.jpg' });
    assert.equal(tree.props.children.type, 'img');
    assert.equal(tree.props.children.props.src, '/outra.jpg');
});

test('miniatura está nos modelos da lista e do valor selecionado sem alterar chave ou seleção', () => {
    const begin = source.indexOf('options={roupasDisponiveis}');
    const dropdown = source.slice(begin, source.indexOf('\n                            />', begin));
    assert.match(dropdown, /itemTemplate=/);
    assert.match(dropdown, /valueTemplate=/);
    assert.equal((dropdown.match(/<MiniaturaRoupaCaixa/g) || []).length, 2);
    assert.match(dropdown, /dataKey="id"/);
    assert.match(dropdown, /setRoupaVariacaoDialog\(Boolean\(e.value\)\)/);
});
