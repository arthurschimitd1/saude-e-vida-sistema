const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../app/(main)/uikit/input');
const compile = text => ts.transpileModule(text, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper = {exports:{}};
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'funcionarioCaixa.ts'), 'utf8')),helper);
const {encontrarFuncionarioLogado, normalizarFuncionariosCaixa, precisaAutenticarFuncionario} = helper.exports;
const staff=[{id:1,nome:'Andresa',email:'andresa@teste.local'},{id:2,nome:'João',email:'joao@teste.local'}];
const source=fs.readFileSync(path.join(root,'page.tsx'),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations={};let autoSelect;
function visit(n) {
    if(ts.isVariableDeclaration(n)&&n.initializer) declarations[n.name.getText(ast)]=n.initializer.getText(ast);
    if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const funcionarioLogado = encontrarFuncionarioLogado')) autoSelect=n.arguments[0].getText(ast);
    ts.forEachChild(n,visit);
}
visit(ast);

test('usa a conta logada, não a primeira pessoa da lista nem a abertura de caixa',()=>{
    assert.equal(encontrarFuncionarioLogado(staff,{id:2}),staff[1]);
    assert.equal(encontrarFuncionarioLogado(staff,{id:'2'}),staff[1]);
    assert.doesNotMatch(source,/funcionarios\.find\(f => f\.id === turno\.func_abertura_id\)/);
    assert.doesNotMatch(declarations.confirmarAberturaCaixa,/setVenda/);
});
test('conta ausente da lista não seleciona outra pessoa por nome ou e-mail conflitante',()=>{
    assert.equal(encontrarFuncionarioLogado(staff,{id:99,email:staff[0].email}),null);
    assert.equal(encontrarFuncionarioLogado(staff,null),null);
    assert.equal(encontrarFuncionarioLogado([], {id:2}),null);
});
test('e-mail normalizado funciona como alternativa apenas em sessão legada sem ID',()=>{
    assert.equal(encontrarFuncionarioLogado(staff,{email:' JOAO@TESTE.LOCAL '}),staff[1]);
});
test('normalização mantém ID numérico e comissão atual sem sobrescrita pelo histórico',()=>{
    const result=normalizarFuncionariosCaixa([
        [{id:'2',nomeCompleto:'João',email:'joao@teste.local',comissao_tipo:'percent',comissao_valor:'42'}],
        [{id:2,nomeCompleto:'Nome administrativo antigo',comissao_valor:40}],
        [{id:2,nomeCompleto:'Nome histórico'},{id:3,nomeCompleto:'Funcionário legado'},{id:99,tipo:'MASTER'}],
    ]);
    const joao=result.find(f=>f.id===2);
    assert.equal(joao.nome,'João');assert.equal(joao.comissao_valor,42);assert.equal(joao.comissao_tipo,'percent');
    assert.equal(result.length,2);assert.ok(result.some(f=>f.id===3));
});
function runAuto(overrides={}) {
    let sale={funcionario:null,produtos:[{id:7}],...overrides.sale};
    const ctx=vm.createContext({funcionarios:staff,usuarioLogado:{id:2},funcionariosCarregados:true,editingVendaId:null,
        encontrarFuncionarioLogado,setVenda:update=>sale=update(sale),...overrides});
    vm.runInContext(compile(`(${autoSelect})()`),ctx);
    return sale;
}
test('preenche automaticamente mesmo com exigência de senha, sem alterar itens',()=>{
    const sale=runAuto({podePularSenha:false});assert.equal(sale.funcionario.id,2);assert.equal(sale.produtos[0].id,7);
});
test('carregamento incompleto aguarda a lista em vez de escolher alguém do turno',()=>{
    assert.equal(runAuto({funcionariosCarregados:false}).funcionario,null);
});
test('seleção manual ou profissional vindo do agendamento é preservado',()=>{
    assert.equal(runAuto({sale:{funcionario:staff[0]}}).funcionario,staff[0]);
});
test('edição de venda preserva o vendedor original, inclusive quando está vazio',()=>{
    assert.equal(runAuto({editingVendaId:10,sale:{funcionario:staff[0]}}).funcionario,staff[0]);
    assert.equal(runAuto({editingVendaId:10}).funcionario,null);
});
test('nova venda volta para a conta logada e limpa autenticação da venda anterior',()=>{
    const values={};const setters={};
    for(const name of declarations.resetVenda.match(/\bset[A-Z]\w*/g)) setters[name]=v=>values[name]=v;
    const ctx=vm.createContext({...setters,funcionarios:staff,usuarioLogado:{id:2},encontrarFuncionarioLogado,
        initialVenda:()=>({produtos:[],dataVenda:new Date()}),originalProdutosRef:{current:[1]},venda:{funcionario:staff[0]}});
    vm.runInContext(compile(`(${declarations.resetVenda})()`),ctx);
    assert.equal(values.setVenda.funcionario.id,2);assert.equal(values.setFuncionarioAutenticadoId,null);
});
test('não dispensa senha configurada; autenticação de outro funcionário não vale',()=>{
    assert.equal(precisaAutenticarFuncionario(false,2,null),true);
    assert.equal(precisaAutenticarFuncionario(false,2,1),true);
    assert.equal(precisaAutenticarFuncionario(false,2,2),false);
    assert.equal(precisaAutenticarFuncionario(true,2,null),false);
    assert.match(declarations.confirmarSenhaFuncionario,/setFuncionarioAutenticadoId\(funcComComissao.id\)/);
});
test('finalizar venda autopreenchida pede senha quando configurado antes de prosseguir',()=>{
    let opened=false,confirmed=false;
    const ctx=vm.createContext({venda:{funcionario:staff[1]},podePularSenha:false,funcionarioAutenticadoId:null,
        precisaAutenticarFuncionario,setFuncionarioPendente:()=>{},setSenhaInput:()=>{},setSenhaDialog:v=>opened=v,
        setShowReciboDialog:()=>confirmed=true,showError:()=>assert.fail('Vendedor deveria estar preenchido')});
    vm.runInContext(compile(`(${declarations.handleVendaSubmit})()`),ctx);
    assert.equal(opened,true);assert.equal(confirmed,false);
});
