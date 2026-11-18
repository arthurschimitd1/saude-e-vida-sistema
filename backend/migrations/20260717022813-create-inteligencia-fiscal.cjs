'use strict';

/**
 * Cria a estrutura inicial do módulo de Inteligência Fiscal.
 *
 * Tabelas:
 * - auditorias_fiscais
 * - inconsistencias_fiscais
 * - inconsistencias_fiscais_historico
 * - auditoria_fiscal_inconsistencias
 */

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;

    // ══════════════════════════════════════════════════════
    // AUDITORIAS FISCAIS
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE TABLE auditorias_fiscais (
        id SERIAL PRIMARY KEY,

        empresa_id INTEGER NOT NULL,
        executada_por_id INTEGER,

        tipo_execucao VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',

        periodo_inicio DATE NOT NULL,
        periodo_fim DATE NOT NULL,

        tipos_documento VARCHAR[] NOT NULL DEFAULT ARRAY['NFE', 'NFCE']::VARCHAR[],

        total_documentos INTEGER NOT NULL DEFAULT 0,
        documentos_conformes INTEGER NOT NULL DEFAULT 0,
        documentos_com_inconsistencia INTEGER NOT NULL DEFAULT 0,

        total_inconsistencias INTEGER NOT NULL DEFAULT 0,
        inconsistencias_criticas INTEGER NOT NULL DEFAULT 0,
        inconsistencias_altas INTEGER NOT NULL DEFAULT 0,
        inconsistencias_medias INTEGER NOT NULL DEFAULT 0,
        total_resolvidas INTEGER NOT NULL DEFAULT 0,

        valor_total_afetado DECIMAL(15,2) NOT NULL DEFAULT 0,

        score_fiscal DECIMAL(5,2),
        classificacao VARCHAR(1),
        taxa_inconsistencia DECIMAL(5,2),

        iniciada_em TIMESTAMPTZ,
        finalizada_em TIMESTAMPTZ,

        mensagem_erro TEXT,
        resumo JSONB,

        tipo_contexto VARCHAR(50) NOT NULL DEFAULT 'NOTA_FISCAL',
        referencia_id INTEGER,

        total_regras INTEGER NOT NULL DEFAULT 0,
        total_regras_erro INTEGER NOT NULL DEFAULT 0,
        total_novas INTEGER NOT NULL DEFAULT 0,
        total_atualizadas INTEGER NOT NULL DEFAULT 0,
        total_reabertas INTEGER NOT NULL DEFAULT 0,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT auditorias_fiscais_empresa_fk
          FOREIGN KEY (empresa_id)
          REFERENCES empresas(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT auditorias_fiscais_usuario_fk
          FOREIGN KEY (executada_por_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    // ══════════════════════════════════════════════════════
    // INCONSISTÊNCIAS FISCAIS
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE TABLE inconsistencias_fiscais (
        id SERIAL PRIMARY KEY,

        empresa_id INTEGER NOT NULL,
        nota_fiscal_id INTEGER,

        venda_id INTEGER,
        venda_item_id INTEGER,
        produto_id INTEGER,
        cliente_id INTEGER,

        codigo_regra VARCHAR(100) NOT NULL,
        chave_inconsistencia VARCHAR(255) NOT NULL,

        tipo VARCHAR(100) NOT NULL,
        categoria VARCHAR(30) NOT NULL,

        titulo VARCHAR(255) NOT NULL,
        descricao TEXT NOT NULL,

        campo_afetado VARCHAR(100),
        valor_encontrado TEXT,
        valor_esperado TEXT,

        valor_afetado DECIMAL(15,2),

        severidade VARCHAR(20) NOT NULL DEFAULT 'MEDIA',
        status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',

        responsavel_id INTEGER,

        detectada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        prazo_resolucao DATE,

        resolvida_em TIMESTAMPTZ,
        resolvida_por_id INTEGER,

        tipo_resolucao VARCHAR(40),
        resolucao_automatica BOOLEAN NOT NULL DEFAULT false,
        observacao_resolucao TEXT,

        dados_deteccao JSONB,
        ultima_verificacao_em TIMESTAMPTZ,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT inconsistencias_fiscais_empresa_fk
          FOREIGN KEY (empresa_id)
          REFERENCES empresas(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT inconsistencias_fiscais_nota_fk
          FOREIGN KEY (nota_fiscal_id)
          REFERENCES notas_fiscais_emitidas(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT inconsistencias_fiscais_venda_fk
          FOREIGN KEY (venda_id)
          REFERENCES vendas(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_fiscais_venda_item_fk
          FOREIGN KEY (venda_item_id)
          REFERENCES venda_itens(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_fiscais_produto_fk
          FOREIGN KEY (produto_id)
          REFERENCES "Products"(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_fiscais_cliente_fk
          FOREIGN KEY (cliente_id)
          REFERENCES clientes(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_fiscais_responsavel_fk
          FOREIGN KEY (responsavel_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_fiscais_resolvida_por_fk
          FOREIGN KEY (resolvida_por_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    // ══════════════════════════════════════════════════════
    // HISTÓRICO DAS INCONSISTÊNCIAS
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE TABLE inconsistencias_fiscais_historico (
        id SERIAL PRIMARY KEY,

        inconsistencia_id INTEGER NOT NULL,
        usuario_id INTEGER,

        origem_acao VARCHAR(20) NOT NULL DEFAULT 'USUARIO',
        acao VARCHAR(50) NOT NULL,

        status_anterior VARCHAR(30),
        status_novo VARCHAR(30),

        responsavel_anterior_id INTEGER,
        responsavel_novo_id INTEGER,

        observacao TEXT,

        dados_anteriores JSONB,
        dados_novos JSONB,

        auditoria_id INTEGER,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT inconsistencias_historico_inconsistencia_fk
          FOREIGN KEY (inconsistencia_id)
          REFERENCES inconsistencias_fiscais(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT inconsistencias_historico_usuario_fk
          FOREIGN KEY (usuario_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_historico_responsavel_anterior_fk
          FOREIGN KEY (responsavel_anterior_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT inconsistencias_historico_responsavel_novo_fk
          FOREIGN KEY (responsavel_novo_id)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    // ══════════════════════════════════════════════════════
    // RELAÇÃO AUDITORIA / INCONSISTÊNCIA
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE TABLE auditoria_fiscal_inconsistencias (
        id SERIAL PRIMARY KEY,

        auditoria_id INTEGER NOT NULL,
        inconsistencia_id INTEGER NOT NULL,

        status_no_momento VARCHAR(30) NOT NULL,
        severidade_no_momento VARCHAR(20) NOT NULL,

        estava_resolvida BOOLEAN NOT NULL DEFAULT false,
        tipo_resultado VARCHAR(20) NOT NULL,

        snapshot JSONB,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT auditoria_inconsistencias_auditoria_fk
          FOREIGN KEY (auditoria_id)
          REFERENCES auditorias_fiscais(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT auditoria_inconsistencias_inconsistencia_fk
          FOREIGN KEY (inconsistencia_id)
          REFERENCES inconsistencias_fiscais(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      )
    `);

    // ══════════════════════════════════════════════════════
    // ÍNDICES — AUDITORIAS
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE INDEX auditorias_fiscais_empresa_data_idx
      ON auditorias_fiscais (empresa_id, created_at)
    `);

    await q.query(`
      CREATE INDEX auditorias_fiscais_empresa_periodo_idx
      ON auditorias_fiscais (
        empresa_id,
        periodo_inicio,
        periodo_fim
      )
    `);

    await q.query(`
      CREATE INDEX auditorias_fiscais_empresa_status_idx
      ON auditorias_fiscais (empresa_id, status)
    `);

    // ══════════════════════════════════════════════════════
    // ÍNDICES — INCONSISTÊNCIAS
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE UNIQUE INDEX inconsistencia_fiscal_unica
      ON inconsistencias_fiscais (
        empresa_id,
        nota_fiscal_id,
        chave_inconsistencia
      )
    `);

    await q.query(`
      CREATE INDEX inconsistencias_empresa_status_severidade_idx
      ON inconsistencias_fiscais (
        empresa_id,
        status,
        severidade
      )
    `);

    await q.query(`
      CREATE INDEX inconsistencias_produto_idx
      ON inconsistencias_fiscais (produto_id)
    `);

    await q.query(`
      CREATE INDEX inconsistencias_cliente_idx
      ON inconsistencias_fiscais (cliente_id)
    `);

    await q.query(`
      CREATE INDEX inconsistencias_responsavel_idx
      ON inconsistencias_fiscais (responsavel_id)
    `);

    // ══════════════════════════════════════════════════════
    // ÍNDICES — HISTÓRICO
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE INDEX inconsistencia_historico_data_idx
      ON inconsistencias_fiscais_historico (
        inconsistencia_id,
        created_at
      )
    `);

    // ══════════════════════════════════════════════════════
    // ÍNDICE — AUDITORIA / INCONSISTÊNCIA
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE UNIQUE INDEX auditoria_inconsistencia_unica
      ON auditoria_fiscal_inconsistencias (
        auditoria_id,
        inconsistencia_id
      )
    `);
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;

    // Ordem inversa por causa das foreign keys.

    await q.query(`
      DROP TABLE IF EXISTS auditoria_fiscal_inconsistencias
    `);

    await q.query(`
      DROP TABLE IF EXISTS inconsistencias_fiscais_historico
    `);

    await q.query(`
      DROP TABLE IF EXISTS inconsistencias_fiscais
    `);

    await q.query(`
      DROP TABLE IF EXISTS auditorias_fiscais
    `);
  }
};