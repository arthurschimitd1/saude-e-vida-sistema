import assert from 'node:assert/strict';
import test from 'node:test';

import {
    deveAplicarFiltroLegadoPorColaborador,
    servicoDisponivelNoEscopo,
} from '../src/services/AgendamentoService.js';
import { selecionarUnidadePublica } from '../src/services/PublicAgendamentoScopeService.js';
import migration from '../migrations/20260827130000-classify-sky-services-by-unit.cjs';

test('unidade usa somente vínculos explicitamente ativos', () => {
    assert.equal(servicoDisponivelNoEscopo({ somenteAtivos: true, unidadeId: 7, configuracao: null }), false);
    assert.equal(servicoDisponivelNoEscopo({ somenteAtivos: true, unidadeId: 7, configuracao: { ativo: false } }), false);
    assert.equal(servicoDisponivelNoEscopo({ somenteAtivos: true, unidadeId: 7, configuracao: { ativo: true } }), true);
    assert.equal(servicoDisponivelNoEscopo({ somenteAtivos: false, unidadeId: 7, configuracao: { ativo: false } }), true);
    assert.equal(servicoDisponivelNoEscopo({ somenteAtivos: true, unidadeId: null, configuracao: null }), true);
});

test('catálogo por unidade não depende do nome do profissional', () => {
    assert.equal(deveAplicarFiltroLegadoPorColaborador({ unidadeId: 7, colaboradorId: 3 }), false);
    assert.equal(deveAplicarFiltroLegadoPorColaborador({ unidadeId: null, colaboradorId: 3 }), true);
    assert.equal(deveAplicarFiltroLegadoPorColaborador({ unidadeId: null, colaboradorId: null }), false);
});

test('landing escolhe a unidade principal para aplicar o catálogo publicado', () => {
    assert.equal(selecionarUnidadePublica([
        { id: 22, ativa: true, principal: false },
        { id: 11, ativa: true, principal: true },
    ]).id, 11);
    assert.equal(selecionarUnidadePublica([
        { id: 22, ativa: false, principal: true },
        { id: 11, ativa: true, principal: false },
    ]).id, 11);
    assert.equal(selecionarUnidadePublica([]), null);
});

test('migration classifica o legado da Sky sem alterar preço e duração', async () => {
    const consultas = [];
    let commits = 0;
    const transaction = {
        async commit() { commits += 1; },
        async rollback() { throw new Error('rollback inesperado'); },
    };
    const queryInterface = {
        sequelize: {
            async transaction() { return transaction; },
            async query(sql) { consultas.push(String(sql).replace(/\s+/g, ' ').trim()); },
        },
    };

    await migration.up(queryInterface);

    assert.equal(commits, 1);
    assert.ok(consultas.some((sql) => sql.includes('pg_advisory_xact_lock')));
    const normalizacao = consultas.find((sql) => sql.includes('UPDATE agendamento_servico_unidades'));
    assert.ok(normalizacao?.includes("LOWER(s.nome) LIKE '%suzane%'"));
    assert.ok(normalizacao?.includes("unidades_sky.tipo = 'principal'"));
    assert.equal(normalizacao?.includes('preco ='), false);
    assert.equal(normalizacao?.includes('duracao_min ='), false);
});
