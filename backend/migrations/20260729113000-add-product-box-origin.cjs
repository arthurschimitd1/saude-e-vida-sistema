'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (!table.caixa_origem_id) {
      await queryInterface.addColumn('Products', 'caixa_origem_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "products_empresa_caixa_origem_unique" ON "Products" ("empresa_id", "caixa_origem_id") WHERE "caixa_origem_id" IS NOT NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Products', 'products_empresa_caixa_origem_unique').catch(() => {});
    const table = await queryInterface.describeTable('Products');
    if (table.caixa_origem_id) {
      await queryInterface.removeColumn('Products', 'caixa_origem_id');
    }
  },
};
