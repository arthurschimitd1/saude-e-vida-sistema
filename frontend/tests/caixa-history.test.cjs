const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../app/(main)/uikit/input');
const source = fs.readFileSync(path.join(root, 'page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = {};
function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer) declarations[n.name.getText(ast)] = n.initializer.getText(ast);
    ts.forEachChild(n, visit);
}
visit(ast);
const compile = text => ts.transpileModule(text, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper = {exports:{}};
vm.runInNewContext(compile(fs.readFileSync(path.join(root,'historicoCaixa.ts'),'utf8')),helper);
const {prepararHistorico, normalizarSaidasServidor} = helper.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const date = '2026-09-11T12:00:00.000Z';
test('ordem independe da ordem recebida, inclusive empate de datas e IDs entre venda e saída', () => {
    const rows = [
        {_kind:'venda',id:1,criadoEm:date,dataVenda:date,valorTotal:30},
        {_kind:'saida',id:2,criadoEm:date,data:date,valor:20},
        {_kind:'venda',id:2,criadoEm:date,dataVenda:date,valorTotal:40},
        {_kind:'venda',id:3,criadoEm:'2026-09-11T12:01:00Z',dataVenda:date,valorTotal:50},
    ];
    const expected=plain(prepararHistorico(rows).map(r=>r._uid));
    assert.deepEqual(expected,['venda-3','saida-2','venda-2','venda-1']);
    for (const order of [rows.slice().reverse(),[rows[2],rows[0],rows[3],rows[1]]])
        assert.deepEqual(plain(prepararHistorico(order).map(r=>r._uid)),expected);
});
test('ordenação usa a data exibida, campos reais e valor correto de cada tipo', () => {
    const rows=prepararHistorico([
        {_kind:'saida',id:1,criadoEm:'2026-09-12T12:00:00Z',data:date,tipo:'Aluguel',valor:50},
        {_kind:'venda',id:2,criadoEm:date,dataVenda:'2026-09-12T12:00:00Z',cliente:{nomeCompleto:'Ana'},funcionario:{nome:'João'},valorTotal:10},
    ]);
    assert.equal(rows[0]._uid,'venda-2');assert.equal(rows[0].clienteNome,'Ana');assert.equal(rows[0].funcionarioNome,'João');
    assert.equal(rows[1].clienteNome,'Aluguel');assert.equal(rows[1].valorOrdem,50);
});
test('saídas são normalizadas sem incluir entradas ou duplicar IDs de vendas', () => {
    const rows=normalizarSaidasServidor([{id:8,natureza:'SAIDA',tipo:'Conta',data:date,createdAt:date,valor:'12.35'},{id:9,natureza:'ENTRADA',valor:'99'}]);
    assert.equal(rows.length,1);assert.equal(rows[0].valor,12.35);assert.equal(rows[0].data.toISOString(),date);
});
test('cada nova venda e saída recebe data atual e coleções independentes', () => {
    let time=1000;const ctx=vm.createContext({Date:class extends Date{constructor(...args){super(...(args.length?args:[time]));}}});
    const factory=vm.runInContext(compile(`(${declarations.initialVenda})`),ctx);
    const first=factory();time=2000;const second=factory();
    assert.equal(first.dataVenda.getTime(),1000);assert.equal(second.dataVenda.getTime(),2000);
    assert.notEqual(first.produtos,second.produtos);assert.notEqual(first.pagamentos,second.pagamentos);
    const out=vm.runInContext(compile(`(${declarations.initialSaida})`),ctx);time=3000;assert.equal(out().data.getTime(),3000);
});
function harness(overrides={}) {
    const state={history:[],error:'',success:[],loading:false,closed:false};
    const ctx=vm.createContext({
        empresaId:12,saida:{tipo:'Conta',descricao:'Teste',data:new Date(date),valor:10,forma_pagamento:'DINHEIRO',turno_id:7},editingSaidaId:null,
        turnosAbertos:[{id:7}],turnoDetalhe:null,
        salvandoSaidaRef:{current:false},historicoRequestRef:{current:0},SAIDAS_KEY:'lucromais_caixa_saidas',
        localStorage:{getItem:()=>JSON.stringify([{id:999,tipo:'Legado sem empresa'}])},
        prepararHistorico,normalizarSaidasServidor,normalizarPagamentosVenda:()=>[],
        setTemSaidasLegadas:()=>{},setHistorico:x=>state.history=x,setHistoricoErro:x=>state.error=x,
        setLoadingHistorico:x=>state.loading=x,setSalvandoSaida:()=>{},setSaida:()=>{},setEditingSaidaId:()=>{},
        setSaidaDialog:x=>state.closed=!x,initialSaida:()=>({}),showError:x=>state.error=x,showSuccess:x=>state.success.push(x),
        api:{get:async()=>({data:[]}),post:async()=>({data:{id:1}}),put:async()=>({data:{id:1}})},...overrides,
    });
    ctx.fetchHistorico=vm.runInContext(compile(`(${declarations.fetchHistorico})`),ctx);
    const submit=vm.runInContext(compile(`(${declarations.handleSaidaSubmit})`),ctx);
    return {ctx,state,submit};
}
test('consulta ambas as APIs com a mesma empresa e não mistura o armazenamento legado', async () => {
    const calls=[];const h=harness({api:{get:async(url,config)=>{calls.push({url,config});return {data:[]};}}});
    await h.ctx.fetchHistorico();assert.equal(calls.length,2);
    assert.ok(calls.every(c=>c.config.params.empresa_id===12));assert.equal(calls[1].config.params.natureza,'SAIDA');
    assert.equal(h.state.history.length,0);assert.equal(h.state.error,'');
});
test('resposta antiga não substitui histórico de outra empresa', async () => {
    const pending=[];const h=harness({api:{get:(url,config)=>new Promise(resolve=>pending.push({url,config,resolve}))}});
    const a=h.ctx.fetchHistorico(12);const b=h.ctx.fetchHistorico(15);
    pending[2].resolve({data:[{id:15,data:date,createdAt:date,itens:[]}]});pending[3].resolve({data:[]});await b;
    pending[0].resolve({data:[{id:12,data:date,itens:[]}]});pending[1].resolve({data:[]});await a;
    assert.equal(h.state.history.length,1);assert.equal(h.state.history[0].id,15);
});
test('falha de rede não exibe cache de outra sessão como se fosse histórico atual', async () => {
    const h=harness({api:{get:async()=>{throw Error('offline');}}});await h.ctx.fetchHistorico();
    assert.match(h.state.error,/Não foi possível/);assert.equal(h.state.history.length,0);assert.equal(h.state.loading,false);
});
test('salvamento recusado não confirma sucesso nem fecha o formulário', async () => {
    const h=harness({api:{post:async()=>{throw Error('offline');}}});await h.submit();
    assert.equal(h.state.success.length,0);assert.equal(h.state.closed,false);assert.equal(h.state.error,'offline');assert.equal(h.ctx.salvandoSaidaRef.current,false);
});
test('duplo clique só envia uma saída; sucesso é confirmado após o servidor', async () => {
    let resolve,count=0;const h=harness({api:{post:()=>{count++;return new Promise(r=>resolve=r);},get:async()=>({data:[]})}});
    const first=h.submit();await h.submit();assert.equal(count,1);assert.equal(h.state.success.length,0);
    resolve({data:{id:1}});await first;assert.equal(h.state.success.length,1);assert.equal(h.state.closed,true);
});
test('edição usa o ID do servidor e não cria outra saída', async () => {
    const calls=[];const h=harness({editingSaidaId:44,api:{put:async(...args)=>calls.push(args),post:()=>assert.fail('Não deve criar'),get:async()=>({data:[]})}});
    await h.submit();assert.equal(calls[0][0],'/financeiro/saidas/44');assert.equal(h.state.success[0],'Saída atualizada!');
});
test('nova saída envia forma e turno escolhidos e atualiza relatório aberto', async () => {
    const requests=[],refresh=[];
    const h=harness({turnoDetalhe:{id:7},verMovimentosTurno:async t=>refresh.push(t.id),api:{post:async(...args)=>requests.push(args),get:async()=>({data:[]})}});
    await h.submit();
    assert.equal(requests[0][1].forma_pagamento,'DINHEIRO');assert.equal(requests[0][1].turno_id,7);
    assert.equal(requests[0][1].natureza,'SAIDA');assert.deepEqual(refresh,[7]);
});
test('nova saída exige pagamento e turno aberto, sem escolher outro turno silenciosamente', async () => {
    for(const overrides of [{turnosAbertos:[]},{turnosAbertos:[{id:9}]},{saida:{tipo:'Conta',data:new Date(date),valor:10,forma_pagamento:null,turno_id:7}}]){
        const h=harness({...overrides,api:{post:()=>assert.fail('Não deve enviar')}});await h.submit();
        assert.match(h.state.error,/forma de pagamento|turno aberto/);assert.equal(h.state.closed,false);
    }
});
test('abertura preenche apenas um turno único; vários turnos exigem escolha', () => {
    for(const ids of [[],[7],[7,8]]){
        let result;
        const ctx=vm.createContext({turnosAbertos:ids.map(id=>({id})),initialSaida:()=>({forma_pagamento:null}),setSaida:s=>result=s,setEditingSaidaId:()=>{},setSaidaDialog:()=>{}});
        vm.runInContext(compile(`(${declarations.abrirNovaSaida})()`),ctx);
        assert.equal(result.turno_id,ids.length===1?7:null);assert.equal(result.forma_pagamento,null);
    }
});
test('edição não transfere saída antiga para o turno atual nem inventa forma', async () => {
    const normalized=normalizarSaidasServidor([{id:1,tipo:'Conta',valor:10,data:date}])[0];
    assert.equal(normalized.turno_id,null);assert.equal(normalized.forma_pagamento,null);
    const calls=[];const h=harness({editingSaidaId:1,saida:normalized,api:{put:async(...args)=>calls.push(args),get:async()=>({data:[]})}});
    await h.submit();assert.equal(calls[0][1].turno_id,null);assert.equal(calls[0][1].forma_pagamento,null);
    const linked=normalizarSaidasServidor([{id:2,forma_pagamento:'PIX',turno_id:'42'}])[0];
    assert.equal(linked.turno_id,42);assert.equal(linked.forma_pagamento,'PIX');
});
test('excluir saída atualiza histórico e relatório sem alterar estoque', async () => {
    let confirmation;const calls=[];
    const ctx=vm.createContext({confirmDialog:opts=>confirmation=opts,api:{delete:async p=>calls.push(p)},empresaId:12,fetchHistorico:async()=>calls.push('historico'),fetchRoupasCaixa:()=>assert.fail('Saída não é estoque'),turnoDetalhe:{id:7},verMovimentosTurno:async t=>calls.push('turno-'+t.id),showSuccess:()=>{},showError:msg=>assert.fail(msg)});
    const excluir=vm.runInContext(compile(`(${declarations.excluir})`),ctx);
    excluir({_kind:'saida',id:12});await confirmation.accept();
    assert.deepEqual(calls,['/financeiro/saidas/12','historico','turno-7']);
});
test('sem empresa o histórico é esvaziado e nenhuma saída é enviada', async () => {
    const h=harness({empresaId:null,api:{get:()=>assert.fail('Sem consulta global'),post:()=>assert.fail('Sem gravação global')}});
    await h.ctx.fetchHistorico();await h.submit();assert.equal(h.state.history.length,0);assert.match(h.state.error,/Selecione a empresa/);
});
test('código não apaga nem sobrescreve o legado e exclusão usa o servidor', () => {
    assert.doesNotMatch(source,/localStorage\.(setItem|removeItem)\(SAIDAS_KEY/);
    assert.match(declarations.excluir,/api\.delete\(`\/financeiro\/saidas\/\$\{item.id\}`\)/);
});
