'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = [
        ['mercado_pago_preference_id', { type: Sequelize.STRING(120), allowNull: true }],
        ['mercado_pago_payment_id', { type: Sequelize.STRING(120), allowNull: true }],
        ['mercado_pago_status', { type: Sequelize.STRING(40), allowNull: true }],
        ['mercado_pago_ultimo_evento_em', { type: Sequelize.DATE, allowNull: true }],
      ];
      const description = await queryInterface.describeTable('vendas', { transaction });
      for (const [column, definition] of columns) {
        if (!description[column]) await queryInterface.addColumn('vendas', column, definition, { transaction });
      }
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS vendas_mercado_pago_payment_idx ON vendas (mercado_pago_payment_id)',
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS vendas_mercado_pago_payment_idx', { transaction });
      for (const column of ['mercado_pago_ultimo_evento_em', 'mercado_pago_status', 'mercado_pago_payment_id', 'mercado_pago_preference_id']) {
        await queryInterface.removeColumn('vendas', column, { transaction });
      }
    });
  },
};
