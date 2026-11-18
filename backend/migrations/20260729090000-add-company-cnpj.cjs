'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('empresas');
    if (!table.cnpj) {
      await queryInterface.addColumn('empresas', 'cnpj', {
        type: Sequelize.STRING(18),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('empresas');
    if (table.cnpj) {
      await queryInterface.removeColumn('empresas', 'cnpj');
    }
  }
};
