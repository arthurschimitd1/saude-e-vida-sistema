const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../app/(main)/uikit/estoque-roupas');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
const ctx = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'etiquetasImpressao.ts'), 'utf8')), ctx);
const { montarDocumentoEtiquetas, normalizarAjustesEtiquetas, AJUSTES_ETIQUETAS_PADRAO } = ctx.exports;
const barcodes = { exports: {}, require };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'codigoBarrasRoupa.ts'), 'utf8')), barcodes);
const codigos = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'codigoEtiquetaRoupa.ts'), 'utf8')), codigos);
const source = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = {};
function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer) declarations[n.name.getText(ast)] = n.initializer.getText(ast);
    ts.forEachChild(n, visit);
}
visit(ast);
test('cada página contém até 3 etiquetas com 25 mm de altura, sem linhas extras', () => {
    for (const n of [1, 2, 3, 4, 6, 7, 1000]) {
        const cells = Array.from({ length: n }, (_, i) => `<div class="etiqueta">${i}</div>`);
        const html = montarDocumentoEtiquetas(cells, AJUSTES_ETIQUETAS_PADRAO, 'Teste');
        const rows = [...html.matchAll(/<section class="linha">(.*?)<\/section>/g)];
        assert.equal(rows.length, Math.ceil(n / 3));
        assert.equal((html.match(/class="etiqueta"/g) || []).length, n);
        assert.ok(rows.every(r => (r[1].match(/class="etiqueta"/g) || []).length <= 3));
        assert.match(html, /@page\{size:100mm 25mm;margin:0\}/);
        assert.match(html, /\.linha:not\(:last-child\)/);
    }
    assert.equal(montarDocumentoEtiquetas([], AJUSTES_ETIQUETAS_PADRAO, ''), '');
});
test('espaços afastam os conteúdos laterais sem ampliar a página ou compactar as barras', () => {
    const html = montarDocumentoEtiquetas(['<div class="etiqueta"></div>'], { horizontalMm: -0.5, verticalMm: 2, intervaloMm: 2 }, '<script>');
    assert.match(html, /@page\{size:100mm 25mm/);
    assert.match(html, /grid-template-columns:repeat\(3,33mm\)/);
    assert.match(html, /justify-content:center/);
    assert.match(html, /translate\(-0.5mm,2mm\)/);
    assert.match(html, /translate\(-2mm,2mm\)/);
    assert.match(html, /translate\(1mm,2mm\)/);
    assert.match(html, /width:31mm;min-width:31mm;max-width:31mm/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
});
test('configurações inválidas não geram NaN, Infinity ou estilos injetados', () => {
    for (const input of [null, {}, 'broken', { horizontalMm: 'red;}', verticalMm: Infinity, intervaloMm: NaN }]) {
        assert.deepEqual(JSON.parse(JSON.stringify(normalizarAjustesEtiquetas(input))), { horizontalMm: 0, verticalMm: 5, intervaloMm: 0 });
    }
    assert.deepEqual(JSON.parse(JSON.stringify(normalizarAjustesEtiquetas({ horizontalMm: -999, verticalMm: 999, intervaloMm: 999 }))), { horizontalMm: -3, verticalMm: 6, intervaloMm: 1.5 });
});
test('padrão vertical de 5 mm não sobrescreve ajustes já salvos, inclusive zero', () => {
    assert.equal(AJUSTES_ETIQUETAS_PADRAO.verticalMm, 5);
    assert.equal(normalizarAjustesEtiquetas({ verticalMm: 0 }).verticalMm, 0);
    assert.equal(normalizarAjustesEtiquetas({ verticalMm: null }).verticalMm, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(normalizarAjustesEtiquetas({ horizontalMm: -1, verticalMm: 6, intervaloMm: 0.5 }))), { horizontalMm: -1, verticalMm: 6, intervaloMm: 0.5 });
    assert.match(montarDocumentoEtiquetas(['<div class="etiqueta"></div>'], AJUSTES_ETIQUETAS_PADRAO, 'Teste'), /translate\(0mm,5mm\)/);
});
function printHarness(extra = {}) {
    const printed = [];
    const context = vm.createContext({
        abrirImpressaoEtiquetas: (cells, title) => { printed.push({ cells, title }); return true; },
        gerarSvgBarrasRoupa: barcodes.exports.gerarSvgBarrasRoupa,
        criarCodigoEtiquetaRoupa: codigos.exports.criarCodigoEtiquetaRoupa,
        show: (...args) => { throw new Error(args.join(' ')); },
        ...extra,
    });
    for (const name of ['escaparHtmlRoupa']) {
        context[name] = vm.runInContext(compile(`(${declarations[name]})`), context);
    }
    return { context, printed, fn: name => vm.runInContext(compile(`(${declarations[name]})`), context) };
}
test('teste sempre gera uma única linha identificada e não lê nem grava produtos', () => {
    const h = printHarness();
    h.fn('testarAlinhamentoEtiquetas')();
    assert.equal(h.printed.length, 1);
    assert.equal(h.printed[0].cells.length, 3);
    ['ESQUERDA', 'CENTRO', 'DIREITA'].forEach((label, i) => assert.ok(h.printed[0].cells[i].includes(label)));
    assert.ok(h.printed[0].cells.every(c => c.includes('<svg') && c.includes('class="conteudo"')));
});
test('impressão real mantém código/variação, quantidades e escape; não inclui empresa/preço', () => {
    const h = printHarness();
    h.fn('imprimirEtiquetas')([{ roupa: { id: 8, nome: 'Peça & Teste', codigo: '7896800003597', preco_venda: 189.99 }, variacao: { id: 9, tamanho: 'P', cor: '<azul>' }, quantidade: 2 }]);
    assert.equal(h.printed[0].cells.length, 2);
    const cell = h.printed[0].cells[0];
    assert.match(cell, /Peça &amp; Teste/);
    assert.match(cell, /P \/ &lt;azul&gt;/);
    const codigo = codigos.exports.criarCodigoEtiquetaRoupa(8, 9, { codigo: '7896800003597', tamanho: 'P', cor: '<azul>' });
    assert.ok(cell.includes(codigo));
    assert.doesNotMatch(cell, /189|R\$|Tito Imports/);
});
test('lote do mesmo produto mantém exatamente o mesmo código em todas as fileiras', () => {
    const h = printHarness();
    h.fn('imprimirEtiquetas')([{ roupa: { id: 8, nome: 'Peça', codigo: '7896800003597' }, variacao: { id: 9, tamanho: 'P', cor: 'Preta' }, quantidade: 9 }]);
    assert.equal(h.printed[0].cells.length, 9);
    assert.equal(new Set(h.printed[0].cells.map(cell => cell.replace(/\s+/g, ' ').trim())).size, 1);
    const codigo = codigos.exports.criarCodigoEtiquetaRoupa(8, 9, { codigo: '7896800003597', tamanho: 'P', cor: 'Preta' });
    assert.ok(h.printed[0].cells.every(cell => cell.includes(codigo)));
});
test('pop-up bloqueado mantém seleção em lote aberta', () => {
    const messages = [];
    const h = printHarness({ etiquetaLoteItens: [{ selecionada: true, quantidade: 2 }], imprimirEtiquetas: () => false,
        setEtiquetaLoteDialog: () => assert.fail('Não deve fechar'), show: (...args) => messages.push(args) });
    h.fn('imprimirLote')();
    assert.equal(messages.length, 0);
});
test('EAN-13 só é usado com verificador válido; números inválidos são preservados em Code 128', () => {
    assert.equal(barcodes.exports.codificarBarrasRoupa('7896800003593').formato, 'EAN13');
    assert.equal(barcodes.exports.codificarBarrasRoupa('7896800003597').formato, 'CODE128');
    assert.equal(barcodes.exports.codificarBarrasRoupa('0001234567895').formato, 'EAN13');
});
test('código numérico longo ganha barras mais largas sem reduzir as margens brancas', () => {
    const novo=barcodes.exports.codificarBarrasRoupa('7896800003597');
    assert.equal(novo.modulos,143);
    assert.equal(novo.margemEsquerda,10);
    assert.equal(novo.margemDireita,10);
    const antigo=20 + 15*11 + 13;
    assert.ok(30/novo.modulos > (30/antigo)*1.3);
    assert.match(barcodes.exports.gerarSvgBarrasRoupa('001'),/width="30mm" height="6.8mm"/);
    assert.match(barcodes.exports.gerarSvgBarrasRoupa('001'),/shape-rendering="crispEdges"/);
});
test('código cadastrado inválido é convertido em identificador numérico estável e legível', () => {
    for (const code of ['', 'CÓDIGO', 'ABC\n123', 'ABCDEFGHIJKLMNOPQRSTUV']) assert.throws(()=>barcodes.exports.gerarSvgBarrasRoupa(code));
    const h=printHarness();
    const result=h.fn('imprimirEtiquetas')([{roupa:{nome:'Teste',codigo:'CÓDIGO'},variacao:{tamanho:'P'},quantidade:1}]);
    const codigo = codigos.exports.criarCodigoEtiquetaRoupa(undefined, undefined, { codigo: 'CÓDIGO', tamanho: 'P', cor: undefined });
    assert.equal(result,true);assert.equal(h.printed.length,1);assert.ok(h.printed[0].cells[0].includes(codigo));
});
