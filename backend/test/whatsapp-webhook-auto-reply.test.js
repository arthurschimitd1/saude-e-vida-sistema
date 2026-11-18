import assert from 'node:assert/strict';
import test from 'node:test';

import sequelize from '../src/config/database.js';
import identificadorService from '../src/services/whatsappCrm/IdentificadorService.js';
import { WebhookService } from '../src/services/whatsappCrm/WebhookService.js';

test('mensagem recebida por @lid também passa pela resposta automática', async () => {
  const service = new WebhookService();
  const chamadas = [];
  const transacao = {
    async commit() { chamadas.push('commit'); },
    async rollback() { chamadas.push('rollback'); },
  };
  const transactionOriginal = sequelize.transaction;
  const acharClienteOriginal = identificadorService.acharClientePorIdentificador;

  sequelize.transaction = async () => transacao;
  identificadorService.acharClientePorIdentificador = async () => null;
  service._acharMensagemJaProcessada = async () => null;
  service._registrarEventoLidOrfao = async () => ({
    conversaId: 554,
    mensagemId: 900,
    lidOrfao: true,
    mergeSugerido: false,
    duplicada: false,
  });
  service._logWebhook = async () => { chamadas.push('log'); };
  service._processarAutoRespostaAgendamento = async (dados) => {
    chamadas.push({ autoResposta: dados });
    return { enviada: true };
  };

  try {
    const resultado = await service.processarMensagemRecebida(55, {
      phone: '123456789@lid',
      senderName: 'Arthur',
      fromMe: false,
      messageId: 'msg-lid-1',
      text: { message: 'Tem horário disponível?' },
    });

    assert.equal(resultado.conversaId, 554);
    assert.deepEqual(chamadas, [
      'commit',
      'log',
      {
        autoResposta: {
          empresaId: 55,
          conversaId: 554,
          texto: 'Tem horário disponível?',
          fromMe: false,
        },
      },
    ]);
  } finally {
    sequelize.transaction = transactionOriginal;
    identificadorService.acharClientePorIdentificador = acharClienteOriginal;
  }
});

test('evento repetido encerra antes de abrir transação ou reenviar automação', async () => {
  const service = new WebhookService();
  let abriuTransacao = false;
  let chamouAutomacao = false;
  const transactionOriginal = sequelize.transaction;

  sequelize.transaction = async () => {
    abriuTransacao = true;
    throw new Error('não deveria abrir transação');
  };
  service._acharMensagemJaProcessada = async () => ({ id: 901, conversa_id: 554 });
  service._processarAutoRespostaAgendamento = async () => {
    chamouAutomacao = true;
  };

  try {
    const resultado = await service.processarMensagemRecebida(55, {
      phone: '5583999999999',
      senderName: 'Arthur',
      fromMe: false,
      messageId: 'msg-repetida',
      text: { message: 'Tem horário disponível?' },
    });

    assert.deepEqual(resultado, { conversaId: 554, mensagemId: 901, duplicada: true });
    assert.equal(abriuTransacao, false);
    assert.equal(chamouAutomacao, false);
  } finally {
    sequelize.transaction = transactionOriginal;
  }
});
