const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../app/(main)/uikit/input');
const source = fs.readFileSync(path.join(root, 'ResumoSaidasTurno.tsx'), 'utf8');
const ctx = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, ctx);
test('relatório mostra saídas por pagamento, líquido e detalhes sem HTML de usuário', () => {
    const html = renderToStaticMarkup(React.createElement(ctx.exports.default, {
        resumo: { qtdSaidas: 1, totalSaidas: 30, saidasDinheiro: 30, totalDinheiro: 80, liquidoDinheiro: 50, totalPix: 40, liquidoPix: 40, totalCartao: 20, liquidoCartao: 20 },
        saidas: [{ id: 1, tipo: '<script>fornecedor</script>', descricao: 'Compra de material', forma_pagamento: 'DINHEIRO', valor: 30, data: '2026-09-13T12:00:00Z' }],
    }));
    for (const text of ['Dinheiro', 'Pix', 'Cartão', 'Líquido', 'Compra de material', '50,00', '30,00']) assert.ok(html.includes(text), text);
    assert.doesNotMatch(html, /<script>/); assert.match(html, /saídas em dinheiro reduzem/);
});
test('turno sem saídas informa ausência; legado não é apresentado como dinheiro', () => {
    const html = renderToStaticMarkup(React.createElement(ctx.exports.default, { resumo: { saidasSemForma: 20 }, saidas: [] }));
    assert.match(html, /Nenhuma saída paga vinculada/); assert.match(html, /sem forma informada/);
    assert.match(html, /antigos sem vínculo com turno não são incluídos/);
});
test('formulário permite selecionar pagamento/turno e relatório explica saldo sem troco duplicado', () => {
    const page = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');
    assert.match(page, /inputId="saida-pagamento" options=\{formaPagamentoOptions\}/);
    assert.match(page, /inputId="saida-turno" options=\{turnosAbertos.map/);
    assert.match(page, /<ResumoSaidasTurno resumo=\{turnoMovimentos.resumo\}/);
    assert.match(page, /Abertura \+ vendas em dinheiro − saídas em dinheiro/);
    assert.doesNotMatch(page, /Abertura \+ Dinheiro − Troco/);
});
