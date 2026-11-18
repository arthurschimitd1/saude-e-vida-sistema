'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260904103000-encaixe-forcado'))`,
        { transaction },
      );
      await queryInterface.sequelize.query(`
        ALTER TABLE agendamentos
        ADD COLUMN IF NOT EXISTS encaixe_forcado BOOLEAN NOT NULL DEFAULT FALSE
      `, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE agendamentos
           SET encaixe_forcado = TRUE
         WHERE encaixe_forcado = FALSE
           AND jsonb_typeof(COALESCE(historico, '[]'::jsonb)) = 'array'
           AND EXISTS (
             SELECT 1
               FROM jsonb_array_elements(COALESCE(historico, '[]'::jsonb)) AS evento
              WHERE COALESCE(evento->>'acao', '') ILIKE 'Encaixe forçado por%'
           )
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE agendamentos DROP COLUMN IF EXISTS encaixe_forcado',
    );
  },
};
