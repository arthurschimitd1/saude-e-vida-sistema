'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(`ALTER TABLE saidas
        ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20),
        ADD COLUMN IF NOT EXISTS turno_id INTEGER`, { transaction });
      await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS saidas_empresa_turno_idx ON saidas (empresa_id, turno_id)', { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS saidas_empresa_turno_idx', { transaction });
      await queryInterface.removeColumn('saidas', 'forma_pagamento', { transaction });
      await queryInterface.removeColumn('saidas', 'turno_id', { transaction });
    });
  },
};
