'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS nuvemshop_integracoes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
          store_id BIGINT NOT NULL UNIQUE,
          access_token_encrypted TEXT NOT NULL,
          scopes TEXT,
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
          disconnected_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_nuvemshop_integracoes_empresa_ativo
        ON nuvemshop_integracoes (empresa_id, ativo)`, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nuvemshop_integracoes');
  },
};
