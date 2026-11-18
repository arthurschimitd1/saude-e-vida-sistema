'use strict';

/**
 * Fecha dois contratos usados pelo fluxo de venda/agendamento:
 * - registra a origem do orçamento convertido no Caixa;
 * - garante a coluna de preço textual do catálogo da Agenda.
 *
 * A migration é idempotente para permitir rollout em bases que já receberam
 * parte do schema por uma atualização anterior.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const vendas = await queryInterface.describeTable('vendas');
      if (!vendas.orcamento_id) {
        await queryInterface.addColumn('vendas', 'orcamento_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'orcamentos', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'Orçamento convertido em venda no Caixa',
        }, { transaction });
      }

      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS vendas_orcamento_id_idx ON vendas (orcamento_id) WHERE orcamento_id IS NOT NULL',
        { transaction },
      );

      const servicos = await queryInterface.describeTable('agendamento_servicos');
      if (!servicos.preco_texto) {
        await queryInterface.addColumn('agendamento_servicos', 'preco_texto', {
          type: Sequelize.STRING(200),
          allowNull: true,
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    // A migration é idempotente e pode ter encontrado colunas previamente
    // criadas pelo bootstrap antigo. Não removemos schema em rollback para
    // evitar apagar dados/contratos que já existiam antes deste release.
  },
};
