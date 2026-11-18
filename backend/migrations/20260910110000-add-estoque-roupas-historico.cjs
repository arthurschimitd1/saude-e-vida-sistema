'use strict';

module.exports = {
  async up(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS estoque_roupas_movimentos (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          roupa_id INTEGER NOT NULL,
          variacao_id INTEGER NOT NULL,
          usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
          quantidade INTEGER NOT NULL CHECK (quantidade > 0),
          saldo_anterior INTEGER NOT NULL CHECK (saldo_anterior >= 0),
          saldo_posterior INTEGER NOT NULL CHECK (saldo_posterior >= 0),
          motivo VARCHAR(120) NOT NULL,
          origem_tipo VARCHAR(60),
          origem_id INTEGER,
          observacao TEXT,
          data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`, { transaction: t });
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS estoque_roupas_inventarios (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          roupa_id INTEGER NOT NULL,
          variacao_id INTEGER NOT NULL,
          usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          quantidade_sistema INTEGER NOT NULL CHECK (quantidade_sistema >= 0),
          quantidade_contada INTEGER NOT NULL CHECK (quantidade_contada >= 0),
          diferenca INTEGER NOT NULL,
          observacao TEXT,
          data_inventario TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`, { transaction: t });
      await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS estoque_roupas_mov_empresa_data_idx ON estoque_roupas_movimentos (empresa_id, data DESC)', { transaction: t });
      await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS estoque_roupas_mov_variacao_idx ON estoque_roupas_movimentos (empresa_id, variacao_id, data DESC)', { transaction: t });
      await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS estoque_roupas_inv_empresa_data_idx ON estoque_roupas_inventarios (empresa_id, data_inventario DESC)', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS estoque_roupas_inventarios', { transaction: t });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS estoque_roupas_movimentos', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
