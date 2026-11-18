'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vendas');
    if (!table.cst_csosn) {
      await queryInterface.addColumn('vendas', 'cst_csosn', {
        type: Sequelize.STRING(3),
        allowNull: true,
        comment: 'CST/CSOSN opcional da venda; quando informado, substitui o CST/CSOSN dos produtos na emissão fiscal'
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('vendas');
    if (table.cst_csosn) await queryInterface.removeColumn('vendas', 'cst_csosn');
  }
};
