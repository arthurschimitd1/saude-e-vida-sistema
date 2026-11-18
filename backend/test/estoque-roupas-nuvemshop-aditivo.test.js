import test from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../src/config/database.js';
import EstoqueRoupa from '../src/models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../src/models/EstoqueRoupaVariacao.js';
import EstoqueRoupaMovimento from '../src/models/EstoqueRoupaMovimento.js';
import { adicionarAusentesNuvemshop } from '../src/controllers/EstoqueRoupaController.js';

const csv = [
  'Identificador URL;Nome;Categorias;Nome da variação 1;Valor da variação 1;Nome da variação 2;Valor da variação 2;Preço;Estoque;Marca;Custo',
  'relogio-existente;RELÓGIO EXISTENTE;Relógios;Cor;Preto;;;189.99;2;;0',
  'relogio-rolex-novo;RELÓGIO ROLEX;Relógios;Cor;Dourado;;;189.99;1;Tissot;0',
].join('\n');

test('inclusão Nuvemshop mantém peças antigas, adiciona apenas ausentes e é repetível', async t => {
  const existentes = [
    { id: 1, empresa_id: 7, nome: 'RELÓGIO EXISTENTE', tipo: 'Relógios', codigo: null,
      variacoes: [{ id: 10, tamanho: 'Único', cor: 'Preto', quantidade_atual: 5 }] },
    { id: 2, empresa_id: 7, nome: 'CADASTRO MANUAL', tipo: 'Outro', codigo: 'MANUAL',
      variacoes: [{ id: 11, tamanho: 'M', cor: null, quantidade_atual: 3 }] },
  ];
  const criados = [];
  const movimentos = [];
  t.mock.method(EstoqueRoupa, 'findAll', async ({ where }) => {
    assert.equal(where.empresa_id, 7);
    return existentes;
  });
  t.mock.method(sequelize, 'transaction', async () => ({ finished: false,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  }));
  t.mock.method(EstoqueRoupa, 'create', async data => {
    const roupa = { ...data, id: 3, variacoes: [] };
    criados.push(roupa);
    existentes.push(roupa);
    return roupa;
  });
  t.mock.method(EstoqueRoupaVariacao, 'create', async data => {
    const variacao = { ...data, id: 12 };
    existentes.find(roupa => roupa.id === data.roupa_id).variacoes.push(variacao);
    return variacao;
  });
  t.mock.method(EstoqueRoupaMovimento, 'create', async data => { movimentos.push(data); });

  const req = { user: { id: 99, empresa_id: 7 }, body: { confirmar: 'ADICIONAR' },
    file: { originalname: 'novo.csv', buffer: Buffer.from(csv, 'utf8') } };
  const resposta = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; } });
  const primeira = resposta();
  await adicionarAusentesNuvemshop(req, primeira);
  assert.equal(primeira.statusCode, 200);
  assert.deepEqual(primeira.data.resumo, {
    produtosAdicionados: 1, variacoesAdicionadas: 1, unidadesAdicionadas: 1,
    produtosJaExistentes: 1,
  });
  assert.equal(criados[0].nome, 'RELÓGIO ROLEX');
  assert.equal(criados[0].tipo, 'Relógios');
  assert.equal(criados[0].marca, 'Rolex');
  assert.equal(existentes[0].variacoes[0].quantidade_atual, 5);
  assert.equal(existentes[1].variacoes[0].quantidade_atual, 3);
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].saldo_posterior, 1);

  const segunda = resposta();
  await adicionarAusentesNuvemshop(req, segunda);
  assert.equal(segunda.data.resumo.produtosAdicionados, 0);
  assert.equal(criados.length, 1);
  assert.equal(movimentos.length, 1);
});
