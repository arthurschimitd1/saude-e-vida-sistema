import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBeneficiosRecorrencia,
  montarStatusFranquia,
  normalizarServicosInclusos,
  servicoInclusoCorresponde,
} from '../src/utils/franquiaRecorrencia.js';

test('recorrência sem serviços mantém o comportamento antigo', () => {
  assert.equal(normalizarServicosInclusos(undefined), null);
  assert.equal(normalizarServicosInclusos([]), null);
});

test('normaliza somente serviços com quantidade válida', () => {
  assert.deepEqual(normalizarServicosInclusos([
    { servicoId: 'srv_corte', servicoNome: 'Corte', quantidade: 4 },
    { servicoId: 'srv_invalido', servicoNome: 'Inválido', quantidade: 0 }
  ]), [{ servico_id: 'srv_corte', servico_nome: 'Corte', quantidade: 4 }]);
});

test('normaliza duplicidades pelo ID mantendo a última configuração', () => {
  assert.deepEqual(normalizarServicosInclusos([
    { servicoId: 'srv_corte', servicoNome: 'Corte', quantidade: 4 },
    { servicoId: 'srv_corte', servicoNome: 'Corte', quantidade: 6 },
  ]), [{ servico_id: 'srv_corte', servico_nome: 'Corte', quantidade: 6 }]);
});

test('normaliza duplicidades legadas pelo nome', () => {
  assert.deepEqual(normalizarServicosInclusos([
    { servicoNome: '  Corte  de   Cabelo ', quantidade: 4 },
    { servicoNome: 'corte de cabelo', quantidade: 5 },
  ]), [{ servico_id: null, servico_nome: 'corte de cabelo', quantidade: 5 }]);
});

test('ID explícito não confunde serviços diferentes com o mesmo nome', () => {
  assert.equal(servicoInclusoCorresponde(
    { id: 'srv_novo', nome: 'Corte' },
    { servico_id: 'srv_antigo', servico_nome: 'Corte', quantidade: 4 },
  ), false);
  assert.equal(servicoInclusoCorresponde(
    { id: 'srv_novo', nome: 'Corte' },
    { servico_id: null, servico_nome: 'corte', quantidade: 4 },
  ), true);
});

test('informa consumo e saldo dentro da franquia mensal', () => {
  const status = montarStatusFranquia({ limite: 4, utilizadosAntes: 2, servicoNome: 'Barba', recorrenciaId: 9 });
  assert.equal(status.utilizados, 3);
  assert.equal(status.restantes, 1);
  assert.equal(status.excedente, false);
});

test('quinto uso de uma franquia de quatro é cobrança adicional', () => {
  const status = montarStatusFranquia({ limite: 4, utilizadosAntes: 4, servicoNome: 'Barba', recorrenciaId: 9 });
  assert.equal(status.utilizados, 5);
  assert.equal(status.restantes, 0);
  assert.equal(status.excedente, true);
  assert.match(status.mensagem, /Cobrar este atendimento à parte/);
});

test('franquia mensal cobre os quatro primeiros agendamentos e cobra somente o quinto', () => {
  const recorrencias = [{
    id: 9,
    cliente_id: 15,
    ativo: true,
    dataInicio: '2026-09-01',
    dataFim: null,
    servicosInclusos: [{ servico_id: 'barba', servico_nome: 'Barba', quantidade: 4 }],
  }];
  const agendamentos = Array.from({ length: 5 }, (_, indice) => ({
    id: indice + 1,
    cliente_id: 15,
    servico_id: 'barba',
    servico_nome: 'Barba',
    data: `2026-09-0${indice + 1}`,
    horario: '10:00',
    status: 'confirmado',
  }));

  const beneficios = calcularBeneficiosRecorrencia(agendamentos, recorrencias);
  assert.deepEqual(
    agendamentos.map(agendamento => beneficios.get(String(agendamento.id))?.coberto),
    [true, true, true, true, false],
  );
  assert.equal(beneficios.get('5').excedente, true);
  assert.equal(beneficios.get('5').utilizados, 5);
});

test('agendamento misto zera somente o serviço incluído na recorrência', () => {
  const beneficios = calcularBeneficiosRecorrencia([{
    id: 30,
    cliente_id: 15,
    servicos: [
      { id: 'barba', nome: 'Barba' },
      { id: 'corte', nome: 'Corte' },
    ],
    data: '2026-09-02',
    horario: '11:00',
    status: 'confirmado',
  }], [{
    id: 9,
    cliente_id: 15,
    ativo: true,
    dataInicio: '2026-09-01',
    servicosInclusos: [{ servico_id: 'barba', servico_nome: 'Barba', quantidade: 4 }],
  }]);

  const beneficio = beneficios.get('30');
  assert.equal(beneficio.coberto, true);
  assert.deepEqual(beneficio.servicos.map(item => item.servico_id), ['barba']);
  assert.equal(beneficio.servicos.some(item => item.servico_id === 'corte'), false);
});
