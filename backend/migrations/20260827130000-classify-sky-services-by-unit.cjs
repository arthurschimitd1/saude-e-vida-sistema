'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260827130000-classify-sky-services-by-unit'))`,
        { transaction },
      );

      // O catálogo legado da Sky foi replicado como ativo em todas as unidades.
      // Esta normalização separa somente os registros já existentes: serviços
      // cujo nome contém "Suzane" ficam na unidade Suzane; os demais, na
      // unidade principal. Preços e durações específicos são preservados.
      await queryInterface.sequelize.query(
        `WITH sky AS (
           SELECT id AS empresa_id
             FROM empresas
            WHERE LOWER(TRIM(nome)) = 'sky barbearia'
         ), unidades_sky AS (
           SELECT u.id AS unidade_id,
                  u.empresa_id,
                  CASE
                    WHEN LOWER(u.nome) LIKE '%suzane%' THEN 'suzane'
                    WHEN u.principal = true THEN 'principal'
                    ELSE NULL
                  END AS tipo
             FROM agendamento_unidades u
             JOIN sky ON sky.empresa_id = u.empresa_id
            WHERE u.ativa = true
         )
         UPDATE agendamento_servico_unidades su
            SET ativo = CASE
                  WHEN LOWER(s.nome) LIKE '%suzane%' THEN unidades_sky.tipo = 'suzane'
                  ELSE unidades_sky.tipo = 'principal'
                END,
                updated_at = NOW()
           FROM agendamento_servicos s,
                unidades_sky
          WHERE su.empresa_id = s.empresa_id
            AND su.servico_id = s.id
            AND su.empresa_id = unidades_sky.empresa_id
            AND su.unidade_id = unidades_sky.unidade_id
            AND unidades_sky.tipo IS NOT NULL`,
        { transaction },
      );

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
        `UPDATE agendamento_servico_unidades su
            SET ativo = true,
                updated_at = NOW()
           FROM empresas e,
                agendamento_unidades u
          WHERE LOWER(TRIM(e.nome)) = 'sky barbearia'
            AND u.empresa_id = e.id
            AND u.id = su.unidade_id
            AND su.empresa_id = e.id
            AND (u.principal = true OR LOWER(u.nome) LIKE '%suzane%')`,
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
