import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { calcularResumoTurno } from '../src/utils/resumoTurno.js';
import { prepararSaidaPagamento } from '../src/utils/saidaPagamento.js';

const turno = { id: 7, empresa_id: 12, status: 'aberto', valor_abertura: '100.00', data_abertura: '2026-09-13T10:00:00Z', data_fechamento: '2026-09-13T12:30:00Z' };
const vendas = [{ pagamentos: [{ forma: 'DINHEIRO', valor: 80, valorRecebido: 100 }, { forma: 'PIX', valor: 40 }, { forma: 'CARTAO', valor: 20 }] }];
const saida = (forma_pagamento, valor, extra = {}) => ({ natureza: 'SAIDA', status: 'pago', turno_id: 7, empresa_id: 12, forma_pagamento, valor, ...extra });

test('saídas descontam de sua forma; saldo da gaveta não desconta troco duas vezes', () => {
    const r = calcularResumoTurno(turno, vendas, [saida('DINHEIRO', '30.00'), saida('PIX', 10), saida('CARTAO', 5)]);
    assert.equal(r.totalGeral, 140); assert.equal(r.totalSaidas, 45);
    assert.equal(r.saldoEsperado, 150); assert.equal(r.trocoTotal, 20);
    assert.equal(r.liquidoDinheiro, 50); assert.equal(r.liquidoPix, 30); assert.equal(r.liquidoCartao, 15);
    assert.equal(r.qtdSaidas, 3); assert.equal(r.duracaoTexto, '2h 30min');
});
test('editar valor/forma e excluir recalculam o saldo do mesmo turno', () => {
    assert.equal(calcularResumoTurno(turno, vendas, [saida('DINHEIRO', 30)]).saldoEsperado, 150);
    assert.equal(calcularResumoTurno(turno, vendas, [saida('DINHEIRO', 50)]).saldoEsperado, 130);
    assert.equal(calcularResumoTurno(turno, vendas, [saida('PIX', 50)]).saldoEsperado, 180);
    assert.equal(calcularResumoTurno(turno, vendas, []).saldoEsperado, 180);
    assert.equal(calcularResumoTurno({ ...turno, valor_fechamento: 145 }, vendas, [saida('DINHEIRO', 30)]).diferenca, -5);
});
test('pendentes/entradas não são retiradas e forma desconhecida não é inventada como dinheiro', () => {
    const r = calcularResumoTurno(turno, [], [saida('DINHEIRO', 40, { status: 'pendente' }), saida('PIX', 40, { natureza: 'ENTRADA' }), saida(null, 10)]);
    assert.equal(r.totalSaidas, 10); assert.equal(r.qtdSaidas, 1); assert.equal(r.saidasSemForma, 10); assert.equal(r.saldoEsperado, 100);
});
test('vendas antigas sem array de pagamentos e centavos são preservados', () => {
    const r = calcularResumoTurno({ ...turno, valor_abertura: 0 }, [{ forma_pagamento: 'DINHEIRO', valor_total: '0.30' }, { forma_pagamento: 'PIX', valor_total: 10, pagamentos: [] }], [saida('DINHEIRO', '0.10')]);
    assert.equal(r.saldoEsperado, 0.2); assert.equal(r.totalGeral, 10.3); assert.equal(r.totalPix, 10);
});
test('grava pagamento e turno da empresa como saída paga', async () => {
    const result = await prepararSaidaPagamento({ turno_id: '7', forma_pagamento: 'PIX', valor: 10 }, null, 12, async q => {
        assert.deepEqual(q.where, { id: 7, empresa_id: 12 }); return turno;
    });
    assert.deepEqual(result, { turno_id: 7, forma_pagamento: 'PIX', status: 'pago' });
});
test('recusa turno de outra empresa ou fechado e pagamento ausente/inválido', async () => {
    const body = { turno_id: 7, forma_pagamento: 'DINHEIRO', valor: 10 };
    await assert.rejects(prepararSaidaPagamento(body, null, 12, async () => null), /nesta empresa/);
    await assert.rejects(prepararSaidaPagamento(body, null, null, async () => turno), /empresa/);
    await assert.rejects(prepararSaidaPagamento(body, null, 12, async () => ({ ...turno, status: 'fechado' })), /turno aberto/);
    for (const change of [{ forma_pagamento: null }, { forma_pagamento: 'OUTRO' }, { turno_id: -1 }, { turno_id: 1.2 }, { valor: 0 }, { valor: 'abc' }, { natureza: 'ENTRADA' }, { status: 'pendente' }]) {
        await assert.rejects(prepararSaidaPagamento({ ...body, ...change }, null, 12, async () => turno));
    }
});
test('edição preserva turno original inclusive fechado e impede transferir/desvincular', async () => {
    const anterior = saida('DINHEIRO', 10);
    const r = await prepararSaidaPagamento({ valor: 20, forma_pagamento: 'PIX' }, anterior, 12, async () => ({ ...turno, status: 'fechado' }));
    assert.deepEqual(r, { forma_pagamento: 'PIX', turno_id: 7, status: 'pago' });
    for (const turno_id of [null, 8]) await assert.rejects(prepararSaidaPagamento({ turno_id }, anterior, 12, async () => turno), /transferir/);
});
test('legado financeiro sem turno continua sem classificação ou alteração de status', async () => {
    const r = await prepararSaidaPagamento({ valor: 20 }, { valor: 10, status: 'pendente' }, 12, () => assert.fail('Não consultar turno inexistente'));
    assert.deepEqual(r, { forma_pagamento: null, turno_id: null });
});

