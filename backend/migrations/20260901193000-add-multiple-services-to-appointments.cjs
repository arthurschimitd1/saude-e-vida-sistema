'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901193000-multiplos-servicos-agenda'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        ALTER TABLE agendamentos
        ADD COLUMN IF NOT EXISTS servicos JSONB NOT NULL DEFAULT '[]'::jsonb
      `, { transaction });

      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS uq_venda_itens_agendamento_servico',
        { transaction },
      );

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_venda_itens_agendamento_servico
        ON venda_itens (agendamento_id, agendamento_servico_id)
        WHERE agendamento_id IS NOT NULL AND agendamento_servico_id IS NOT NULL
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
        'DROP INDEX IF EXISTS uq_venda_itens_agendamento_servico',
        { transaction },
      );
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM venda_itens
            WHERE agendamento_id IS NOT NULL
            GROUP BY agendamento_id
            HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION 'Não é possível reverter múltiplos serviços: existem agendamentos com mais de um item vendido';
          END IF;
        END $$
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_venda_itens_agendamento_servico
        ON venda_itens (agendamento_id)
        WHERE agendamento_id IS NOT NULL
      `, { transaction });
      await queryInterface.sequelize.query(
        'ALTER TABLE agendamentos DROP COLUMN IF EXISTS servicos',
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
