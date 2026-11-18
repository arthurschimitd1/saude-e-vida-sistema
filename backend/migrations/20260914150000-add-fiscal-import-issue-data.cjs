'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('fiscal_stock_imports');
    if (!columns.invoice_number) {
      await queryInterface.addColumn('fiscal_stock_imports', 'invoice_number', {
        type: Sequelize.STRING(50), allowNull: true,
      });
    }
    if (!columns.issued_at) {
      await queryInterface.addColumn('fiscal_stock_imports', 'issued_at', {
        type: Sequelize.DATE, allowNull: true,
      });
    }
    const indexes = await queryInterface.showIndex('fiscal_stock_imports');
    if (!indexes.some((index) => index.name === 'fiscal_stock_imports_empresa_issued_at_idx')) {
      await queryInterface.addIndex('fiscal_stock_imports', ['empresa_id', 'issued_at'], {
        name: 'fiscal_stock_imports_empresa_issued_at_idx',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('fiscal_stock_imports');
    if (indexes.some((index) => index.name === 'fiscal_stock_imports_empresa_issued_at_idx')) {
      await queryInterface.removeIndex('fiscal_stock_imports', 'fiscal_stock_imports_empresa_issued_at_idx');
    }
    const columns = await queryInterface.describeTable('fiscal_stock_imports');
    if (columns.issued_at) await queryInterface.removeColumn('fiscal_stock_imports', 'issued_at');
    if (columns.invoice_number) await queryInterface.removeColumn('fiscal_stock_imports', 'invoice_number');
  },
};
