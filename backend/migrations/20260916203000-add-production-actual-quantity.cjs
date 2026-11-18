'use strict';

const migrationKey = 'lucromais:20260916203000-add-production-actual-quantity';

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
          ADD COLUMN IF NOT EXISTS quantidade_produzida DECIMAL(10,3)
      `, { transaction });

      // Para ordens antigas, a fonte confiável é a entrada efetivamente lançada
      // no estoque. Ajustes manuais posteriores continuam separados na auditoria.
      await queryInterface.sequelize.query(`
        UPDATE ordens_producao AS ordem
           SET quantidade_produzida = producao.quantidade
          FROM (
            SELECT origem_id, SUM(quantidade) AS quantidade
              FROM movimentos
             WHERE origem_tipo = 'producao'
               AND tipo = 'entrada'
               AND quantidade > 0
             GROUP BY origem_id
          ) AS producao
         WHERE ordem.id = producao.origem_id
           AND ordem.status = 'concluida'
           AND ordem.quantidade_produzida IS NULL
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
        'ALTER TABLE ordens_producao DROP COLUMN IF EXISTS quantidade_produzida',
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
