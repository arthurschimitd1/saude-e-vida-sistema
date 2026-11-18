'use strict';

const migrationKey = 'lucromais:20260921123000-add-sale-origin-to-nfse';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        ALTER TABLE notas_fiscais_servico_emitidas
          ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_nfse_empresa_venda
          ON notas_fiscais_servico_emitidas (empresa_id, venda_id)
          WHERE venda_id IS NOT NULL
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
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_nfse_empresa_venda',
        { transaction },
      );
      await queryInterface.sequelize.query(`
        ALTER TABLE notas_fiscais_servico_emitidas
          DROP COLUMN IF EXISTS venda_id,
          DROP COLUMN IF EXISTS cliente_id
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
