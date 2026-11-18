'use strict';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_whatsapp_configs (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL UNIQUE,
        provider VARCHAR(30) NOT NULL DEFAULT 'zapi',
        instance_id VARCHAR(255) NOT NULL,
        token_encrypted TEXT NOT NULL,
        client_token_encrypted TEXT NOT NULL,
        webhook_secret VARCHAR(100) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_whatsapp_conversas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        prospect_id INTEGER,
        cliente_id INTEGER,
        assigned_user_id INTEGER,
        phone VARCHAR(30) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'aberto',
        tags JSONB NOT NULL DEFAULT '[]',
        unread_count INTEGER NOT NULL DEFAULT 0,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (empresa_id, phone)
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_whatsapp_mensagens (
        id BIGSERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        conversa_id INTEGER NOT NULL REFERENCES crm_whatsapp_conversas(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        direction VARCHAR(10) NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'text',
        content TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'recebida',
        sent_by INTEGER,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        raw_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q.query('CREATE INDEX IF NOT EXISTS crm_wa_conversas_empresa_status_idx ON crm_whatsapp_conversas (empresa_id, status, last_message_at DESC)');
    await q.query('CREATE INDEX IF NOT EXISTS crm_wa_mensagens_conversa_idx ON crm_whatsapp_mensagens (empresa_id, conversa_id, sent_at)');
    await q.query('CREATE UNIQUE INDEX IF NOT EXISTS crm_wa_mensagens_external_idx ON crm_whatsapp_mensagens (empresa_id, external_id) WHERE external_id IS NOT NULL');
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('DROP TABLE IF EXISTS crm_whatsapp_mensagens');
    await q.query('DROP TABLE IF EXISTS crm_whatsapp_conversas');
    await q.query('DROP TABLE IF EXISTS crm_whatsapp_configs');
  },
};
