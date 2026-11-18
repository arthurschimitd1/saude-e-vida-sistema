'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE user_access_profiles up
       SET mode = 'LEGACY_EXPLICIT', updated_at = NOW()
       FROM users u
       WHERE u.id = up.user_id
         AND up.mode = 'EXPLICIT'
         AND ARRAY(
           SELECT DISTINCT value::text
           FROM unnest(COALESCE(u.permissoes, ARRAY[]::varchar[])) value
           ORDER BY value::text
         ) = ARRAY(
           SELECT DISTINCT value::text
           FROM unnest(COALESCE(up.legacy_permissions_snapshot, ARRAY[]::varchar[])) value
           ORDER BY value::text
         )`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE user_access_profiles
       SET mode = 'EXPLICIT', updated_at = NOW()
       WHERE mode = 'LEGACY_EXPLICIT'`
    );
  }
};
