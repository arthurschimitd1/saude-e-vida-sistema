const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { ObjectUtils } = require('primereact/utils');

const source = fs.readFileSync(path.join(__dirname, '../app/(main)/uikit/input/page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dropdown, addService, visibilityCondition;
function visit(node) {
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
        && node.expression.right.getText(ast).includes('Adicionar serviço diretamente na comanda')) {
        visibilityCondition = node.expression.left.getText(ast);
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Dropdown'
        && node.attributes.properties.some(p => p.name?.getText(ast) === 'options' && p.initializer?.getText(ast) === '{servicosCaixa}')) dropdown = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'adicionarServicoDireto') addService = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(dropdown && addService, 'Extrair o seletor e a inclusão usados pela tela real');
assert.ok(visibilityCondition, 'Seção de serviços deve ter condição de visibilidade');
const primeSource = fs.readFileSync(require.resolve('primereact/dropdown'), 'utf8');
const primeAst = ts.createSourceFile('dropdown.js', primeSource, ts.ScriptTarget.Latest, true);
let getOptionValue;
function visitPrime(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(primeAst) === 'getOptionValue') getOptionValue = node.initializer.getText(primeAst);
    ts.forEachChild(node, visitPrime);
}
visitPrime(primeAst);
assert.ok(getOptionValue);
const services = [
    ...['Creditos (outro)', 'Creditos Claro', 'Creditos Tim', 'Creditos Vivo'].map((name, i) => ({key:`fiscal:${i+1}`, id:i+1, name, value:0, origem:'fiscal'})),
    {key:'fiscal:5', id:5, name:'Serviço pago', value:25, origem:'fiscal'},
    {key:'agenda:5', id:'5', name:'Serviço agenda', value:25, origem:'agenda'},
];
function sectionVisible(servicosCaixa, carregandoServicosCaixa = false) {
    return vm.runInNewContext(visibilityCondition, { servicosCaixa, carregandoServicosCaixa });
}
test('empresa sem serviços não mostra seletor nem botão de adicionar serviço', () => {
    assert.equal(sectionVisible([]), false);
});
test('empresa com serviço cadastrado mostra a seção, inclusive serviço de preço zero ou da agenda', () => {
    assert.equal(sectionVisible([services[0]]), true);
    assert.equal(sectionVisible([services[5]]), true);
});
test('enquanto carrega catálogo não exibe opções antigas de outra empresa', () => {
    assert.equal(sectionVisible([], true), false);
    assert.equal(sectionVisible(services, true), false);
});
function createHarness() {
    const ctx = vm.createContext({React, Dropdown:'dropdown', servicosCaixa:services, servicoCaixaSelecionado:null,
        carregandoServicosCaixa:false, fmtMoeda:String, venda:{produtos:[{id:99,nome:'Produto existente',valor:9,quantidade:2}]},
        utils:{ObjectUtils}, errors:[]});
    ctx.setServicoCaixaSelecionado = value => { ctx.servicoCaixaSelecionado = value; };
    ctx.setVenda = update => { ctx.venda = update(ctx.venda); };
    ctx.showError = message => ctx.errors.push(message);
    const run = text => vm.runInContext(ts.transpileModule(text, {compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText, ctx);
    return {
        ctx,
        props: () => run(`(${dropdown})`).props,
        select(option) { ctx.props = this.props(); const value = vm.runInContext(`(${getOptionValue})`,ctx)(option); ctx.props.onChange({value}); },
        add: () => run(`(${addService})`)(),
    };
}
test('quatro serviços com preço zero têm seleção distinta e entram na comanda', () => {
    for (const service of services.slice(0,4)) {
        const h=createHarness(); h.select(service);
        assert.equal(h.ctx.servicoCaixaSelecionado,service);
        assert.equal(h.props().value,service.key);
        h.add();
        const item=h.ctx.venda.produtos[1];
        assert.equal(item.nome,service.name); assert.equal(item.valor,0);
        assert.equal(item.catalogoServicoId,service.id); assert.equal(item.editablePrice,true);
        assert.equal(h.ctx.venda.produtos[0].id,99);
        assert.equal(h.ctx.servicoCaixaSelecionado,null);
    }
});
test('preços iguais e IDs iguais de catálogos diferentes não confundem seleção', () => {
    const h=createHarness(); h.select(services[4]); h.select(services[5]); h.add();
    const item=h.ctx.venda.produtos[1];
    assert.equal(item.nome,'Serviço agenda'); assert.equal(item.valor,25);
    assert.equal(item.servicoAgendaCatalogoId,'5'); assert.equal(item.catalogoServicoId,undefined);
});
test('limpar seleção não inclui nenhum serviço nem altera o produto existente', () => {
    const h=createHarness(); h.select(services[0]); h.props().onChange({value:null}); h.add();
    assert.equal(h.ctx.servicoCaixaSelecionado,null); assert.equal(h.ctx.venda.produtos.length,1);
    assert.equal(h.ctx.errors[0],'Selecione um serviço');
});
