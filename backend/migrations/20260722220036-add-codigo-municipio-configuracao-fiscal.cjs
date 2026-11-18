'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE configuracao_fiscal
      ADD COLUMN IF NOT EXISTS codigo_municipio VARCHAR(7)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE configuracao_fiscal
      DROP COLUMN IF EXISTS codigo_municipio
    `);
  },
};