import test from 'node:test';
import assert from 'node:assert/strict';
import vendaService from '../src/services/VendaService.js';
import Venda from '../src/models/Venda.js';
import User from '../src/models/UserModel.js';

test('usuários diferentes da mesma empresa recebem o mesmo escopo e ordem com desempate', async t => {
    const queries = [];
    t.mock.method(User, 'findAll', async () => [{ id: 11 }, { id: 12 }]);
    t.mock.method(Venda, 'findAll', async query => { queries.push(query); return []; });
    await vendaService.getAll({}, { id: 11, empresa_id: 7, tipo: 'USUARIO' });
    await vendaService.getAll({}, { id: 12, empresa_id: 7, tipo: 'USUARIO' });
    assert.deepEqual(queries[0].where, queries[1].where);
    assert.deepEqual(queries[0].order, [['data', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']]);
    assert.deepEqual(queries[0].order, queries[1].order);
});

test('master com empresa selecionada usa o mesmo escopo do funcionário da empresa', async t => {
    const queries = [];
    t.mock.method(User, 'findAll', async () => [{ id: 11 }]);
    t.mock.method(Venda, 'findAll', async query => { queries.push(query); return []; });
    await vendaService.getAll({}, { id: 1, empresa_id_override: 7, tipo: 'MASTER' });
    await vendaService.getAll({}, { id: 11, empresa_id: 7, tipo: 'USUARIO' });
    assert.deepEqual(queries[0].where, queries[1].where);
    assert.deepEqual(queries[0].order, queries[1].order);
});

test('filtro explícito de vendedor continua funcionando sem alterar a ordenação', async t => {
    let query;
    t.mock.method(User, 'findAll', async () => [{ id: 11 }]);
    t.mock.method(Venda, 'findAll', async value => { query = value; return []; });
    await vendaService.getAll({ funcionario_id: 11 }, { empresa_id: 7, tipo: 'USUARIO' });
    assert.equal(query.where.funcionario_id, 11);
    assert.deepEqual(query.order, [['data', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']]);
});
