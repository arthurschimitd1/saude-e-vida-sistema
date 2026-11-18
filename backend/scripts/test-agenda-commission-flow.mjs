import assert from 'node:assert/strict';
import sequelize from '../src/config/database.js';
import Venda from '../src/models/Venda.js';
import VendaItem from '../src/models/VendaItem.js';
import Comissao from '../src/models/Comissao.js';
import AgendamentoServico from '../src/models/AgendamentoServico.js';
import User from '../src/models/UserModel.js';
import VendaService from '../src/services/VendaService.js';

const transaction = await sequelize.transaction();

try {
  const [candidatos] = await sequelize.query(
    `SELECT a.id AS agendamento_id,
            a.empresa_id,
            a.servico_id,
            ac.usuario_id
       FROM agendamentos a
       JOIN agendamento_colaboradores ac
         ON ac.id = a.colaborador_id
        AND ac.empresa_id = a.empresa_id
       JOIN agendamento_servicos s
         ON s.id = a.servico_id
        AND s.empresa_id = a.empresa_id
       JOIN users u
         ON u.id = ac.usuario_id
        AND u.empresa_id = a.empresa_id
  LEFT JOIN venda_itens vi
         ON vi.agendamento_id = a.id
      WHERE a.status <> 'cancelado'
        AND vi.id IS NULL
      ORDER BY a.id DESC
      LIMIT 1`,
    { transaction }
  );

  assert.ok(candidatos[0], 'Nao existe agendamento elegivel para o teste transacional');
  const candidato = candidatos[0];

  const servico = await AgendamentoServico.findOne({
    where: { id: candidato.servico_id, empresa_id: candidato.empresa_id },
    transaction,
  });
  const profissional = await User.findOne({
    where: { id: candidato.usuario_id, empresa_id: candidato.empresa_id },
    transaction,
  });
  assert.ok(servico && profissional, 'Servico ou profissional nao encontrado no escopo da empresa');

  await servico.update({ comissao_tipo: 'percent', comissao_valor: 40 }, { transaction });
  await profissional.update({ comissao_tipo: 'percent', comissao_valor: 10 }, { transaction });

  const venda = await Venda.create({
    funcionario_id: profissional.id,
    empresa_id: candidato.empresa_id,
    forma_pagamento: 'Dinheiro',
    valor_total: 150,
  }, { transaction });

  const origemAgenda = await VendaService.resolverServicoAgenda({
    agendamento_id: candidato.agendamento_id,
    servico_id: candidato.servico_id,
  }, candidato.empresa_id, transaction);

  await VendaItem.create({
    venda_id: venda.id,
    tipo: 'servico',
    nome_item: servico.nome,
    quantidade: 1,
    valor_unitario: 50,
    valor_total: 50,
    agendamento_id: candidato.agendamento_id,
    agendamento_servico_id: candidato.servico_id,
  }, { transaction });

  await VendaService.criarComissoesVenda({
    venda,
    funcionarioId: profissional.id,
    servicosAgenda: [{ ...origemAgenda, quantidade: 1, valorTotal: 50 }],
    transaction,
  });

  const comissoes = await Comissao.findAll({
    where: { venda_id: venda.id },
    order: [['origem', 'ASC']],
    transaction,
  });
  assert.equal(comissoes.length, 2);

  const produtos = comissoes.find(item => item.origem === 'venda_produtos');
  const agenda = comissoes.find(item => item.origem === 'servico_agendamento');
  assert.equal(Number(produtos.base_calculo), 100);
  assert.equal(Number(produtos.valor), 10);
  assert.equal(Number(agenda.base_calculo), 50);
  assert.equal(Number(agenda.valor), 20);
  assert.equal(Number(agenda.funcionario_id), Number(candidato.usuario_id));
  assert.equal(Number(agenda.agendamento_id), Number(candidato.agendamento_id));

  console.log(JSON.stringify({
    ok: true,
    vendaTemporaria: venda.id,
    baseProdutos: Number(produtos.base_calculo),
    comissaoProdutos: Number(produtos.valor),
    baseServico: Number(agenda.base_calculo),
    comissaoServico: Number(agenda.valor),
    rollback: true,
  }, null, 2));
} finally {
  await transaction.rollback();
  await sequelize.close();
}
