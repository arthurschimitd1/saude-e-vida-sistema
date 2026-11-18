import assert from 'node:assert/strict';
import test from 'node:test';
import { removerDadosBancariosLegados } from '../src/services/Recorrencia.service.js';

test('novas recorrências deixam a conta recebedora exclusivamente com o Asaas', () => {
  const dados = removerDadosBancariosLegados({
    formaPagamento: 'PIX',
    valorMes: 99,
    bancoRecebimento: 'Banco legado',
    bancoNome: 'Banco legado',
    bancoAgencia: '0001',
    bancoConta: '12345-6',
    bancoPix: 'chave-legada',
  });

  assert.deepEqual(dados, { formaPagamento: 'PIX', valorMes: 99 });
});

test('remoção dos campos bancários não altera o objeto original nem os dados da recorrência', () => {
  const original = { nomeCliente: 'Cliente', bancoConta: 'legado', ativo: true };
  const limpo = removerDadosBancariosLegados(original);

  assert.deepEqual(original, { nomeCliente: 'Cliente', bancoConta: 'legado', ativo: true });
  assert.deepEqual(limpo, { nomeCliente: 'Cliente', ativo: true });
});
