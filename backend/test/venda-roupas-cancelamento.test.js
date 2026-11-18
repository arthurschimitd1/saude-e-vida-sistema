import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Executa o serviço real com dependências em memória, sem acessar o banco.
const source = readFileSync(new URL('../src/services/VendaService.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export default new VendaService\(\);/m, 'return new VendaService();')
  .replace(/^export \{.*\};\r?\n/gm, '')
  .replace(/^export /gm, '');

const usuario = { id: 11, empresa_id: 7, tipo: 'USUARIO' };

function fixture({ falharMovimento = false } = {}) {
  let estado = {
    venda: { id: 50, empresa_id: 7, funcionario_id: 11, orcamento_id: null },
    itens: [{
      venda_id: 50,
      tipo: 'roupa',
      roupa_id: 10,
      variacao_id: 1,
      quantidade: '2.000',
    }],
    saldo: 8,
    movimentos: [],
  };

  const eventos = [];
  const Op = { or: Symbol('or'), in: Symbol('in') };
  const sequelize = {
    query: async () => {},
    transaction: async () => ({
      LOCK: { UPDATE: 'UPDATE' },
      draft: structuredClone(estado),
      async commit() { estado = this.draft; eventos.push('commit'); },
      async rollback() { eventos.push('rollback'); },
    }),
  };
  const dados = options => options.transaction.draft;

  const Venda = {
    async findOne(options) {
      assert.equal(options.lock, 'UPDATE');
      const atual = dados(options).venda;
      return atual ? { ...atual } : null;
    },
    async destroy(options) { dados(options).venda = null; },
  };
  const VendaItem = {
    async findAll(options) { return structuredClone(dados(options).itens); },
    async destroy(options) { dados(options).itens = []; },
  };
  const EstoqueRoupaVariacao = {
    async findOne(options) {
      assert.equal(options.lock.level, 'UPDATE');
      assert.equal(options.where.id, 1);
      assert.equal(options.include[0].where.empresa_id, 7);
      const atual = dados(options);
      return {
        id: 1,
        roupa_id: 10,
        quantidade_atual: atual.saldo,
        async update(values, updateOptions) {
          assert.equal(values.quantidade_atual, 10);
          dados(updateOptions).saldo = values.quantidade_atual;
          this.quantidade_atual = values.quantidade_atual;
        },
      };
    },
  };
  const EstoqueRoupaMovimento = {
    async create(values, options) {
      if (falharMovimento) throw new Error('falha simulada');
      dados(options).movimentos.push(values);
    },
  };
  const deps = {
    Op,
    sequelize,
    Venda,
    VendaItem,
    EstoqueRoupaVariacao,
    EstoqueRoupaMovimento,
    EstoqueRoupa: {},
    User: { findAll: async () => [{ id: 11 }] },
    Product: { findByPk: async () => null },
    RawMaterial: { findByPk: async () => null },
    Movimento: { create: async () => {}, destroy: async () => {} },
    Comissao: { destroy: async () => {} },
    Orcamento: { update: async () => {} },
  };

  const service = new Function(...Object.keys(deps), source)(...Object.values(deps));
  return { service, estado: () => structuredClone(estado), eventos };
}

test('cancelar venda soma a quantidade textual e devolve à variação correta', async () => {
  const f = fixture();
  await f.service.delete(50, usuario);

  const resultado = f.estado();
  assert.equal(resultado.saldo, 10);
  assert.equal(resultado.venda, null);
  assert.equal(resultado.itens.length, 0);
  assert.equal(resultado.movimentos.length, 1);
  assert.equal(resultado.movimentos[0].tipo, 'entrada');
  assert.equal(resultado.movimentos[0].origem_tipo, 'venda_cancelada');
  assert.equal(resultado.movimentos[0].saldo_anterior, 8);
  assert.equal(resultado.movimentos[0].saldo_posterior, 10);
  assert.deepEqual(f.eventos, ['commit']);
});

test('falha na devolução desfaz estoque e mantém a venda', async () => {
  const f = fixture({ falharMovimento: true });
  const antes = f.estado();

  await assert.rejects(f.service.delete(50, usuario), /falha simulada/);

  assert.deepEqual(f.estado(), antes);
  assert.deepEqual(f.eventos, ['rollback']);
});
