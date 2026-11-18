'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('fiscal_stock_imports', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'empresas', key: 'id' },
          onDelete: 'CASCADE'
        },
        source_hash: { type: Sequelize.STRING(64), allowNull: false },
        access_key: { type: Sequelize.STRING(64), allowNull: true },
        source_type: { type: Sequelize.STRING(30), allowNull: false },
        supplier_document: { type: Sequelize.STRING(20), allowNull: true },
        supplier_name: { type: Sequelize.STRING(255), allowNull: true },
        imported_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL'
        },
        imported_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.addIndex('fiscal_stock_imports', ['empresa_id', 'source_hash'], {
        unique: true,
        name: 'fiscal_stock_imports_company_hash_unique',
        transaction
      });
      await queryInterface.addIndex('fiscal_stock_imports', ['empresa_id', 'access_key'], {
        unique: true,
        where: { access_key: { [Sequelize.Op.ne]: null } },
        name: 'fiscal_stock_imports_company_access_key_unique',
        transaction
      });

      await queryInterface.createTable('fiscal_product_mappings', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'empresas', key: 'id' },
          onDelete: 'CASCADE'
        },
        supplier_document: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '' },
        external_key: { type: Sequelize.STRING(255), allowNull: false },
        external_code: { type: Sequelize.STRING(100), allowNull: true },
        last_description: { type: Sequelize.STRING(500), allowNull: true },
        product_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Products', key: 'id' },
          onDelete: 'CASCADE'
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await queryInterface.addIndex(
        'fiscal_product_mappings',
        ['empresa_id', 'supplier_document', 'external_key'],
        {
          unique: true,
          name: 'fiscal_product_mappings_source_unique',
          transaction
        }
      );

      await queryInterface.createTable('fiscal_stock_import_items', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        import_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'fiscal_stock_imports', key: 'id' },
          onDelete: 'CASCADE'
        },
        product_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Products', key: 'id' },
          onDelete: 'RESTRICT'
        },
        external_code: { type: Sequelize.STRING(100), allowNull: true },
        description: { type: Sequelize.STRING(500), allowNull: false },
        quantity: { type: Sequelize.DECIMAL(14, 3), allowNull: false },
        unit_cost: { type: Sequelize.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
        action: { type: Sequelize.STRING(20), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('fiscal_stock_import_items', { transaction });
      await queryInterface.dropTable('fiscal_product_mappings', { transaction });
      await queryInterface.dropTable('fiscal_stock_imports', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
