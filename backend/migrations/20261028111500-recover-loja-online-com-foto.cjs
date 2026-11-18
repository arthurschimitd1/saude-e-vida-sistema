'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "loja_online_configurado" = TRUE
      WHERE "loja_online_foto_url" IS NOT NULL
    `);
  },

  async down() {},
};
