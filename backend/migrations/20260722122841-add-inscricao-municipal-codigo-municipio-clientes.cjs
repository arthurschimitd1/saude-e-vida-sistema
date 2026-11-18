'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(30)
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS codigo_municipio VARCHAR(7)
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN clientes.inscricao_municipal IS
      'Inscrição Municipal do cliente/tomador, quando aplicável'
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN clientes.codigo_municipio IS
      'Código IBGE do município do cliente'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
      DROP COLUMN IF EXISTS inscricao_municipal
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
      DROP COLUMN IF EXISTS codigo_municipio
    `);
  },
};