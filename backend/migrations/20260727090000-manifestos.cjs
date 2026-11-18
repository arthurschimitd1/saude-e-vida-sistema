'use strict';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;

    await q.query(`
      ALTER TABLE configuracao_fiscal
      ADD COLUMN IF NOT EXISTS codigo_municipio VARCHAR(7)
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS manifesto_veiculos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        placa VARCHAR(8) NOT NULL,
        renavam VARCHAR(20),
        tara_kg DECIMAL(12,3),
        capacidade_kg DECIMAL(12,3),
        tipo_rodado VARCHAR(40),
        tipo_carroceria VARCHAR(40),
        uf_licenciamento CHAR(2),
        proprietario_nome VARCHAR(200),
        proprietario_documento VARCHAR(18),
        rntrc VARCHAR(20),
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (empresa_id, placa)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS manifesto_condutores (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        nome VARCHAR(200) NOT NULL,
        cpf VARCHAR(14) NOT NULL,
        telefone VARCHAR(30),
        cnh VARCHAR(30),
        validade_cnh DATE,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (empresa_id, cpf)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS manifestos_mdfe (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        usuario_id INTEGER REFERENCES users(id),
        referencia VARCHAR(100) NOT NULL,
        numero VARCHAR(20),
        serie VARCHAR(10) NOT NULL DEFAULT '1',
        chave_acesso VARCHAR(50),
        ambiente VARCHAR(20) NOT NULL DEFAULT 'homologacao',
        status VARCHAR(40) NOT NULL DEFAULT 'RASCUNHO',
        status_fiscal VARCHAR(100),
        codigo_retorno VARCHAR(30),
        motivo_retorno TEXT,
        protocolo VARCHAR(80),
        tipo_emitente INTEGER,
        tipo_transportador INTEGER,
        modal VARCHAR(30) NOT NULL DEFAULT 'rodoviario',
        uf_carregamento CHAR(2),
        codigo_municipio_carregamento VARCHAR(7),
        municipio_carregamento VARCHAR(150),
        uf_descarregamento CHAR(2),
        codigo_municipio_descarregamento VARCHAR(7),
        municipio_descarregamento VARCHAR(150),
        ufs_percurso JSONB NOT NULL DEFAULT '[]',
        previsao_inicio TIMESTAMPTZ,
        rota_observacoes TEXT,
        veiculo_id INTEGER REFERENCES manifesto_veiculos(id),
        reboques JSONB NOT NULL DEFAULT '[]',
        condutor_ids JSONB NOT NULL DEFAULT '[]',
        quantidade_documentos INTEGER NOT NULL DEFAULT 0,
        peso_bruto DECIMAL(15,3) NOT NULL DEFAULT 0,
        peso_liquido DECIMAL(15,3),
        unidade_carga VARCHAR(10) NOT NULL DEFAULT 'KG',
        valor_total_carga DECIMAL(15,2) NOT NULL DEFAULT 0,
        produto_predominante VARCHAR(200),
        tipo_carga VARCHAR(80),
        dados_seguro JSONB NOT NULL DEFAULT '{}',
        informacoes_fisco TEXT,
        informacoes_complementares TEXT,
        payload_focus JSONB,
        resposta_provedor JSONB,
        xml_enviado TEXT,
        xml_autorizado TEXT,
        pdf_url TEXT,
        data_emissao TIMESTAMPTZ,
        data_autorizacao TIMESTAMPTZ,
        data_cancelamento TIMESTAMPTZ,
        data_encerramento TIMESTAMPTZ,
        versao INTEGER NOT NULL DEFAULT 1,
        idempotency_key VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (empresa_id, referencia),
        UNIQUE (empresa_id, idempotency_key)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS manifesto_documentos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        mdfe_id INTEGER NOT NULL REFERENCES manifestos_mdfe(id) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL,
        chave_acesso VARCHAR(50) NOT NULL,
        documento_origem_id INTEGER,
        emitente_nome VARCHAR(200),
        destinatario_nome VARCHAR(200),
        uf_origem CHAR(2),
        uf_destino CHAR(2),
        valor DECIMAL(15,2) NOT NULL DEFAULT 0,
        peso DECIMAL(15,3) NOT NULL DEFAULT 0,
        status VARCHAR(40),
        dados JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (mdfe_id, chave_acesso)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS manifesto_eventos (
        id BIGSERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        usuario_id INTEGER REFERENCES users(id),
        entidade_tipo VARCHAR(30) NOT NULL,
        entidade_id VARCHAR(100) NOT NULL,
        acao VARCHAR(60) NOT NULL,
        status_anterior VARCHAR(60),
        status_posterior VARCHAR(60),
        protocolo VARCHAR(100),
        justificativa TEXT,
        resultado VARCHAR(30) NOT NULL DEFAULT 'SUCESSO',
        codigo_retorno VARCHAR(30),
        motivo_retorno TEXT,
        dados JSONB NOT NULL DEFAULT '{}',
        ip VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifestos_mdfe_empresa_status ON manifestos_mdfe (empresa_id, status)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifestos_mdfe_empresa_emissao ON manifestos_mdfe (empresa_id, data_emissao DESC)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifestos_mdfe_chave ON manifestos_mdfe (chave_acesso) WHERE chave_acesso IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifesto_documentos_empresa_chave ON manifesto_documentos (empresa_id, chave_acesso)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifesto_eventos_entidade ON manifesto_eventos (empresa_id, entidade_tipo, entidade_id, created_at DESC)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifesto_veiculos_empresa_ativo ON manifesto_veiculos (empresa_id, ativo)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_manifesto_condutores_empresa_ativo ON manifesto_condutores (empresa_id, ativo)`);
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;

    await q.query('DROP TABLE IF EXISTS manifesto_eventos');
    await q.query('DROP TABLE IF EXISTS manifesto_documentos');
    await q.query('DROP TABLE IF EXISTS manifestos_mdfe');
    await q.query('DROP TABLE IF EXISTS manifesto_condutores');
    await q.query('DROP TABLE IF EXISTS manifesto_veiculos');
    await q.query('ALTER TABLE configuracao_fiscal DROP COLUMN IF EXISTS codigo_municipio');
  }
};
