'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS master_analytics_audit (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        report VARCHAR(160) NOT NULL,
        filters JSONB NOT NULL DEFAULT '{}'::jsonb,
        accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS master_analytics_audit_accessed_at_idx
        ON master_analytics_audit (accessed_at)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS master_analytics_audit_user_date_idx
        ON master_analytics_audit (user_id, accessed_at)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS master_analytics_audit');
  }
};
