'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('recorrencias');
    if (!columns.servicos_inclusos) {
      await queryInterface.addColumn('recorrencias', 'servicos_inclusos', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('recorrencias');
    if (columns.servicos_inclusos) await queryInterface.removeColumn('recorrencias', 'servicos_inclusos');
  }
};
