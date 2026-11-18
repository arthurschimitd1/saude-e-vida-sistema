import assert from 'node:assert/strict';
import test from 'node:test';

import { AutoRespostaAgendamentoService, ORIGEM_AUTOMACAO_AGENDAMENTO } from '../src/services/whatsappCrm/AutoRespostaAgendamentoService.js';
import migration from '../migrations/20260902110000-add-whatsapp-booking-auto-reply.cjs';
import {
  DOM_FERRAZ_LANDING_URL,
  detectarIntencaoAgendamento,
  ehEmpresaDomFerraz,
  montarMensagemAgendamento,
  normalizarConfiguracaoAutomacao,
} from '../src/utils/whatsappAgendamentoAutoReply.js';

test('restringe a automação às três empresas Dom Ferraz', () => {
  assert.equal(ehEmpresaDomFerraz('Dom Ferraz - Manaíra'), true);
  assert.equal(ehEmpresaDomFerraz('DOM FERRAZ - MIRAMAR'), true);
  assert.equal(ehEmpresaDomFerraz('Dom Ferraz - Sapé'), true);
  assert.equal(ehEmpresaDomFerraz('Outra Barbearia'), false);
  assert.equal(ehEmpresaDomFerraz('Dom Ferraz Franquia Teste'), false);
});

test('migration é aditiva, repetível e serializada para produção serverless', async () => {
  const queries = [];
  let commits = 0;
  const queryInterface = {
    sequelize: {
      async transaction() {
        return {
          async commit() { commits += 1; },
          async rollback() { throw new Error('rollback inesperado'); },
        };
      },
      async query(sql, options) {
        queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), options });
        return [[], []];
      },
    },
  };

  await migration.up(queryInterface);
  await migration.up(queryInterface);

  assert.equal(commits, 2);
  assert.equal(queries.filter(({ sql }) => sql.includes('pg_advisory_xact_lock')).length, 2);
  assert.equal(queries.filter(({ sql }) => sql.includes('ADD COLUMN IF NOT EXISTS automacao_agendamento')).length, 2);
  assert.ok(queries.every(({ options }) => options?.transaction));
});

test('detecta intenção clara de agendar sem disparar em cancelamento ou conversa comum', () => {
  const positivas = [
    'Quero agendar um corte',
    'Tem horário disponível amanhã?',
    'Queria marcar um horário para barba',
    'Quais os horários livres?',
    'Gostaria de ver os horários disponíveis',
    'Tem vagas livres hoje?',
  ];
  const negativas = [
    'Bom dia, qual o valor do corte?',
    'Quero cancelar meu agendamento',
    'Não quero agendar agora',
    'Obrigado pelo atendimento',
  ];

  positivas.forEach((texto) => assert.equal(detectarIntencaoAgendamento(texto), true, texto));
  negativas.forEach((texto) => assert.equal(detectarIntencaoAgendamento(texto), false, texto));
});

test('normaliza limites e garante o link oficial na mensagem', () => {
  assert.deepEqual(normalizarConfiguracaoAutomacao({ ativa: 1, mensagem: '  Oi  ', cooldown_horas: 0 }), {
    ativa: false,
    mensagem: 'Oi',
    cooldown_horas: 1,
  });
  assert.equal(montarMensagemAgendamento({ ativa: true, mensagem: 'Agende: {{link}}', cooldown_horas: 24 }), `Agende: ${DOM_FERRAZ_LANDING_URL}`);
  assert.equal(montarMensagemAgendamento({ ativa: true, mensagem: 'Faça seu agendamento', cooldown_horas: 24 }), `Faça seu agendamento\n${DOM_FERRAZ_LANDING_URL}`);
});

function montarCenario({ empresaNome = 'Dom Ferraz - Sapé', reservadas = 1, statusEnvio = 'enviada' } = {}) {
  const atualizacoes = [];
  const envios = [];
  const logs = [];
  const instante = new Date('2026-09-02T12:00:00.000Z');

  const service = new AutoRespostaAgendamentoService({
    EmpresaModel: {
      findByPk: async () => ({ id: 10, nome: empresaNome }),
    },
    WhatsappConfigModel: {
      findOne: async () => ({
        zapi_instance_id: 'instancia',
        zapi_token: 'token-criptografado',
        automacao_agendamento: { ativa: true, mensagem: 'Agende aqui: {{link}}', cooldown_horas: 168 },
      }),
    },
    WhatsappConversaModel: {
      findOne: async () => ({ id: 20, empresa_id: 10, resposta_agendamento_em: null }),
      update: async (values, options) => {
        atualizacoes.push({ values, options });
        return atualizacoes.length === 1 ? [reservadas] : [1];
      },
    },
    mensagem: {
      enviarTexto: async (...args) => {
        envios.push(args);
        return { id: 30, status: statusEnvio };
      },
    },
    logs: {
      registrar: async (...args) => { logs.push(args); },
    },
    agora: () => instante,
  });

  return { service, atualizacoes, envios, logs, instante };
}

test('envia o link uma única vez quando a mensagem é elegível', async () => {
  const cenario = montarCenario();
  const resultado = await cenario.service.processar({ empresaId: 10, conversaId: 20, texto: 'Tem horário amanhã?' });

  assert.deepEqual(resultado, { enviada: true, mensagemId: 30 });
  assert.equal(cenario.envios.length, 1);
  assert.equal(cenario.envios[0][0], 20);
  assert.equal(cenario.envios[0][1], `Agende aqui: ${DOM_FERRAZ_LANDING_URL}`);
  assert.deepEqual(cenario.envios[0][3], { origem: ORIGEM_AUTOMACAO_AGENDAMENTO });
  assert.equal(cenario.atualizacoes.length, 1);
  assert.equal(cenario.logs.length, 1);
});

test('não duplica resposta quando outra mensagem já reservou o período', async () => {
  const cenario = montarCenario({ reservadas: 0 });
  const resultado = await cenario.service.processar({ empresaId: 10, conversaId: 20, texto: 'Quero agendar' });

  assert.deepEqual(resultado, { enviada: false, motivo: 'ja_enviada_recentemente' });
  assert.equal(cenario.envios.length, 0);
});

test('libera a trava quando a Z-API não consegue enviar', async () => {
  const cenario = montarCenario({ statusEnvio: 'falha' });
  const resultado = await cenario.service.processar({ empresaId: 10, conversaId: 20, texto: 'Quero marcar um corte' });

  assert.deepEqual(resultado, { enviada: false, motivo: 'falha_no_envio' });
  assert.equal(cenario.atualizacoes.length, 2);
  assert.equal(cenario.atualizacoes[1].values.resposta_agendamento_em, null);
  assert.equal(cenario.logs.length, 1);
});

test('não envia em empresa fora do escopo mesmo com configuração ativa', async () => {
  const cenario = montarCenario({ empresaNome: 'Barbearia Exemplo' });
  const resultado = await cenario.service.processar({ empresaId: 10, conversaId: 20, texto: 'Quero agendar' });

  assert.deepEqual(resultado, { enviada: false, motivo: 'empresa_fora_do_escopo' });
  assert.equal(cenario.envios.length, 0);
  assert.equal(cenario.atualizacoes.length, 0);
});
