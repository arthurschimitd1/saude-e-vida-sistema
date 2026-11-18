module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_granel BOOLEAN NOT NULL DEFAULT false');
    await queryInterface.sequelize.query('ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_preco_kg DECIMAL(10,2)');
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'loja_online_preco_kg');
    await queryInterface.removeColumn('Products', 'loja_online_granel');
  },
};
