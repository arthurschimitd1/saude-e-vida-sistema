'use strict';

/**
 * Persiste a manifestação da NF-e recebida para que o status sobreviva a
 * novas consultas e recarregamentos da tela.
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;

    await q.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_focus (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        chave_acesso VARCHAR(44) NOT NULL,
        numero VARCHAR(20),
        serie VARCHAR(10),
        data_emissao TIMESTAMPTZ,
        valor_total DECIMAL(10,2),
        emitente_cnpj VARCHAR(18),
        emitente_nome VARCHAR(255),
        xml_content TEXT,
        manifestada BOOLEAN NOT NULL DEFAULT false,
        manifestacao_tipo VARCHAR(40),
        data_manifestacao TIMESTAMPTZ,
        enviado_para_dominio BOOLEAN NOT NULL DEFAULT false,
        data_envio_dominio TIMESTAMPTZ,
        integration_key_usada VARCHAR(255),
        status_focus VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`
      ALTER TABLE notas_fiscais_focus
      ADD COLUMN IF NOT EXISTS manifestacao_tipo VARCHAR(40)
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS notas_fiscais_focus_empresa_chave_idx
      ON notas_fiscais_focus (empresa_id, chave_acesso)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS notas_fiscais_focus
      DROP COLUMN IF EXISTS manifestacao_tipo
    `);
  }
};
