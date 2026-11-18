'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('estoque_roupas_variacoes');
    if (!columns.estoque_infinito) {
      await queryInterface.addColumn('estoque_roupas_variacoes', 'estoque_infinito', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    await queryInterface.sequelize.query(`
      UPDATE estoque_roupas_variacoes AS variacao
      SET estoque_infinito = TRUE
      FROM nuvemshop_produto_vinculos AS vinculo
      WHERE vinculo.variacao_id = variacao.id
        AND vinculo.stock_management = FALSE
    `);
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('estoque_roupas_variacoes');
    if (columns.estoque_infinito) await queryInterface.removeColumn('estoque_roupas_variacoes', 'estoque_infinito');
  },
};
