'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('fiscal_stock_imports');
    if (!columns.supplier_snapshot) {
      await queryInterface.addColumn('fiscal_stock_imports', 'supplier_snapshot', {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('fiscal_stock_imports');
    if (columns.supplier_snapshot) {
      await queryInterface.removeColumn('fiscal_stock_imports', 'supplier_snapshot');
    }
  }
};
