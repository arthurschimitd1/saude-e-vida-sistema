'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // SQL idempotente: a aplicação também prepara esse rollout em runtime,
      // então a migration precisa funcionar em bases parcialmente atualizadas.
      await queryInterface.sequelize.query(`
        ALTER TABLE movimentos
          ADD COLUMN IF NOT EXISTS tipo_movimento VARCHAR(40)
      `, { transaction });

      // Classifica registros históricos que já eram gravados pelo fluxo de produção.
      // O filtro mantém a empresa e a ordem originais; nenhum estoque é recalculado.
      await queryInterface.sequelize.query(`
        UPDATE movimentos
           SET tipo_movimento = 'DESPERDICIO'
         WHERE tipo_movimento IS NULL
           AND origem_tipo = 'producao'
           AND motivo ILIKE 'Desperdício %'
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS movimentos_empresa_tipo_data_idx
          ON movimentos (empresa_id, tipo_movimento, data)
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS movimentos_empresa_origem_data_idx
          ON movimentos (empresa_id, origem_tipo, data)
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
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS movimentos_empresa_tipo_data_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS movimentos_empresa_origem_data_idx', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE movimentos DROP COLUMN IF EXISTS tipo_movimento', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
