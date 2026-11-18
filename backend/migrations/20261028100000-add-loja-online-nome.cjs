'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Products"
        ADD COLUMN IF NOT EXISTS loja_online_nome VARCHAR(200)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE "Products" DROP COLUMN IF EXISTS loja_online_nome');
  },
};
