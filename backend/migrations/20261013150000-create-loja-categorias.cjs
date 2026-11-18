module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loja_categorias', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      nome: { type: Sequelize.STRING(120), allowNull: false },
      slug: { type: Sequelize.STRING(140), allowNull: false },
      ordem: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('loja_categorias', ['empresa_id', 'nome'], { unique: true, name: 'uq_loja_categorias_empresa_nome' });
    await queryInterface.addIndex('loja_categorias', ['empresa_id', 'slug'], { unique: true, name: 'uq_loja_categorias_empresa_slug' });
    await queryInterface.addIndex('loja_categorias', ['empresa_id', 'ativo', 'ordem'], { name: 'idx_loja_categorias_empresa_ativo_ordem' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('loja_categorias', 'idx_loja_categorias_empresa_ativo_ordem');
    await queryInterface.removeIndex('loja_categorias', 'uq_loja_categorias_empresa_slug');
    await queryInterface.removeIndex('loja_categorias', 'uq_loja_categorias_empresa_nome');
    await queryInterface.dropTable('loja_categorias');
  },
};
