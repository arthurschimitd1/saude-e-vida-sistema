'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const servicos = await queryInterface.describeTable('agendamento_servicos');
      if (!servicos.comissao_tipo) {
        await queryInterface.addColumn('agendamento_servicos', 'comissao_tipo', {
          type: Sequelize.STRING(20),
          allowNull: true,
        }, { transaction });
      }
      if (!servicos.comissao_valor) {
        await queryInterface.addColumn('agendamento_servicos', 'comissao_valor', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        }, { transaction });
      }

      const itens = await queryInterface.describeTable('venda_itens');
      if (!itens.agendamento_id) {
        await queryInterface.addColumn('venda_itens', 'agendamento_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'agendamentos', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }
      if (!itens.agendamento_servico_id) {
        await queryInterface.addColumn('venda_itens', 'agendamento_servico_id', {
          type: Sequelize.STRING(80),
          allowNull: true,
        }, { transaction });
      }

      const comissoes = await queryInterface.describeTable('comissoes');
      if (!comissoes.origem) {
        await queryInterface.addColumn('comissoes', 'origem', {
          type: Sequelize.STRING(30),
          allowNull: false,
          defaultValue: 'venda_produtos',
        }, { transaction });
      }
      if (!comissoes.base_calculo) {
        await queryInterface.addColumn('comissoes', 'base_calculo', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        }, { transaction });
      }
      if (!comissoes.agendamento_id) {
        await queryInterface.addColumn('comissoes', 'agendamento_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'agendamentos', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }
      if (!comissoes.servico_id) {
        await queryInterface.addColumn('comissoes', 'servico_id', {
          type: Sequelize.STRING(80),
          allowNull: true,
        }, { transaction });
      }
      if (!comissoes.descricao) {
        await queryInterface.addColumn('comissoes', 'descricao', {
          type: Sequelize.STRING(300),
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_venda_itens_agendamento
         ON venda_itens (agendamento_id)
         WHERE agendamento_id IS NOT NULL`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_venda_itens_agendamento_servico
         ON venda_itens (agendamento_id)
         WHERE agendamento_id IS NOT NULL`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_comissoes_venda_origem
         ON comissoes (venda_id, origem)`,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_comissoes_venda_origem', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_venda_itens_agendamento_servico', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_venda_itens_agendamento', { transaction });
      for (const column of ['descricao', 'servico_id', 'agendamento_id', 'base_calculo', 'origem']) {
        await queryInterface.removeColumn('comissoes', column, { transaction });
      }
      for (const column of ['agendamento_servico_id', 'agendamento_id']) {
        await queryInterface.removeColumn('venda_itens', column, { transaction });
      }
      for (const column of ['comissao_valor', 'comissao_tipo']) {
        await queryInterface.removeColumn('agendamento_servicos', column, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
