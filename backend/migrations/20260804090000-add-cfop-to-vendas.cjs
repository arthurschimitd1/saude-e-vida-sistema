'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vendas');

    if (!table.cfop) {
      await queryInterface.addColumn('vendas', 'cfop', {
        type: Sequelize.STRING(4),
        allowNull: true,
        comment: 'CFOP opcional da venda; substitui o CFOP dos produtos na emissão fiscal'
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('vendas');

    if (table.cfop) {
      await queryInterface.removeColumn('vendas', 'cfop');
    }
  }
};
