'use strict';

/**
 * Migration baseline — congela o estado atual do schema.
 * Todas as queries usam IF NOT EXISTS / IF EXISTS, então é seguro
 * rodar mesmo em bancos que já têm as tabelas.
 *
 * Em produção/staging onde o banco já existe, basta inserir o nome
 * deste arquivo na tabela SequelizeMeta para marcar como executado.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;

    // ══════════════════════════════════════════════════════
    // CREATE TABLEs (tabelas criadas via raw SQL no antigo associations.js)
    // ══════════════════════════════════════════════════════

    await q.query(`
      CREATE TABLE IF NOT EXISTS kanban_colunas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nome VARCHAR(80) NOT NULL,
        cor VARCHAR(20) DEFAULT '#6b7280',
        ordem INTEGER NOT NULL DEFAULT 99,
        integra_ponto BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS setores_planejamento (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        cor VARCHAR(20) DEFAULT '#3b82f6',
        criado_por INTEGER,
        membros JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS agendamento_colaboradores (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        usuario_id INTEGER,
        usuario_nome VARCHAR(200) NOT NULL,
        cor VARCHAR(20) DEFAULT '#3b82f6',
        ordem INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS agendamento_servicos (
        id VARCHAR(80) NOT NULL,
        empresa_id INTEGER NOT NULL,
        nome VARCHAR(200) NOT NULL,
        duracao_min INTEGER NOT NULL DEFAULT 30,
        preco DECIMAL(10,2) NOT NULL DEFAULT 0,
        cor VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, empresa_id)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        cliente_id INTEGER,
        colaborador_id INTEGER NOT NULL,
        servico_id VARCHAR(80),
        servico_nome VARCHAR(200),
        data DATE NOT NULL,
        horario VARCHAR(5) NOT NULL,
        observacao TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'aguardando',
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        forma_pagamento VARCHAR(50),
        cliente_nome VARCHAR(200) NOT NULL,
        cliente_telefone VARCHAR(30),
        cliente_email VARCHAR(200),
        cliente_nascimento DATE,
        historico JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS agendamento_bloqueios (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        colaborador_id INTEGER NOT NULL,
        data DATE NOT NULL,
        hora_inicio TIME,
        hora_fim TIME,
        motivo VARCHAR(300),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (empresa_id, colaborador_id, data)
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        venda_id INTEGER,
        referencia VARCHAR(100),
        tipo VARCHAR(10) NOT NULL DEFAULT 'nfe',
        status VARCHAR(20) NOT NULL DEFAULT 'processando',
        chave_acesso VARCHAR(50),
        numero VARCHAR(20),
        serie VARCHAR(5),
        caminho_xml TEXT,
        caminho_danfe TEXT,
        qrcode_url TEXT,
        protocolo_sefaz VARCHAR(50),
        mensagem_sefaz TEXT,
        data_emissao TIMESTAMPTZ,
        payload_enviado JSONB,
        resposta_api JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        employee_id INTEGER,
        employee_name VARCHAR(255) NOT NULL,
        employee_cargo VARCHAR(100),
        date DATE NOT NULL,
        check_in VARCHAR(8),
        lunch_out VARCHAR(8),
        lunch_return VARCHAR(8),
        check_out VARCHAR(8),
        total_hours DECIMAL(5,2),
        extra_hours DECIMAL(5,2),
        late_minutes INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'AUSENTE',
        observation TEXT,
        imported BOOLEAN DEFAULT false,
        imported_file VARCHAR(255),
        imported_at TIMESTAMP,
        audit_log JSONB DEFAULT '[]',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        value DECIMAL(15,2) DEFAULT 0,
        item_lista_servico VARCHAR(10),
        codigo_tributacao_municipio VARCHAR(20),
        codigo_cnae VARCHAR(10),
        aliquota DECIMAL(5,2) DEFAULT 0,
        codigo_municipio VARCHAR(10),
        discriminacao_padrao TEXT,
        percentual_tributos DECIMAL(5,2) DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS service_invoices (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        reference VARCHAR(100) UNIQUE,
        rps_numero INTEGER,
        service_id INTEGER,
        service_name VARCHAR(255),
        service_description TEXT,
        customer_name VARCHAR(255),
        customer_cpf_cnpj VARCHAR(20),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(20),
        customer_inscricao_municipal VARCHAR(30),
        customer_logradouro VARCHAR(255),
        customer_numero VARCHAR(20),
        customer_complemento VARCHAR(100),
        customer_bairro VARCHAR(100),
        customer_cidade VARCHAR(100),
        customer_uf VARCHAR(2),
        customer_cep VARCHAR(10),
        customer_codigo_municipio VARCHAR(10),
        valor_servicos DECIMAL(15,2) DEFAULT 0,
        desconto DECIMAL(15,2) DEFAULT 0,
        deducoes DECIMAL(15,2) DEFAULT 0,
        valor_liquido DECIMAL(15,2) DEFAULT 0,
        pis DECIMAL(15,2) DEFAULT 0,
        cofins DECIMAL(15,2) DEFAULT 0,
        inss DECIMAL(15,2) DEFAULT 0,
        irrf DECIMAL(15,2) DEFAULT 0,
        csll DECIMAL(15,2) DEFAULT 0,
        iss DECIMAL(15,2) DEFAULT 0,
        iss_retido BOOLEAN DEFAULT false,
        outras_retencoes DECIMAL(15,2) DEFAULT 0,
        item_lista_servico VARCHAR(10),
        codigo_tributacao_municipio VARCHAR(20),
        codigo_cnae VARCHAR(10),
        aliquota DECIMAL(5,2) DEFAULT 0,
        natureza_operacao INTEGER DEFAULT 1,
        optante_simples_nacional BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pendente',
        nfse_number VARCHAR(50),
        verification_code VARCHAR(100),
        xml_url TEXT,
        pdf_url TEXT,
        focus_response JSONB,
        error_messages JSONB,
        cancelamento_justificativa TEXT,
        email_enviado_em TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS nfse_configs (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER UNIQUE,
        inscricao_municipal VARCHAR(30),
        codigo_municipio VARCHAR(10),
        optante_simples_nacional BOOLEAN DEFAULT false,
        incentivador_cultural BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS calendario_eventos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        titulo VARCHAR(300) NOT NULL,
        descricao TEXT,
        data_inicio TIMESTAMPTZ NOT NULL,
        data_fim TIMESTAMPTZ,
        responsavel VARCHAR(200),
        tipo VARCHAR(20) NOT NULL DEFAULT 'evento',
        cor VARCHAR(20) DEFAULT '#3b82f6',
        dia_todo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS contratos (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        partes_envolvidas VARCHAR(255) NOT NULL,
        tipo_parte VARCHAR(50) NOT NULL,
        tipo_contrato VARCHAR(50) NOT NULL,
        valor DECIMAL(15,2),
        data_inicio DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        periodicidade VARCHAR(20) NOT NULL DEFAULT 'sem_renovacao',
        status VARCHAR(20) NOT NULL DEFAULT 'em_analise',
        responsavel_interno VARCHAR(255),
        observacoes TEXT,
        corpo_contrato TEXT,
        pdf_url TEXT,
        empresa_id INTEGER NOT NULL,
        criado_por INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS contratos_historico (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL,
        usuario_id INTEGER,
        usuario_nome VARCHAR(255),
        campo_alterado VARCHAR(255) NOT NULL,
        valor_anterior TEXT,
        valor_novo TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS procuracoes (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(20) NOT NULL,
        outorgante_nome VARCHAR(255) NOT NULL,
        outorgante_documento VARCHAR(20),
        outorgado_nome VARCHAR(255) NOT NULL,
        outorgado_documento VARCHAR(20),
        data_emissao DATE NOT NULL,
        data_validade DATE,
        numero_referencia VARCHAR(100),
        poderes TEXT,
        observacoes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'ativa',
        data_revogacao DATE,
        motivo_revogacao TEXT,
        cliente_id INTEGER,
        empresa_id INTEGER NOT NULL,
        criado_por INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_campanhas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        segment VARCHAR(255),
        description TEXT,
        states JSONB DEFAULT '[]',
        cities JSONB DEFAULT '[]',
        neighborhoods JSONB DEFAULT '[]',
        radius INTEGER DEFAULT 5,
        created_by INTEGER,
        empresa_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_prospects (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        empresa_id INTEGER,
        company_name VARCHAR(255) NOT NULL,
        responsible_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        instagram VARCHAR(255),
        website VARCHAR(500),
        address TEXT,
        city VARCHAR(255),
        state VARCHAR(50),
        google_place_id VARCHAR(255),
        google_rating DECIMAL(3,1),
        google_reviews INTEGER DEFAULT 0,
        lead_score INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Novo',
        observations TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_interacoes (
        id SERIAL PRIMARY KEY,
        prospect_id INTEGER NOT NULL,
        user_id INTEGER,
        empresa_id INTEGER,
        interaction_type VARCHAR(100),
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_scripts (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        empresa_id INTEGER,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        script_type VARCHAR(100) DEFAULT 'primeiro_contato',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS crm_campanha_filtros (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        state VARCHAR(50),
        city VARCHAR(255),
        neighborhood VARCHAR(255),
        radius INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS departamentos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        empresa_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS orcamentos_financeiros (
        id SERIAL PRIMARY KEY,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        categoria VARCHAR(255) NOT NULL,
        tipo VARCHAR(10) NOT NULL,
        valor_previsto DECIMAL(15,2) NOT NULL DEFAULT 0,
        empresa_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS lancamento_vinculos (
        id SERIAL PRIMARY KEY,
        saida_id INTEGER NOT NULL,
        produto_id INTEGER,
        rateio JSONB,
        responsavel VARCHAR(255),
        empresa_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ══════════════════════════════════════════════════════
    // ALTER TABLEs — ADD COLUMN IF NOT EXISTS
    // ══════════════════════════════════════════════════════

    const addColumns = [
      // Products
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS preco_compra DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS tipo_preco_venda VARCHAR(20) DEFAULT 'valor'`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS percentual_lucro DECIMAL(10,2)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS fabricante VARCHAR(255)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS is_materia_prima BOOLEAN DEFAULT false`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_medida VARCHAR(50)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_comercial VARCHAR(50)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_tributavel VARCHAR(50)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidades_por_caixa INTEGER`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS lote VARCHAR(100)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS data_validade DATE`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS peso_bruto DECIMAL(10,3)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS peso_liquido DECIMAL(10,3)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cest VARCHAR(20)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_csosn VARCHAR(10)`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_icms DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_pis DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_cofins DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_ipi DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_pis VARCHAR(2) DEFAULT '07'`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_cofins VARCHAR(2) DEFAULT '07'`,
      `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS raw_material_id INTEGER`,

      // funcionarios_custos
      `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicopagamentos JSONB DEFAULT '[]'`,
      `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicopromocoes JSONB DEFAULT '[]'`,
      `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicoferias JSONB DEFAULT '[]'`,
      `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS datapagamento VARCHAR(7)`,

      // raw_materials
      `ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS min_quantity DECIMAL(10,3) DEFAULT 0`,

      // tarefas
      `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS setor_id INTEGER`,
      `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS coluna_custom_id INTEGER`,
      `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS responsaveis JSONB DEFAULT '[]'`,
      `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ`,

      // agendamento_colaboradores
      `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
      `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS usuario_id INTEGER`,
      `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(200)`,
      `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#3b82f6'`,
      `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0`,

      // agendamento_servicos
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS nome VARCHAR(200)`,
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS duracao_min INTEGER DEFAULT 30`,
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#3b82f6'`,
      `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`,

      // agendamentos
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_id INTEGER`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS colaborador_id INTEGER`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servico_id VARCHAR(80)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servico_nome VARCHAR(200)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS data DATE`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS horario VARCHAR(5)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS observacao TEXT`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'aguardando'`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(30)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(200)`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_nascimento DATE`,
      `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'`,

      // clientes
      `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE`,

      // vendas
      `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS endereco_entrega VARCHAR(500)`,

      // venda_itens
      `ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'produto'`,
      `ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS roupa_id INTEGER`,
      `ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS variacao_id INTEGER`,
      `ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS raw_material_id INTEGER`,

      // empresas
      `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cargos JSONB DEFAULT '[]'`,

      // estoque_roupas
      `ALTER TABLE estoque_roupas ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500)`,

      // attendance_records
      `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS pauses JSONB DEFAULT '[]'`,
      `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS total_pause_minutes DECIMAL(8,2) DEFAULT 0`,
      `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS extra_inicio VARCHAR(8)`,

      // saidas
      `ALTER TABLE saidas ADD COLUMN IF NOT EXISTS natureza VARCHAR(10) NOT NULL DEFAULT 'SAIDA'`,
      `ALTER TABLE saidas ADD COLUMN IF NOT EXISTS categoria VARCHAR(255)`,
      `ALTER TABLE saidas ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente'`,
      `ALTER TABLE saidas ADD COLUMN IF NOT EXISTS comprovante_url VARCHAR(255)`,

      // contratos
      `ALTER TABLE contratos ADD COLUMN IF NOT EXISTS observacoes_tipo VARCHAR(255)`,
      `ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contratante VARCHAR(255)`,
      `ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contratado VARCHAR(255)`,
      `ALTER TABLE contratos ADD COLUMN IF NOT EXISTS anexo_public_id VARCHAR(255)`,

      // procuracoes
      `ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS contrato_id INTEGER`,
      `ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS anexo_url VARCHAR(255)`,
      `ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS anexo_public_id VARCHAR(255)`,

      // users
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    ];

    for (const sql of addColumns) {
      await q.query(sql).catch(() => {});
    }

    // ══════════════════════════════════════════════════════
    // ALTER TABLEs — mudanças de tipo e DROP NOT NULL
    // ══════════════════════════════════════════════════════

    const alterTypes = [
      `ALTER TABLE tarefas ALTER COLUMN data_inicio TYPE TIMESTAMP WITH TIME ZONE USING data_inicio::TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE tarefas ALTER COLUMN data_entrega TYPE TIMESTAMP WITH TIME ZONE USING data_entrega::TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE tarefas ALTER COLUMN data_conclusao TYPE TIMESTAMP WITH TIME ZONE USING data_conclusao::TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE tarefas ALTER COLUMN data_limite_retorno TYPE TIMESTAMP WITH TIME ZONE USING data_limite_retorno::TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE contratos ALTER COLUMN partes_envolvidas TYPE JSONB USING partes_envolvidas::jsonb`,
      `ALTER TABLE contratos ALTER COLUMN tipo_parte TYPE JSONB USING NULL`,
      `ALTER TABLE venda_itens ALTER COLUMN produto_id DROP NOT NULL`,
      `ALTER TABLE comissoes ALTER COLUMN funcionario_id DROP NOT NULL`,
      `ALTER TABLE estoque_roupas ALTER COLUMN tamanho DROP NOT NULL`,
    ];

    for (const sql of alterTypes) {
      await q.query(sql).catch(() => {});
    }

    // ══════════════════════════════════════════════════════
    // DATA MIGRATIONS — correções de dados one-time
    // ══════════════════════════════════════════════════════

    // Adiciona /dashboard nas permissões de empresas
    await q.query(`
      UPDATE empresas
      SET permissoes = permissoes || '["/dashboard"]'::jsonb
      WHERE NOT (permissoes @> '["/dashboard"]'::jsonb)
        AND permissoes IS NOT NULL
    `).catch(() => {});

    // Adiciona /dashboard nos donos de empresa
    await q.query(`
      UPDATE users
      SET permissoes = COALESCE(permissoes, '[]'::jsonb) || '["/dashboard"]'::jsonb
      WHERE (tipo = 'EMPRESA' OR cargo = 'Dono')
        AND NOT (COALESCE(permissoes, '[]'::jsonb) @> '["/dashboard"]'::jsonb)
    `).catch(() => {});

    // Corrige funcionarios_custos com empresa_id incorreto
    await q.query(`
      UPDATE funcionarios_custos
      SET empresa_id = (SELECT id FROM empresas ORDER BY id LIMIT 1)
      WHERE empresa_id = 1
        AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => {});

    await q.query(`
      UPDATE funcionarios_custos f
      SET empresa_id = (
        SELECT e.id FROM empresas e
        ORDER BY (SELECT COUNT(*) FROM funcionarios_custos f2 WHERE f2.empresa_id = e.id AND f2.empresa_id != 1) DESC
        LIMIT 1
      )
      WHERE f.empresa_id = 1
        AND (SELECT COUNT(*) FROM empresas) > 1
    `).catch(() => {});

    // Corrige attendance_records órfãos
    await q.query(`
      UPDATE funcionarios_custos
      SET empresa_id = (SELECT MIN(id) FROM empresas)
      WHERE empresa_id IS NULL
        AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => {});

    await q.query(`
      UPDATE attendance_records
      SET empresa_id = (SELECT MIN(id) FROM empresas)
      WHERE empresa_id IS NULL
        AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => {});

    // Migração de permissões de rotas
    const migracoes = [
      ['/uikit/producao', '/uikit/formlayout'],
      ['/uikit/pedidos', '/uikit/formlayout'],
      ['/uikit/integracao-focus', '/uikit/panel'],
      ['/uikit/notas-fiscais', '/uikit/floatlabel'],
      ['/uikit/servicos', '/uikit/input'],
      ['/uikit/servicos-nfe', '/uikit/servicos'],
      ['/uikit/servicos-nfce', '/uikit/servicos'],
      ['/uikit/ponto', '/uikit/menu'],
    ];

    for (const [rota, gatilho] of migracoes) {
      await q.query(
        `UPDATE empresas SET permissoes = array_cat(permissoes, ARRAY[:rota]::varchar[]) WHERE :gatilho = ANY(permissoes) AND NOT (:rota = ANY(permissoes))`,
        { replacements: { rota, gatilho } }
      ).catch(() => {});
      await q.query(
        `UPDATE users SET permissoes = array_cat(permissoes, ARRAY[:rota]::varchar[]) WHERE :gatilho = ANY(permissoes) AND NOT (:rota = ANY(permissoes))`,
        { replacements: { rota, gatilho } }
      ).catch(() => {});
    }

    await q.query(`
      UPDATE empresas SET permissoes = array_append(permissoes, '/uikit/estoque-roupas')
      WHERE NOT ('/uikit/estoque-roupas' = ANY(permissoes))
    `).catch(() => {});
  },

  async down() {
    // Baseline migration — não tem rollback (o banco foi criado assim)
  },
};
