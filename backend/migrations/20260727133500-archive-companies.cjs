'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('empresas');
    if (!table.arquivada_em) {
      await queryInterface.addColumn('empresas', 'arquivada_em', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('empresas');
    if (table.arquivada_em) {
      await queryInterface.removeColumn('empresas', 'arquivada_em');
    }
  }
};
