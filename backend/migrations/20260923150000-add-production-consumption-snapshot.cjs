'use strict';

const migrationKey = 'lucromais:20260923150000-add-production-consumption-snapshot';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );
      await queryInterface.sequelize.query(`
        ALTER TABLE ordens_producao
          ADD COLUMN IF NOT EXISTS itens_consumidos JSONB
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
        'ALTER TABLE ordens_producao DROP COLUMN IF EXISTS itens_consumidos',
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
