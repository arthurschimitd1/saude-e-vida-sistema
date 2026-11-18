'use strict';

const migrationKey = 'lucromais:20260908120000-classify-production-excess';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );

      // Campos novos e opcionais: nenhuma venda, produção ou movimentação
      // histórica é alterada. Registros antigos continuam sendo tratados como
      // desperdício real quando não possuem classificação.
      await queryInterface.sequelize.query(`
        ALTER TABLE ordens_producao
          ADD COLUMN IF NOT EXISTS classificacao_desperdicio VARCHAR(40),
          ADD COLUMN IF NOT EXISTS observacao_desperdicio TEXT
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE movimentos
          ADD COLUMN IF NOT EXISTS classificacao_desperdicio VARCHAR(40),
          ADD COLUMN IF NOT EXISTS observacao_desperdicio TEXT
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS movimentos_producao_classificacao_idx
          ON movimentos (empresa_id, origem_tipo, classificacao_desperdicio, data)
          WHERE origem_tipo = 'producao'
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
        'DROP INDEX IF EXISTS movimentos_producao_classificacao_idx',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE movimentos DROP COLUMN IF EXISTS observacao_desperdicio, DROP COLUMN IF EXISTS classificacao_desperdicio',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE ordens_producao DROP COLUMN IF EXISTS observacao_desperdicio, DROP COLUMN IF EXISTS classificacao_desperdicio',
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
