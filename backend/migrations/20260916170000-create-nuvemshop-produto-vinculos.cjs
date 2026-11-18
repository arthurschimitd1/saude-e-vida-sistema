'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE nuvemshop_integracoes
          ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS last_sync_direction VARCHAR(20),
          ADD COLUMN IF NOT EXISTS last_sync_summary JSONB,
          ADD COLUMN IF NOT EXISTS last_sync_error TEXT
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS nuvemshop_produto_vinculos (
          id SERIAL PRIMARY KEY,
          integracao_id INTEGER NOT NULL REFERENCES nuvemshop_integracoes(id) ON DELETE CASCADE,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          roupa_id INTEGER REFERENCES estoque_roupas(id) ON DELETE CASCADE,
          variacao_id INTEGER REFERENCES estoque_roupas_variacoes(id) ON DELETE SET NULL,
          nuvemshop_product_id BIGINT NOT NULL,
          nuvemshop_variant_id BIGINT NOT NULL,
          nuvemshop_sku VARCHAR(255),
          tamanho VARCHAR(255) NOT NULL DEFAULT 'Único',
          cor VARCHAR(500),
          stock_management BOOLEAN NOT NULL DEFAULT FALSE,
          inventory_levels JSONB,
          last_remote_stock INTEGER,
          last_local_stock INTEGER,
          last_synced_at TIMESTAMP,
          last_error TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (integracao_id, nuvemshop_variant_id)
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_nuvemshop_vinculo_variacao
          ON nuvemshop_produto_vinculos (empresa_id, variacao_id)
          WHERE variacao_id IS NOT NULL
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_nuvemshop_vinculo_produto
          ON nuvemshop_produto_vinculos (integracao_id, nuvemshop_product_id)
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
      await queryInterface.dropTable('nuvemshop_produto_vinculos', { transaction });
      await queryInterface.removeColumn('nuvemshop_integracoes', 'last_sync_error', { transaction });
      await queryInterface.removeColumn('nuvemshop_integracoes', 'last_sync_summary', { transaction });
      await queryInterface.removeColumn('nuvemshop_integracoes', 'last_sync_direction', { transaction });
      await queryInterface.removeColumn('nuvemshop_integracoes', 'last_sync_at', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