// Executa a rota com banco inteiramente simulado, sem inicializar modelos/conexões.
function rota(query) {
    const routes = {};
    const router = { get: (p, ...handlers) => routes['GET ' + p] = handlers.at(-1), post: () => {}, put: () => {} };
    const source = readFileSync(new URL('../src/routes/turnoCaixaRoutes.js', import.meta.url), 'utf8')
        .replace(/^import .*;\s*$/gm, '').replace('ensureTable().catch(console.error);', '').replace('export default router;', '');
    vm.runInNewContext(source, { Router: () => router, auth: () => {}, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } }, empresaParaGravar: u => u.empresa_id, calcularResumoTurno });
    return routes['GET /:id/movimentos'];
}
async function consultar(handler) {
    const result = { status: 200 };
    const res = { status: n => { result.status = n; return res; }, json: body => result.body = body };
    await handler({ user: { empresa_id: 12 }, params: { id: '7' } }, res);
    return result;
}
test('relatório consulta apenas saídas pagas do turno e da empresa; retorna lista e resumo', async () => {
    let n = 0;
    const handler = rota(async (sql, options) => {
        assert.equal(options.replacements.empresaId, 12);
        assert.match(sql, /empresa_id = :empresaId/);
        if (++n === 1) return [turno];
        assert.equal(options.replacements.turnoId, 7);
        assert.match(sql, /turno_id = :turnoId/);
        if (n === 2) return vendas;
        assert.match(sql, /natureza = 'SAIDA' AND status = 'pago'/);
        return [saida('DINHEIRO', 30)];
    });
    const r = await consultar(handler);
    assert.equal(r.status, 200); assert.equal(r.body.saidas.length, 1); assert.equal(r.body.resumo.saldoEsperado, 150);
});
test('turno fora do escopo não consulta movimentos; erro de consulta não mostra saldo falso', async () => {
    let count = 0;
    const r = await consultar(rota(async () => { count++; return []; }));
    assert.equal(r.status, 404); assert.equal(count, 1);
    let calls = 0;
    const fail = await consultar(rota(async () => { if (++calls === 1) return [turno]; throw Error('offline'); }));
    assert.equal(fail.status, 500); assert.equal(fail.body.resumo, undefined);
});
test('migração apenas acrescenta colunas opcionais e índice sem atualizar histórico', async () => {
    const migration = createRequire(import.meta.url)('../migrations/20260913160000-add-saidas-pagamento-turno.cjs');
    const sql = [];
    await migration.up({ sequelize: { transaction: cb => cb('tx'), query: async (s, opts) => { assert.equal(opts.transaction, 'tx'); sql.push(s); } } });
    assert.equal(sql.length, 2); assert.match(sql[0], /ADD COLUMN IF NOT EXISTS forma_pagamento/); assert.match(sql[0], /turno_id INTEGER/);
    assert.doesNotMatch(sql.join(' '), /\b(UPDATE|DELETE|DROP|TRUNCATE|NOT NULL)\b/i);
});

test('CRUD do caixa persiste forma/turno, reflete edição/exclusão e recusa turno de outra empresa', async () => {
    const rows = [];
    const source = readFileSync(new URL('../src/controllers/financeiroController.js', import.meta.url), 'utf8');
    const functions = ['criarSaida', 'atualizarSaida', 'deletarSaida'].map(name => {
        const part = source.match(new RegExp('export const ' + name + ' = async[\\s\\S]*?^};', 'm'));
        assert.ok(part, name); return part[0].replace('export const ', 'globalThis.');
    }).join('\n');
    const context = vm.createContext({
        console: { error: () => {} }, resolverEmpresaId: req => req.user.empresa_id, prepararSaidaPagamento,
        exigirEmpresaId: (req, res) => {
            const empresaId = req.user.empresa_id;
            if (!empresaId) { res.status(400).json({ error: 'Selecione uma empresa para acessar as saídas' }); return null; }
            return Number(empresaId);
        },
        TurnoCaixa: { findOne: async ({ where }) => where.id === 7 && where.empresa_id === 12 ? turno : null },
        Saida: {
            create: async attrs => {
                const record = { ...attrs, id: 1, update: async data => Object.assign(record, data), destroy: async () => rows.splice(rows.indexOf(record), 1) };
                rows.push(record); return record;
            },
            findOne: async ({ where }) => rows.find(r => r.id === where.id && r.empresa_id === where.empresa_id),
        },
    });
    vm.runInContext(functions, context);
    async function call(name, body, empresa_id = 12) {
        const result = { status: 200 };
        const res = { status: n => { result.status = n; return res; }, json: body => result.body = body };
        await context[name]({ user: { empresa_id }, params: { id: 1 }, body }, res); return result;
    }
    const body = { tipo: 'Fornecedor', data: '2026-09-13', valor: 30, natureza: 'SAIDA', forma_pagamento: 'DINHEIRO', turno_id: 7 };
    assert.equal((await call('criarSaida', body)).status, 201);
    assert.equal(rows[0].status, 'pago'); assert.equal(rows[0].turno_id, 7); assert.equal(rows[0].forma_pagamento, 'DINHEIRO');
    assert.equal(calcularResumoTurno(turno, vendas, rows).saldoEsperado, 150);
    assert.equal((await call('atualizarSaida', { ...body, valor: 50, forma_pagamento: 'PIX' })).status, 200);
    assert.equal(rows.length, 1); assert.equal(calcularResumoTurno(turno, vendas, rows).saidasPix, 50);
    assert.equal(calcularResumoTurno(turno, vendas, rows).saldoEsperado, 180);
    assert.equal((await call('deletarSaida', {}, 99)).status, 404); assert.equal(rows.length, 1);
    assert.equal((await call('deletarSaida', {})).status, 200); assert.equal(rows.length, 0);
    assert.notEqual((await call('criarSaida', body, 99)).status, 201); assert.equal(rows.length, 0);
});
