'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'loja_online_configurado', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "loja_online_configurado" = TRUE
      WHERE "loja_online_ativo" = TRUE
         OR "loja_online_categoria" IS NOT NULL
         OR "loja_online_nome" IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'loja_online_configurado');
  },
};
