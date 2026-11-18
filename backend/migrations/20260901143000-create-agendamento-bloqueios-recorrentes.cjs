'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901143000-bloqueios-recorrentes'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamento_bloqueios_recorrentes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL,
          colaborador_id INTEGER NOT NULL,
          data_inicio DATE NOT NULL,
          data_fim DATE,
          dias_semana JSONB NOT NULL DEFAULT '[]'::jsonb,
          hora_inicio TIME,
          hora_fim TIME,
          motivo VARCHAR(300),
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_recorrentes_consulta
        ON agendamento_bloqueios_recorrentes
          (empresa_id, colaborador_id, data_inicio, data_fim)
        WHERE ativo = TRUE
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agendamento_bloqueios_recorrentes');
  },
};
