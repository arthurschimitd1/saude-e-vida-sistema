'use strict';

const MODULE_ROUTE = '/financeiro/contas-receber';
const PLAN_CODES = ['pacote1', 'pacote2', 'pacote_contador'];

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        'SELECT pg_advisory_xact_lock(hashtext(:lockKey))',
        { replacements: { lockKey: 'lucromais-access-contas-receber-v1' }, transaction }
      );

      await queryInterface.sequelize.query(
        `INSERT INTO access_modules (code, route, label, group_name)
         VALUES ('contas_receber', :route, 'Contas a receber', 'Financeiro')
         ON CONFLICT (route) DO UPDATE
           SET code = EXCLUDED.code,
               label = EXCLUDED.label,
               group_name = EXCLUDED.group_name,
               active = TRUE,
               updated_at = NOW()`,
        { replacements: { route: MODULE_ROUTE }, transaction }
      );

      for (const planCode of PLAN_CODES) {
        const [[plan]] = await queryInterface.sequelize.query(
          'SELECT id FROM access_plans WHERE code = :planCode AND active = TRUE',
          { replacements: { planCode }, transaction }
        );
        if (!plan) continue;

        await queryInterface.sequelize.query(
          `INSERT INTO access_plan_versions (plan_id, version, status)
           VALUES (:planId, 4, 'ACTIVE')
           ON CONFLICT (plan_id, version) DO UPDATE SET status = 'ACTIVE'`,
          { replacements: { planId: plan.id }, transaction }
        );

        await queryInterface.sequelize.query(
          `INSERT INTO access_plan_version_modules (version_id, module_id)
           SELECT current_version.id, pvm.module_id
             FROM access_plan_versions current_version
             JOIN access_plan_versions previous_version
               ON previous_version.plan_id = current_version.plan_id
              AND previous_version.version = 3
             JOIN access_plan_version_modules pvm ON pvm.version_id = previous_version.id
            WHERE current_version.plan_id = :planId
              AND current_version.version = 4
           ON CONFLICT DO NOTHING`,
          { replacements: { planId: plan.id }, transaction }
        );
        await queryInterface.sequelize.query(
          `INSERT INTO access_plan_version_modules (version_id, module_id)
           SELECT apv.id, am.id
             FROM access_plan_versions apv
             CROSS JOIN access_modules am
            WHERE apv.plan_id = :planId
              AND apv.version = 4
              AND am.route = :route
           ON CONFLICT DO NOTHING`,
          { replacements: { planId: plan.id, route: MODULE_ROUTE }, transaction }
        );

        await queryInterface.sequelize.query(
          `UPDATE empresa_access_profiles ep
              SET plan_version_id = apv.id,
                  version = ep.version + 1,
                  updated_at = NOW()
             FROM empresas e
             JOIN access_plan_versions apv
               ON apv.plan_id = :planId AND apv.version = 4 AND apv.status = 'ACTIVE'
            WHERE ep.empresa_id = e.id
              AND e.id = ep.empresa_id
              AND e.pacote = :planCode
              AND ep.policy = 'AUTO_ADD'`,
          { replacements: { planId: plan.id, planCode }, transaction }
        );

        await queryInterface.sequelize.query(
          `UPDATE empresas
              SET permissoes = CASE
                WHEN :route = ANY(COALESCE(permissoes, ARRAY[]::varchar[])) THEN COALESCE(permissoes, ARRAY[]::varchar[])
                ELSE array_append(COALESCE(permissoes, ARRAY[]::varchar[]), :route)
              END
            WHERE pacote = :planCode`,
          { replacements: { route: MODULE_ROUTE, planCode }, transaction }
        );

        await queryInterface.sequelize.query(
          `UPDATE users u
              SET permissoes = CASE
                WHEN :route = ANY(COALESCE(u.permissoes, ARRAY[]::varchar[])) THEN COALESCE(u.permissoes, ARRAY[]::varchar[])
                ELSE array_append(COALESCE(u.permissoes, ARRAY[]::varchar[]), :route)
              END,
                  updated_at = NOW()
             FROM empresas e, user_access_profiles uap
            WHERE u.empresa_id = e.id
              AND uap.user_id = u.id
              AND uap.mode = 'INHERIT_COMPANY'
              AND e.pacote = :planCode`,
          { replacements: { route: MODULE_ROUTE, planCode }, transaction }
        );
      }

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
        `UPDATE empresa_access_profiles ep
            SET plan_version_id = previous_version.id,
                version = ep.version + 1,
                updated_at = NOW()
           FROM empresas e
           JOIN access_plans ap ON ap.code = e.pacote
           JOIN access_plan_versions previous_version
             ON previous_version.plan_id = ap.id AND previous_version.version = 3
          WHERE ep.empresa_id = e.id
            AND ep.policy = 'AUTO_ADD'`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE empresas
            SET permissoes = array_remove(COALESCE(permissoes, ARRAY[]::varchar[]), :route)
          WHERE pacote IN (:planCodes)`,
        { replacements: { route: MODULE_ROUTE, planCodes: PLAN_CODES }, transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE users u
            SET permissoes = array_remove(COALESCE(u.permissoes, ARRAY[]::varchar[]), :route),
                updated_at = NOW()
           FROM empresas e, user_access_profiles uap
          WHERE u.empresa_id = e.id
            AND uap.user_id = u.id
            AND uap.mode = 'INHERIT_COMPANY'
            AND e.pacote IN (:planCodes)`,
        { replacements: { route: MODULE_ROUTE, planCodes: PLAN_CODES }, transaction }
      );
      await queryInterface.sequelize.query(
        `DELETE FROM access_plan_version_modules
          WHERE version_id IN (
            SELECT apv.id FROM access_plan_versions apv
            JOIN access_plans ap ON ap.id = apv.plan_id
            WHERE apv.version = 4 AND ap.code IN (:planCodes)
          )`,
        { replacements: { planCodes: PLAN_CODES }, transaction }
      );
      await queryInterface.sequelize.query(
        `DELETE FROM access_plan_versions apv
          USING access_plans ap
         WHERE apv.plan_id = ap.id AND apv.version = 4 AND ap.code IN (:planCodes)`,
        { replacements: { planCodes: PLAN_CODES }, transaction }
      );
      await queryInterface.sequelize.query(
        'DELETE FROM access_modules WHERE route = :route',
        { replacements: { route: MODULE_ROUTE }, transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
