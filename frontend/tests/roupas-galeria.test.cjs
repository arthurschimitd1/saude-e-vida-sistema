const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.join(__dirname, '../app/(main)/uikit/estoque-roupas');
const source = fs.readFileSync(path.join(root, 'GaleriaRoupa.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function load(requireModule = require) {
    const ctx = {exports:{},require:requireModule};
    vm.runInNewContext(compiled,ctx);
    return ctx.exports;
}
const {default:Galeria,fotosDaRoupa} = load();
const variacoes = [
    {id:1,tamanho:'P',cor:'azul',fotos:[{id:1,foto_url:'/azul-frente.jpg',ordem:0},{id:2,foto_url:'/azul-costas.jpg',ordem:1}]},
    {id:2,tamanho:'M',cor:'preta',fotos:[{id:3,foto_url:'/preta.jpg',ordem:0}]},
];
test('fotos maiores mostram peça inteira e identificam tamanho e cor',()=>{
    const html=renderToStaticMarkup(React.createElement(Galeria,{nome:'Camisa',variacoes}));
    assert.match(html,/height:240px/);
    assert.match(html,/object-fit:contain/);
    assert.match(html,/P \/ azul/);
    assert.match(html,/1 \/ 3/);
    assert.equal((html.match(/<button/g)||[]).length,2);
});
test('nenhuma foto ou foto única não apresenta setas',()=>{
    for(const vs of [[],[{tamanho:'Único',fotos:[]}],[{fotos:[{foto_url:'/unica.jpg'}]}]]){
        const html=renderToStaticMarkup(React.createElement(Galeria,{nome:'Relógio',variacoes:vs}));
        assert.doesNotMatch(html,/<button/);
    }
});
test('ordenação preserva cadastro e nunca inclui fotos de outra peça',()=>{
    const input=[{id:9,tamanho:'G',fotos:[{foto_url:'/b.jpg',ordem:2},{foto_url:'/a.jpg',ordem:1},{foto_url:' '}]}];
    const before=JSON.stringify(input);
    assert.equal(fotosDaRoupa(input).map(f=>f.foto_url).join(','),'/a.jpg,/b.jpg');
    assert.equal(JSON.stringify(input),before);
    assert.equal(fotosDaRoupa([{id:10,fotos:[{foto_url:'/outra.jpg'}]}])[0].foto_url,'/outra.jpg');
});
test('a mesma foto vinculada a tamanhos diferentes aparece uma única vez',()=>{
    const fotos=fotosDaRoupa([
        {id:1,tamanho:'P',fotos:[{foto_url:'/produto-frente.jpg'},{foto_url:'/produto-costas.jpg'}]},
        {id:2,tamanho:'M',fotos:[{foto_url:'/produto-frente.jpg'},{foto_url:'/produto-costas.jpg'}]},
    ]);
    assert.deepEqual(Array.from(fotos, foto=>foto.foto_url),['/produto-frente.jpg','/produto-costas.jpg']);
});
test('foto geral da Nuvemshop não recebe uma variação incorreta na legenda',()=>{
    const fotos=fotosDaRoupa([{id:1,tamanho:'G',cor:'Cinza',fotos:[
        {foto_url:'/detalhe.jpg',public_id:'nuvemshop-api:20:30:1:product'},
        {foto_url:'/cinza.jpg',public_id:'nuvemshop-api:20:31:1:variant'},
    ]}]);
    assert.equal(fotos[0].descricao,'');
    assert.equal(fotos[1].descricao,'G / Cinza');
});
function harness(){
    const state=[]; let cursor=0;
    const Component=load(name=>name==='react'?{...React,useState:initial=>{
        const index=cursor++;
        if(!(index in state))state[index]=initial;
        return [state[index],value=>state[index]=typeof value==='function'?value(state[index]):value];
    }}:require(name)).default;
    return props=>{cursor=0;return Component(props);};
}
function nodes(tree,type){
    if(!tree||typeof tree!=='object')return [];
    if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,type));
    return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)];
}
test('setas percorrem fotos e variações, dão a volta e não abrem detalhes do cartão',()=>{
    const render=harness(),props={nome:'Camisa',variacoes};
    let tree=render(props),stops=0;
    const urls=[];
    for(let i=0;i<4;i++){
        urls.push(nodes(tree,'img')[0].props.src);
        nodes(tree,'button')[1].props.onClick({stopPropagation:()=>stops++});
        tree=render(props);
    }
    assert.deepEqual(urls,['/azul-frente.jpg','/azul-costas.jpg','/preta.jpg','/azul-frente.jpg']);
    assert.equal(stops,4);
    nodes(tree,'button')[0].props.onClick({stopPropagation:()=>{}});
    tree=render(props);
    assert.equal(nodes(tree,'img')[0].props.src,'/azul-frente.jpg');
    nodes(tree,'button')[0].props.onClick({stopPropagation:()=>{}});
    tree=render(props);
    assert.equal(nodes(tree,'img')[0].props.src,'/preta.jpg');
    assert.match(nodes(tree,'img')[0].props.alt,/M \/ preta/);
});
test('cada cartão tem posição independente; reduzir fotos mantém índice válido',()=>{
    const a=harness(),b=harness(),props={nome:'Camisa',variacoes};
    nodes(a(props),'button')[1].props.onClick({stopPropagation:()=>{}});
    assert.equal(nodes(a(props),'img')[0].props.src,'/azul-costas.jpg');
    assert.equal(nodes(b(props),'img')[0].props.src,'/azul-frente.jpg');
    assert.equal(nodes(a({...props,variacoes:[{fotos:[{foto_url:'/restante.jpg'}]}]}),'img')[0].props.src,'/restante.jpg');
});
test('foto quebrada não impede navegar para outra imagem',()=>{
    const render=harness(),props={nome:'Camisa',variacoes};
    nodes(render(props),'img')[0].props.onError();
    assert.equal(nodes(render(props),'img').length,0);
    nodes(render(props),'button')[1].props.onClick({stopPropagation:()=>{}});
    assert.equal(nodes(render(props),'img')[0].props.src,'/azul-costas.jpg');
});
test('galeria manual substitui troca automática ao passar o mouse sem alterar caixa ou estoque',()=>{
    const page=fs.readFileSync(path.join(root,'page.tsx'),'utf8');
    assert.match(page,/<GaleriaRoupa nome=\{r.nome\} variacoes=\{r.variacoes \?\? \[\]\} \/>/);
    assert.doesNotMatch(page,/iniciarCarrossel|pararCarrossel|setInterval/);
    assert.doesNotMatch(source,/api\.|fetch\(/);
});
