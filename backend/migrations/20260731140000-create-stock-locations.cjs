'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('stock_locations', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'empresas', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        nome: { type: Sequelize.STRING(120), allowNull: false },
        tipo: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'filial' },
        endereco: { type: Sequelize.STRING(255), allowNull: true },
        principal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }, { transaction });

      await queryInterface.addIndex('stock_locations', ['empresa_id', 'nome'], {
        unique: true, name: 'stock_locations_empresa_nome_unique', transaction
      });
      await queryInterface.addIndex('stock_locations', ['empresa_id'], {
        unique: true,
        where: { principal: true },
        name: 'stock_locations_empresa_principal_unique',
        transaction
      });

      await queryInterface.createTable('product_location_stocks', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        produto_id: {
          type: Sequelize.INTEGER, allowNull: false,
          references: { model: 'Products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
        },
        unidade_id: {
          type: Sequelize.INTEGER, allowNull: false,
          references: { model: 'stock_locations', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
        },
        quantidade: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }, { transaction });
      await queryInterface.addIndex('product_location_stocks', ['produto_id', 'unidade_id'], {
        unique: true, name: 'product_location_stocks_product_location_unique', transaction
      });

      await queryInterface.createTable('stock_transfers', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' } },
        produto_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Products', key: 'id' } },
        unidade_origem_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'stock_locations', key: 'id' } },
        unidade_destino_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'stock_locations', key: 'id' } },
        usuario_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
        quantidade: { type: Sequelize.DECIMAL(14, 3), allowNull: false },
        observacao: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO stock_locations (empresa_id, nome, tipo, principal, ativo, created_at, updated_at)
        SELECT id, 'Unidade principal', 'matriz', true, true, NOW(), NOW() FROM empresas
        ON CONFLICT DO NOTHING
      `, { transaction });
      await queryInterface.sequelize.query(`
        INSERT INTO product_location_stocks (produto_id, unidade_id, quantidade, created_at, updated_at)
        SELECT p.id, l.id, COALESCE(p."currentQuantity", 0), NOW(), NOW()
        FROM "Products" p
        JOIN stock_locations l ON l.empresa_id = p.empresa_id AND l.principal = true
        ON CONFLICT DO NOTHING
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('stock_transfers', { transaction });
      await queryInterface.dropTable('product_location_stocks', { transaction });
      await queryInterface.dropTable('stock_locations', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
