'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_servico_emitidas (
        id SERIAL PRIMARY KEY,

        empresa_id INTEGER NOT NULL REFERENCES empresas(id),
        servico_id INTEGER REFERENCES services(id),

        tipo VARCHAR(10) NOT NULL DEFAULT 'NFSE',

        status VARCHAR(255),
        numero VARCHAR(50),
        serie VARCHAR(20),
        rps_numero INTEGER,
        codigo_verificacao VARCHAR(100),
        protocolo_autorizacao TEXT,
        protocolo_cancelamento TEXT,

        ambiente VARCHAR(20),

        valor_total NUMERIC(15,2),
        valor_liquido NUMERIC(15,2),

        emitente_nome TEXT,
        emitente_cnpj VARCHAR(18),
        emitente_inscricao_municipal VARCHAR(30),

        destinatario_nome TEXT,
        destinatario_documento VARCHAR(18),
        destinatario_email TEXT,
        destinatario_telefone VARCHAR(20),
        destinatario_inscricao_municipal VARCHAR(30),
        destinatario_logradouro TEXT,
        destinatario_numero VARCHAR(20),
        destinatario_complemento TEXT,
        destinatario_bairro TEXT,
        destinatario_municipio TEXT,
        destinatario_codigo_municipio VARCHAR(10),
        destinatario_uf VARCHAR(2),
        destinatario_cep VARCHAR(10),

        data_emissao TIMESTAMP,
        data_autorizacao TIMESTAMP,
        data_cancelamento TIMESTAMP,
        ultima_consulta TIMESTAMP,

        mensagem_retorno TEXT,
        codigo_retorno VARCHAR(255),

        xml_url TEXT,
        pdf_url TEXT,

        payload_enviado JSONB,

        provedor VARCHAR(20) NOT NULL DEFAULT 'FOCUS',

        referencia_externa TEXT NOT NULL UNIQUE,

        resposta_provedor JSONB,

        motivo_cancelamento TEXT,

        servico_nome TEXT,
        servico_descricao TEXT,
        item_lista_servico VARCHAR(10),
        codigo_tributacao_municipio VARCHAR(20),
        codigo_cnae VARCHAR(10),

        aliquota NUMERIC(5,2) DEFAULT 0,
        base_calculo NUMERIC(15,2) DEFAULT 0,
        desconto NUMERIC(15,2) DEFAULT 0,
        deducoes NUMERIC(15,2) DEFAULT 0,
        pis NUMERIC(15,2) DEFAULT 0,
        cofins NUMERIC(15,2) DEFAULT 0,
        inss NUMERIC(15,2) DEFAULT 0,
        irrf NUMERIC(15,2) DEFAULT 0,
        csll NUMERIC(15,2) DEFAULT 0,
        iss NUMERIC(15,2) DEFAULT 0,

        iss_retido BOOLEAN DEFAULT FALSE,
        outras_retencoes NUMERIC(15,2) DEFAULT 0,

        natureza_operacao INTEGER DEFAULT 1,
        optante_simples_nacional BOOLEAN DEFAULT FALSE,
        incentivador_cultural BOOLEAN DEFAULT FALSE,

        email_enviado_em TIMESTAMP,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_nfse_empresa
      ON notas_fiscais_servico_emitidas (empresa_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_nfse_empresa_status
      ON notas_fiscais_servico_emitidas (empresa_id, status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_nfse_servico
      ON notas_fiscais_servico_emitidas (servico_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS notas_fiscais_servico_emitidas;
    `);
  },
};