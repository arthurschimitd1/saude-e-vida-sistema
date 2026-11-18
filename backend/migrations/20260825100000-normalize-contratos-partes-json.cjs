'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // A migration histórica converteu a coluna em algumas bases, mas o
      // rollout não era uniforme. A conversão usa to_jsonb(text), portanto
      // também é segura para valores antigos que não eram JSON válido.
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_name = 'contratos'
               AND column_name = 'partes_envolvidas'
               AND udt_name <> 'jsonb'
          ) THEN
            ALTER TABLE contratos
              ALTER COLUMN partes_envolvidas TYPE JSONB
              USING to_jsonb(partes_envolvidas);
          END IF;
        END $$;
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
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_name = 'contratos'
               AND column_name = 'partes_envolvidas'
               AND udt_name = 'jsonb'
          ) THEN
            ALTER TABLE contratos
              ALTER COLUMN partes_envolvidas TYPE VARCHAR(255)
              USING partes_envolvidas #>> '{}';
          END IF;
        END $$;
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
