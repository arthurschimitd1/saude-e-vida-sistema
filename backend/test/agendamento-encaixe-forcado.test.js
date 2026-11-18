import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  deveRevalidarDisponibilidadeNaAtualizacao,
  usuarioPodeForcarEncaixe,
} from '../src/services/AgendamentoService.js';

test('somente gestores ou usuários com escopo total podem forçar encaixe', () => {
  assert.equal(usuarioPodeForcarEncaixe({ tipo: 'MASTER', permissoes: [] }), true);
  assert.equal(usuarioPodeForcarEncaixe({ tipo: 'EMPRESA', permissoes: [] }), true);
  assert.equal(usuarioPodeForcarEncaixe({ tipo: 'FUNCIONARIO', permissoes: ['agendamento:todos'] }), true);
  assert.equal(usuarioPodeForcarEncaixe({ tipo: 'FUNCIONARIO', permissoes: [] }), false);
});

test('migration preserva encaixes antigos pelo histórico e é aditiva', () => {
  const migration = fs.readFileSync(
    new URL('../migrations/20260904103000-add-forced-fit-to-appointments.cjs', import.meta.url),
    'utf8',
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS encaixe_forcado/);
  assert.match(migration, /jsonb_array_elements/);
  assert.match(migration, /Encaixe forçado por%/);
});

test('mudança apenas de status não revalida nem bloqueia uma comanda já criada', () => {
  assert.equal(deveRevalidarDisponibilidadeNaAtualizacao({
    alterouAgenda: false,
    statusAtual: 'aguardando',
    statusDestino: 'confirmado',
  }), false);
  assert.equal(deveRevalidarDisponibilidadeNaAtualizacao({
    alterouAgenda: false,
    statusAtual: 'confirmado',
    statusDestino: 'finalizado',
  }), false);
});

test('revalida quando o horário muda ou um cancelamento é reativado', () => {
  assert.equal(deveRevalidarDisponibilidadeNaAtualizacao({
    alterouAgenda: true,
    statusAtual: 'aguardando',
    statusDestino: 'aguardando',
  }), true);
  assert.equal(deveRevalidarDisponibilidadeNaAtualizacao({
    alterouAgenda: false,
    statusAtual: 'cancelado',
    statusDestino: 'aguardando',
  }), true);
});
