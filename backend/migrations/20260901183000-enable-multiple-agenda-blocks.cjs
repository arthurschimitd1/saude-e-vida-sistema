'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901183000-multiplos-bloqueios'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        DO $$
        DECLARE constraint_name TEXT;
        BEGIN
          FOR constraint_name IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = current_schema()
              AND rel.relname = 'agendamento_bloqueios'
              AND con.contype = 'u'
              AND (
                SELECT array_agg(att.attname ORDER BY cols.ordinality)
                FROM unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ordinality)
                JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = cols.attnum
              ) = ARRAY['empresa_id', 'colaborador_id', 'data']::name[]
          LOOP
            EXECUTE format('ALTER TABLE agendamento_bloqueios DROP CONSTRAINT %I', constraint_name);
          END LOOP;
        END $$
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_consulta
        ON agendamento_bloqueios (empresa_id, colaborador_id, data)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamento_bloqueios_recorrentes_excecoes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL,
          colaborador_id INTEGER NOT NULL,
          recorrente_id INTEGER NOT NULL REFERENCES agendamento_bloqueios_recorrentes(id) ON DELETE CASCADE,
          data DATE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (recorrente_id, data)
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_recorrentes_excecoes_consulta
        ON agendamento_bloqueios_recorrentes_excecoes (empresa_id, colaborador_id, data)
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
        'DROP TABLE IF EXISTS agendamento_bloqueios_recorrentes_excecoes',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_agendamento_bloqueios_consulta',
        { transaction },
      );
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM agendamento_bloqueios
            GROUP BY empresa_id, colaborador_id, data
            HAVING COUNT(*) > 1
          ) AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'agendamento_bloqueios'
              AND con.conname = 'agendamento_bloqueios_empresa_id_colaborador_id_data_key'
          ) THEN
            ALTER TABLE agendamento_bloqueios
              ADD CONSTRAINT agendamento_bloqueios_empresa_id_colaborador_id_data_key
              UNIQUE (empresa_id, colaborador_id, data);
          END IF;
        END $$
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
