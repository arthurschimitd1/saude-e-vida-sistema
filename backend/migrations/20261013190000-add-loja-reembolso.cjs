const { Sequelize } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable('vendas');
    const additions = [
      ['mercado_pago_reembolso_id', { type: Sequelize.STRING(120), allowNull: true }],
      ['mercado_pago_reembolso_status', { type: Sequelize.STRING(40), allowNull: true }],
      ['mercado_pago_reembolsado_em', { type: Sequelize.DATE, allowNull: true }],
    ];
    for (const [name, definition] of additions) {
      if (!columns[name]) await queryInterface.addColumn('vendas', name, definition);
    }
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS vendas_mercado_pago_reembolso_status_idx ON vendas (empresa_id, mercado_pago_reembolso_status)'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS vendas_mercado_pago_reembolso_status_idx');
    for (const name of ['mercado_pago_reembolsado_em', 'mercado_pago_reembolso_status', 'mercado_pago_reembolso_id']) {
      await queryInterface.removeColumn('vendas', name).catch(() => {});
    }
  },
};
