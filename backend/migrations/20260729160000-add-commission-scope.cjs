'use strict';

const FLAG = 'comissoes:todos';
const ROUTE = '/uikit/comissoes';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `UPDATE users
         SET permissoes = array_append(COALESCE(permissoes, ARRAY[]::varchar[]), :flag),
             updated_at = NOW()
         WHERE :route = ANY(COALESCE(permissoes, ARRAY[]::varchar[]))
           AND NOT (:flag = ANY(COALESCE(permissoes, ARRAY[]::varchar[])))`,
        { replacements: { flag: FLAG, route: ROUTE }, transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE user_access_profiles up
         SET legacy_permissions_snapshot = array_append(
               COALESCE(up.legacy_permissions_snapshot, ARRAY[]::varchar[]),
               :flag
             ),
             updated_at = NOW()
         FROM users u
         WHERE u.id = up.user_id
           AND :route = ANY(COALESCE(u.permissoes, ARRAY[]::varchar[]))
           AND NOT (:flag = ANY(COALESCE(up.legacy_permissions_snapshot, ARRAY[]::varchar[])))`,
        { replacements: { flag: FLAG, route: ROUTE }, transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE empresas e
         SET cargos = roles.updated_roles
         FROM (
           SELECT id,
                  COALESCE(jsonb_agg(
                    CASE
                      WHEN COALESCE(role->'permissoes', '[]'::jsonb)
                             @> jsonb_build_array(CAST(:route AS text))
                       AND NOT (
                         COALESCE(role->'permissoes', '[]'::jsonb)
                           @> jsonb_build_array(CAST(:flag AS text))
                       )
                      THEN jsonb_set(
                        role,
                        '{permissoes}',
                        COALESCE(role->'permissoes', '[]'::jsonb)
                          || jsonb_build_array(CAST(:flag AS text))
                      )
                      ELSE role
                    END
                    ORDER BY role_index
                  ), '[]'::jsonb) AS updated_roles
           FROM empresas
           CROSS JOIN LATERAL jsonb_array_elements(
             CASE WHEN jsonb_typeof(cargos) = 'array' THEN cargos ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS items(role, role_index)
           GROUP BY id
         ) roles
         WHERE e.id = roles.id`,
        { replacements: { flag: FLAG, route: ROUTE }, transaction }
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
        `UPDATE users
         SET permissoes = array_remove(COALESCE(permissoes, ARRAY[]::varchar[]), :flag),
             updated_at = NOW()
         WHERE :flag = ANY(COALESCE(permissoes, ARRAY[]::varchar[]))`,
        { replacements: { flag: FLAG }, transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE user_access_profiles
         SET legacy_permissions_snapshot = array_remove(
               COALESCE(legacy_permissions_snapshot, ARRAY[]::varchar[]),
               :flag
             ),
             updated_at = NOW()
         WHERE :flag = ANY(COALESCE(legacy_permissions_snapshot, ARRAY[]::varchar[]))`,
        { replacements: { flag: FLAG }, transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE empresas e
         SET cargos = roles.updated_roles
         FROM (
           SELECT id,
                  COALESCE(jsonb_agg(
                    CASE
                      WHEN COALESCE(role->'permissoes', '[]'::jsonb)
                             @> jsonb_build_array(CAST(:flag AS text))
                      THEN jsonb_set(
                        role,
                        '{permissoes}',
                        COALESCE(role->'permissoes', '[]'::jsonb)
                          - CAST(:flag AS text)
                      )
                      ELSE role
                    END
                    ORDER BY role_index
                  ), '[]'::jsonb) AS updated_roles
           FROM empresas
           CROSS JOIN LATERAL jsonb_array_elements(
             CASE WHEN jsonb_typeof(cargos) = 'array' THEN cargos ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS items(role, role_index)
           GROUP BY id
         ) roles
         WHERE e.id = roles.id`,
        { replacements: { flag: FLAG }, transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
