'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901101500-agendamento-configuracoes-intervalo'))`,
        { transaction },
      );

      const tabela = await queryInterface.describeTable('agendamento_configuracoes', { transaction });
      if (!tabela.intervalo_min) {
        await queryInterface.addColumn('agendamento_configuracoes', 'intervalo_min', {
          type: Sequelize.INTEGER,
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
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tabela = await queryInterface.describeTable('agendamento_configuracoes', { transaction });
      if (tabela.intervalo_min) {
        await queryInterface.removeColumn('agendamento_configuracoes', 'intervalo_min', { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
