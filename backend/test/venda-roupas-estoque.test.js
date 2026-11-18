import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Executa o serviço real com persistência em memória. Nenhuma importação de
// configuração, conexão, migração ou escrita em banco é feita por estes testes.
const source = readFileSync(new URL('../src/services/VendaService.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export default new VendaService\(\);/m, 'return new VendaService();')
  .replace(/^export \{.*\};\r?\n/gm, '')
  .replace(/^export /gm, '');
const user = { id: 11, empresa_id: 7, tipo: 'USUARIO' };
const roupa = (variacao_id = 1, quantidade = '2.000') => ({
  tipo: 'roupa', roupa_id: 10, variacao_id, quantidade,
  valor_unitario: '20.00', valor_total: Number(quantidade) * 20,
});

function fixture({ itens = [roupa()], falharMovimento = false, infinitas = [] } = {}) {
  let state = {
    venda: { id: 50, empresa_id: 7, funcionario_id: 11, pagamentos: [], data: '2026-09-11', valor_total: 40 },
    itens, saldos: { 1: 8, 2: 10 }, produtos: { 3: 5 }, materias: { 4: 6 },
    movimentos: [{ tipo: 'saida', quantidade: 2, variacao_id: 1, origem_tipo: 'venda' }],
  };
  let tail = Promise.resolve();
  const events = [];
  const Op = { or: Symbol('or'), in: Symbol('in') };
  const db = options => {
    assert.ok(options.transaction?.draft, 'escrita/leitura de itens deve usar a transação bloqueada');
    return options.transaction.draft;
  };
  const sequelize = {
    query: async () => {},
    transaction: async () => ({
      LOCK: { UPDATE: 'UPDATE' },
      async acquire() {
        const previous = tail;
        tail = new Promise(resolve => { this.release = resolve; });
        await previous;
        this.draft = structuredClone(state);
      },
      async commit() { state = this.draft; events.push('commit'); this.release(); },
      async rollback() { events.push('rollback'); this.release?.(); },
    }),
  };
  const Venda = {
    async findOne(options) {
      assert.equal(options.where[Op.or][0].empresa_id, 7);
      if (options.transaction) {
        assert.equal(options.lock, 'UPDATE');
        assert.equal(options.include, undefined, 'bloquear a venda antes de ler seus itens');
        await options.transaction.acquire();
        events.push('lock-venda');
      }
      const data = options.transaction ? db(options) : state;
      if (!data.venda) return null;
      return { ...data.venda, itens: options.include ? data.itens : undefined,
        async update(values, opts) { Object.assign(db(opts).venda, values); Object.assign(this, values); },
      };
    },
    async destroy(options) { db(options).venda = null; },
  };
  const VendaItem = {
    async findAll(options) { events.push('ler-itens'); return structuredClone(db(options).itens); },
    async create(item, options) { db(options).itens.push(item); },
    async destroy(options) { db(options).itens = []; },
  };
  const EstoqueRoupaVariacao = {
    async findOne(options) {
      assert.equal(options.lock.level, 'UPDATE');
      assert.equal(options.lock.of, EstoqueRoupaVariacao);
      assert.equal(options.include[0].where.empresa_id, 7);
      assert.equal(options.where.roupa_id, 10);
      const data = db(options), id = options.where.id;
      if (!(id in data.saldos)) return null;
      return { id, roupa_id: 10, quantidade_atual: data.saldos[id], estoque_infinito: infinitas.includes(Number(id)),
        async update(values, opts) {
          assert.ok(Number.isSafeInteger(values.quantidade_atual), 'estoque inteiro, nunca texto concatenado');
          assert.ok(values.quantidade_atual >= 0);
          db(opts).saldos[id] = values.quantidade_atual;
          Object.assign(this, values);
        },
      };
    },
  };
  const EstoqueRoupaMovimento = {
    async create(values, options) {
      if (falharMovimento) throw new Error('falha simulada no histórico');
      assert.equal(values.empresa_id, 7);
      assert.equal(values.usuario_id, 11);
      for (const field of ['quantidade', 'saldo_anterior', 'saldo_posterior']) assert.ok(Number.isSafeInteger(values[field]));
      db(options).movimentos.push(values);
    },
    async destroy() { assert.fail('histórico de roupa não pode ser apagado ao editar'); },
  };
  const estoqueComum = campo => ({
    async findByPk(id, options) {
      const data = db(options);
      if (!(id in data[campo])) return null;
      return { id, currentQuantity: data[campo][id], async update(values, opts) { db(opts)[campo][id] = values.currentQuantity; } };
    },
  });
  const noopWrite = async (_values, options) => { db(options); };
  const deps = {
    Op, sequelize, Venda, VendaItem, EstoqueRoupaVariacao, EstoqueRoupaMovimento, EstoqueRoupa: {},
    User: { findAll: async () => [{ id: 11 }] },
    Product: estoqueComum('produtos'), RawMaterial: estoqueComum('materias'),
    Movimento: { destroy: async options => db(options), create: noopWrite },
    Comissao: { count: async options => { db(options); return 0; }, destroy: async options => db(options) },
    taxaCartaoService: { aplicar: async value => value },
  };
  const service = new Function(...Object.keys(deps), source)(...Object.values(deps));
  service.criarComissoesVenda = async options => { db(options); };
  return { service, snapshot: () => structuredClone(state), events };
}

test('exclusão devolve quantidade DECIMAL textual à mesma variação e mantém histórico', async () => {
  const f = fixture();
  await f.service.delete(50, user);
  const result = f.snapshot();
  assert.deepEqual(result.saldos, { 1: 10, 2: 10 });
  assert.equal(result.venda, null);
  assert.equal(result.itens.length, 0);
  assert.equal(result.movimentos.length, 2);
  assert.equal(result.movimentos[1].origem_tipo, 'venda_cancelada');
  assert.equal(result.movimentos[1].saldo_anterior, 8);
  assert.equal(result.movimentos[1].saldo_posterior, 10);
  assert.deepEqual(f.events.slice(0, 2), ['lock-venda', 'ler-itens']);
});

for (const quantidade of [1, 2, 3]) test(`editar para ${quantidade} unidades ajusta apenas o saldo necessário`, async () => {
  const f = fixture();
  await f.service.update(50, { itens: [roupa(1, quantidade)], valor_total: quantidade * 20 }, user);
  assert.equal(f.snapshot().saldos[1], 10 - quantidade);
  assert.deepEqual(f.snapshot().movimentos.map(m => m.tipo), ['saida', 'entrada', 'saida']);
  await f.service.delete(50, user);
  assert.equal(f.snapshot().saldos[1], 10, 'cancelamento após edição devolve somente quantidade atual');
});

test('troca de tamanho/cor devolve a antiga e desconta apenas a nova variação', async () => {
  const f = fixture();
  await f.service.update(50, { itens: [roupa(2, 4)], valor_total: 80 }, user);
  assert.deepEqual(f.snapshot().saldos, { 1: 10, 2: 6 });
  await f.service.delete(50, user);
  assert.deepEqual(f.snapshot().saldos, { 1: 10, 2: 10 });
});

test('remover roupa durante edição devolve toda a quantidade', async () => {
  const f = fixture();
  await f.service.update(50, { itens: [], valor_total: 0 }, user);
  assert.equal(f.snapshot().saldos[1], 10);
  assert.deepEqual(f.snapshot().movimentos.map(m => m.tipo), ['saida', 'entrada']);
});

for (const [nome, item, erro] of [
  ['estoque insuficiente', roupa(2, 11), /Estoque insuficiente/],
  ['variação inexistente ou de outra empresa', roupa(99, 1), /não encontrada nesta empresa/],
  ['quantidade fracionada', roupa(2, 1.5), /número inteiro/],
]) test(`edição com ${nome} desfaz todas as alterações`, async () => {
  const f = fixture(), before = f.snapshot();
  await assert.rejects(f.service.update(50, { itens: [item], valor_total: 20 }, user), erro);
  assert.deepEqual(f.snapshot(), before);
  assert.ok(f.events.includes('rollback'));
});

test('falha ao registrar devolução mantém a venda e o estoque originais', async () => {
  const f = fixture({ falharMovimento: true }), before = f.snapshot();
  await assert.rejects(f.service.delete(50, user), /falha simulada/);
  assert.deepEqual(f.snapshot(), before);
});

test('roupa sem variação não é excluída silenciosamente sem devolver estoque', async () => {
  const f = fixture({ itens: [roupa(null)] }), before = f.snapshot();
  await assert.rejects(f.service.delete(50, user), /Variação.*obrigatória/);
  assert.deepEqual(f.snapshot(), before);
});

test('duas exclusões simultâneas devolvem o estoque uma única vez', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.service.delete(50, user), f.service.delete(50, user)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.snapshot().saldos[1], 10);
  assert.equal(f.snapshot().movimentos.length, 2);
});

