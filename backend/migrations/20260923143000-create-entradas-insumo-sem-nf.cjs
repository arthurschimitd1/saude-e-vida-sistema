'use strict';

const TABLE = 'entradas_insumo_sem_nf';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'empresas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      raw_material_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'raw_materials', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      produto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      quantidade: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
      preco_unitario: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      preco_anterior: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      estoque_anterior: { type: Sequelize.DECIMAL(12, 3), allowNull: true },
      estoque_posterior: { type: Sequelize.DECIMAL(12, 3), allowNull: true },
      data_entrada: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      observacao: { type: Sequelize.TEXT, allowNull: true },
      origem_tipo: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'entrada_sem_nf' },
      origem_id: { type: Sequelize.INTEGER, allowNull: true },
      documento: { type: Sequelize.STRING(120), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex(TABLE, ['empresa_id', 'produto_id', 'data_entrada'], {
      name: 'entradas_insumo_sem_nf_empresa_produto_data_idx'
    });

    await queryInterface.addIndex(TABLE, ['empresa_id', 'raw_material_id', 'data_entrada'], {
      name: 'entradas_insumo_sem_nf_empresa_material_data_idx'
    });

    // As importações fiscais já existentes também passam a compor a evolução
    // de custo. Para o histórico anterior ao recurso, só o valor unitário e
    // a quantidade são confiáveis; os saldos daquele instante ficam nulos.
    await queryInterface.sequelize.query(`
      INSERT INTO ${TABLE} (
        empresa_id, raw_material_id, produto_id, usuario_id, quantidade,
        preco_unitario, preco_anterior, estoque_anterior, estoque_posterior,
        data_entrada, observacao, origem_tipo, origem_id, documento, "createdAt", "updatedAt"
      )
      SELECT
        fiscal.empresa_id,
        produto.raw_material_id,
        item.product_id,
        fiscal.imported_by,
        item.quantity,
        CASE WHEN COALESCE(item.unit_cost, 0) > 0 THEN item.unit_cost ELSE NULL END,
        NULL,
        NULL,
        NULL,
        COALESCE(fiscal.issued_at, fiscal.imported_at, NOW()),
        CONCAT('Importação fiscal anterior', CASE WHEN fiscal.supplier_name IS NOT NULL AND fiscal.supplier_name <> '' THEN CONCAT(' · ', fiscal.supplier_name) ELSE '' END),
        'nota_fiscal_entrada',
        fiscal.id,
        CONCAT('NF-e ', COALESCE(NULLIF(fiscal.invoice_number, ''), NULLIF(fiscal.access_key, ''), 'sem número')),
        NOW(),
        NOW()
      FROM fiscal_stock_import_items item
      INNER JOIN fiscal_stock_imports fiscal ON fiscal.id = item.import_id
      INNER JOIN "Products" produto ON produto.id = item.product_id
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
