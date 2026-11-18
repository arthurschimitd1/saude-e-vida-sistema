'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
        ADD COLUMN IF NOT EXISTS loja_senha_hash TEXT,
        ADD COLUMN IF NOT EXISTS loja_ultimo_login TIMESTAMPTZ
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_clientes_loja_empresa_email
      ON clientes (empresa_id, lower(email))
      WHERE email IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE vendas
        ADD COLUMN IF NOT EXISTS status_loja_atualizado_em TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS status_loja_historico JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryInterface.sequelize.query(`
      UPDATE vendas
      SET status_loja_atualizado_em = COALESCE(status_loja_atualizado_em, "updatedAt", data),
          status_loja_historico = CASE
            WHEN status_loja IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(jsonb_build_object(
              'status', status_loja,
              'em', COALESCE("updatedAt", data, NOW()),
              'origem', 'legado'
            ))
          END
      WHERE origem = 'loja_online'
        AND (status_loja_atualizado_em IS NULL OR status_loja_historico = '[]'::jsonb)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vendas_loja_online_status_updated
      ON vendas (empresa_id, status_loja, status_loja_atualizado_em DESC)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_vendas_loja_online_status_updated');
    await queryInterface.sequelize.query('ALTER TABLE vendas DROP COLUMN IF EXISTS status_loja_historico, DROP COLUMN IF EXISTS status_loja_atualizado_em');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_clientes_loja_empresa_email');
    await queryInterface.sequelize.query('ALTER TABLE clientes DROP COLUMN IF EXISTS loja_ultimo_login, DROP COLUMN IF EXISTS loja_senha_hash');
  },
};