test('edições simultâneas leem os itens atuais após bloquear a venda', async () => {
  const f = fixture();
  await Promise.all([f.service.update(50, { itens: [roupa(1, 3)], valor_total: 60 }, user),
    f.service.update(50, { itens: [roupa(1, 4)], valor_total: 80 }, user)]);
  assert.equal(f.snapshot().saldos[1], 6);
});

test('cancelamento misto continua devolvendo produto e matéria-prima sem estoque para serviço', async () => {
  const f = fixture({ itens: [roupa(), { tipo: 'produto', produto_id: 3, quantidade: '2.000' },
    { tipo: 'materia_prima', raw_material_id: 4, quantidade: '0.500' },
    { tipo: 'servico', produto_id: null, quantidade: '1.000' }] });
  await f.service.delete(50, user);
  assert.equal(f.snapshot().saldos[1], 10);
  assert.equal(f.snapshot().produtos[3], 7);
  assert.equal(f.snapshot().materias[4], 6.5);
});

test('estoque infinito permite qualquer quantidade e não é alterado por edição ou cancelamento', async () => {
  const f = fixture({ infinitas: [1] });
  await f.service.update(50, { itens: [roupa(1, 100)], valor_total: 2000 }, user);
  assert.equal(f.snapshot().saldos[1], 8);
  assert.equal(f.snapshot().movimentos.length, 1);
  await f.service.delete(50, user);
  assert.equal(f.snapshot().saldos[1], 8);
  assert.equal(f.snapshot().movimentos.length, 1);
});
