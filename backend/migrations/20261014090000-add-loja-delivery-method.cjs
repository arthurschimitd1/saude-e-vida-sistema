const { Sequelize } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable('vendas');
    if (!columns.forma_entrega) {
      await queryInterface.addColumn('vendas', 'forma_entrega', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'retirada',
        comment: 'Forma de recebimento do pedido online: entrega ou retirada'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('vendas', 'forma_entrega').catch(() => {});
  },
};
