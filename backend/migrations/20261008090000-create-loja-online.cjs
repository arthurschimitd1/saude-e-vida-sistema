'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE vendas
        ADD COLUMN IF NOT EXISTS origem VARCHAR(30) NOT NULL DEFAULT 'caixa',
        ADD COLUMN IF NOT EXISTS status_loja VARCHAR(30)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Products"
        ADD COLUMN IF NOT EXISTS loja_online_ativo BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS loja_online_preco DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS loja_online_categoria VARCHAR(120),
        ADD COLUMN IF NOT EXISTS loja_online_descricao TEXT,
        ADD COLUMN IF NOT EXISTS loja_online_foto_url TEXT,
        ADD COLUMN IF NOT EXISTS loja_online_foto_public_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS loja_online_secoes JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS loja_online_ordem INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS loja_online_destaque BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS loja_online_promocao BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS loja_online_preco_original DECIMAL(10,2)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vendas_loja_online
      ON vendas (empresa_id, origem, status_loja, "createdAt" DESC)
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO access_modules (code, route, label, group_name)
      VALUES
        ('loja_online', '/loja/gestao', 'Lojinha online', 'Comercial'),
        ('loja_online_configuracao', '/loja/configuracao', 'Configurar lojinha', 'Comercial')
      ON CONFLICT (route) DO NOTHING
    `).catch(() => {});
    await queryInterface.sequelize.query(`
      INSERT INTO access_plan_version_modules (version_id, module_id)
      SELECT apv.id, am.id
      FROM access_plan_versions apv
      JOIN access_plans ap ON ap.id = apv.plan_id AND ap.active = TRUE
      JOIN access_modules am ON am.route IN ('/loja/gestao', '/loja/configuracao') AND am.active = TRUE
      WHERE apv.status = 'ACTIVE'
      ON CONFLICT (version_id, module_id) DO NOTHING
    `).catch(() => {});
    await queryInterface.sequelize.query(`
      UPDATE empresas
      SET permissoes = ARRAY(
        SELECT DISTINCT unnest(COALESCE(permissoes, ARRAY[]::varchar[]) || ARRAY['/loja/gestao', '/loja/configuracao']::varchar[])
      )
      WHERE pacote IN ('pacote1', 'pacote2', 'pacote_contador')
    `).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM access_plan_version_modules
      WHERE module_id IN (SELECT id FROM access_modules WHERE route IN ('/loja/gestao', '/loja/configuracao'))
    `).catch(() => {});
    await queryInterface.sequelize.query("DELETE FROM access_modules WHERE route IN ('/loja/gestao', '/loja/configuracao')").catch(() => {});
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_vendas_loja_online');
    await queryInterface.sequelize.query('ALTER TABLE vendas DROP COLUMN IF EXISTS status_loja, DROP COLUMN IF EXISTS origem');
  },
};
