'use strict';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_config (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL UNIQUE,
        numero_whatsapp VARCHAR(30),
        zapi_instance_id VARCHAR(100),
        zapi_token TEXT,
        zapi_client_token TEXT,
        webhook_token VARCHAR(64),
        nome_empresa VARCHAR(255),
        nome_responsavel VARCHAR(255),
        telefone_contato VARCHAR(30),
        email_suporte VARCHAR(255),
        email_meta VARCHAR(255),
        fuso_horario VARCHAR(50) DEFAULT 'America/Sao_Paulo',
        idioma VARCHAR(10) DEFAULT 'pt-BR',
        observacoes TEXT,
        ia_ativa BOOLEAN DEFAULT false,
        ia_modelo VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
        ia_temperatura DECIMAL(3,2) DEFAULT 0.7,
        ia_max_contexto INTEGER DEFAULT 10,
        ia_prompt_base TEXT,
        ia_regras_comerciais TEXT,
        ia_personalidade TEXT,
        horario_comercial JSONB DEFAULT '{}',
        mensagens_padrao JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_conversas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        cliente_id INTEGER,
        telefone VARCHAR(120) NOT NULL,
        nome_contato VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'aberta',
        nao_lidas INTEGER NOT NULL DEFAULT 0,
        ultima_mensagem_preview VARCHAR(255),
        ultima_mensagem_em TIMESTAMPTZ,
        ultima_mensagem_direcao VARCHAR(10),
        responsavel_id INTEGER,
        resumo_ia TEXT,
        nome_editado_manualmente BOOLEAN NOT NULL DEFAULT false,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
        id BIGSERIAL PRIMARY KEY,
        conversa_id INTEGER NOT NULL REFERENCES whatsapp_conversas(id) ON DELETE CASCADE,
        empresa_id INTEGER,
        direcao VARCHAR(10) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'texto',
        conteudo_texto TEXT,
        midia_url TEXT,
        midia_nome VARCHAR(255),
        midia_mime VARCHAR(100),
        zapi_message_id VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'enviada',
        enviado_por_user_id INTEGER,
        editado_em TIMESTAMPTZ,
        transcricao TEXT,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        conversa_id INTEGER,
        tipo VARCHAR(30) NOT NULL,
        mensagem TEXT,
        metadata JSONB DEFAULT '{}',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_cliente_crm (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL UNIQUE,
        empresa_id INTEGER NOT NULL,
        status_atendimento VARCHAR(20) NOT NULL DEFAULT 'aberto',
        estagio VARCHAR(30) NOT NULL DEFAULT 'novo_lead',
        motivo_clinico VARCHAR(50),
        profissional VARCHAR(60),
        origem VARCHAR(100),
        responsavel_id INTEGER,
        proximo_retorno DATE,
        observacoes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_etiquetas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'etiqueta',
        nome VARCHAR(100) NOT NULL,
        cor VARCHAR(20) DEFAULT '#64748b',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_cliente_etiquetas (
        id SERIAL PRIMARY KEY,
        cliente_crm_id INTEGER NOT NULL,
        etiqueta_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'aceita',
        sugerida_por_ia BOOLEAN DEFAULT false,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_catalogos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        chave VARCHAR(60) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        cor VARCHAR(20) DEFAULT '#64748b',
        ordem INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (empresa_id, tipo, chave)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_contato_identificadores (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        cliente_id INTEGER NOT NULL,
        tipo VARCHAR(10) NOT NULL,
        valor VARCHAR(120) NOT NULL,
        confirmado BOOLEAN NOT NULL DEFAULT false,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (empresa_id, tipo, valor)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_merge_candidatos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        conversa_origem_id INTEGER NOT NULL,
        conversa_alvo_id INTEGER NOT NULL,
        motivo VARCHAR(255),
        status VARCHAR(15) NOT NULL DEFAULT 'pendente',
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (empresa_id, conversa_origem_id, conversa_alvo_id)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_relatorios_monitoria (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        data DATE NOT NULL,
        conteudo JSONB NOT NULL,
        gerado_por INTEGER,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (empresa_id, data)
      )
    `);

    await q.query('CREATE INDEX IF NOT EXISTS wa_conversas_empresa_status_idx ON whatsapp_conversas (empresa_id, status, ultima_mensagem_em DESC)');
    await q.query('CREATE INDEX IF NOT EXISTS wa_mensagens_conversa_idx ON whatsapp_mensagens (empresa_id, conversa_id, criado_em)');
    await q.query('CREATE UNIQUE INDEX IF NOT EXISTS wa_mensagens_zapi_idx ON whatsapp_mensagens (empresa_id, zapi_message_id) WHERE zapi_message_id IS NOT NULL');
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('DROP TABLE IF EXISTS whatsapp_relatorios_monitoria');
    await q.query('DROP TABLE IF EXISTS whatsapp_merge_candidatos');
    await q.query('DROP TABLE IF EXISTS whatsapp_contato_identificadores');
    await q.query('DROP TABLE IF EXISTS whatsapp_catalogos');
    await q.query('DROP TABLE IF EXISTS whatsapp_cliente_etiquetas');
    await q.query('DROP TABLE IF EXISTS whatsapp_etiquetas');
    await q.query('DROP TABLE IF EXISTS whatsapp_cliente_crm');
    await q.query('DROP TABLE IF EXISTS whatsapp_logs');
    await q.query('DROP TABLE IF EXISTS whatsapp_mensagens');
    await q.query('DROP TABLE IF EXISTS whatsapp_conversas');
    await q.query('DROP TABLE IF EXISTS whatsapp_config');
  },
};
