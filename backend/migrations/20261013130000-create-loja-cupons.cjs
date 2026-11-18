module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loja_cupons', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      codigo: { type: Sequelize.STRING(40), allowNull: false },
      titulo: { type: Sequelize.STRING(120), allowNull: false },
      tipo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'percentual' },
      valor: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      validade_inicio: { type: Sequelize.DATE, allowNull: true },
      validade_fim: { type: Sequelize.DATE, allowNull: true },
      limite_uso: { type: Sequelize.INTEGER, allowNull: true },
      usos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      mensagem: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('loja_cupons', ['empresa_id', 'codigo'], { unique: true, name: 'uq_loja_cupons_empresa_codigo' });
    await queryInterface.addIndex('loja_cupons', ['empresa_id', 'ativo'], { name: 'idx_loja_cupons_empresa_ativo' });

    await queryInterface.createTable('loja_cupom_envios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      cupom_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'loja_cupons', key: 'id' }, onDelete: 'CASCADE' },
      cliente_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'clientes', key: 'id' }, onDelete: 'CASCADE' },
      telefone: { type: Sequelize.STRING(30), allowNull: false },
      mensagem: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pendente' },
      enviado_em: { type: Sequelize.DATE, allowNull: true },
      erro: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('loja_cupom_envios', ['empresa_id', 'cupom_id'], { name: 'idx_loja_cupom_envios_empresa_cupom' });

    await queryInterface.addColumn('vendas', 'loja_cupom_id', { type: Sequelize.INTEGER, allowNull: true, references: { model: 'loja_cupons', key: 'id' }, onDelete: 'SET NULL' });
    await queryInterface.addColumn('vendas', 'loja_cupom_codigo', { type: Sequelize.STRING(40), allowNull: true });
    await queryInterface.addIndex('vendas', ['empresa_id', 'loja_cupom_id'], { name: 'idx_vendas_loja_cupom' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('vendas', 'idx_vendas_loja_cupom');
    await queryInterface.removeColumn('vendas', 'loja_cupom_codigo');
    await queryInterface.removeColumn('vendas', 'loja_cupom_id');
    await queryInterface.dropTable('loja_cupom_envios');
    await queryInterface.dropTable('loja_cupons');
  },
};
