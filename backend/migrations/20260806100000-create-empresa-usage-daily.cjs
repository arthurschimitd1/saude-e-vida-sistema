'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS empresa_usage_daily (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
        usage_date DATE NOT NULL,
        route VARCHAR(180) NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 0,
        last_visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS empresa_usage_daily_empresa_date_route_unique
        ON empresa_usage_daily (empresa_id, usage_date, route)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS empresa_usage_daily_empresa_date_idx
        ON empresa_usage_daily (empresa_id, usage_date)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS empresa_usage_daily');
  }
};
