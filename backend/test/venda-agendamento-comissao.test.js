import assert from 'node:assert/strict';
import test from 'node:test';

import { resolverRegraComissaoServicoAgenda } from '../src/services/VendaService.js';

test('serviço da agenda herda a comissão do usuário quando não possui regra própria', () => {
  assert.deepEqual(
    resolverRegraComissaoServicoAgenda(
      { comissao_tipo: null, comissao_valor: 0 },
      { comissao_tipo: 'percent', comissao_valor: 40 },
    ),
    { tipo: 'percent', valorOrigem: 40, origemCalculo: 'usuario' },
  );
});

test('regra específica do serviço tem prioridade sobre a comissão do usuário', () => {
  assert.deepEqual(
    resolverRegraComissaoServicoAgenda(
      { comissao_tipo: 'valor', comissao_valor: 15 },
      { comissao_tipo: 'percent', comissao_valor: 40 },
    ),
    { tipo: 'valor', valorOrigem: 15, origemCalculo: 'servico_agendamento' },
  );
});

test('serviço com comissão explicitamente zerada não herda a regra do usuário', () => {
  assert.deepEqual(
    resolverRegraComissaoServicoAgenda(
      { comissao_tipo: 'percent', comissao_valor: 0 },
      { comissao_tipo: 'percent', comissao_valor: 40 },
    ),
    { tipo: 'percent', valorOrigem: 0, origemCalculo: 'servico_agendamento' },
  );
});

test('regra do profissional por serviço tem prioridade sobre valores antigos do catálogo da agenda', () => {
  assert.deepEqual(
    resolverRegraComissaoServicoAgenda(
      { nome: 'Corte', comissao_tipo: 'percent', comissao_valor: 40 },
      { id: 7, comissao_tipo: 'percent', comissao_valor: 40 },
      { funcionario_id: 7, servico_chave: 'corte', percentual: 42 },
    ),
    { tipo: 'percent', valorOrigem: 42, origemCalculo: 'servico_profissional' },
  );
});
