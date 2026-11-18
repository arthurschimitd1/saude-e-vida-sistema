'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE clientes
        ADD COLUMN IF NOT EXISTS pontos_saldo INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pontos_acumulados INTEGER NOT NULL DEFAULT 0
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE loja_cupons
        ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS roleta_lead_id INTEGER,
        ADD COLUMN IF NOT EXISTS premio_id INTEGER,
        ADD COLUMN IF NOT EXISTS produto_id INTEGER,
        ADD COLUMN IF NOT EXISTS uso_unico_cliente BOOLEAN NOT NULL DEFAULT false
    `);
    await queryInterface.createTable('loja_premios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      nome: { type: Sequelize.STRING(120), allowNull: false },
      descricao: { type: Sequelize.TEXT },
      tipo: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'desconto_percentual' },
      valor: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      pontos_custo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      produto_id: { type: Sequelize.INTEGER, allowNull: true },
      chance: { type: Sequelize.DECIMAL(10, 4), allowNull: false, defaultValue: 1 },
      estoque: { type: Sequelize.INTEGER, allowNull: true },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.createTable('loja_roleta_leads', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      token: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      nome: { type: Sequelize.STRING(160), allowNull: false },
      data_nascimento: { type: Sequelize.DATEONLY },
      telefone: { type: Sequelize.STRING(30), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: false },
      cep: { type: Sequelize.STRING(9) },
      rua: { type: Sequelize.STRING(160) },
      numero: { type: Sequelize.STRING(30) },
      complemento: { type: Sequelize.STRING(120) },
      bairro: { type: Sequelize.STRING(120) },
      cidade: { type: Sequelize.STRING(120) },
      estado: { type: Sequelize.STRING(2) },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pendente' },
      cliente_id: { type: Sequelize.INTEGER, references: { model: 'clientes', key: 'id' }, onDelete: 'SET NULL' },
      premio_id: { type: Sequelize.INTEGER, references: { model: 'loja_premios', key: 'id' }, onDelete: 'SET NULL' },
      codigo_premio: { type: Sequelize.STRING(40) },
      premio_email_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pendente' },
      premio_email_erro: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.createTable('loja_pontos_resgates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      cliente_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'clientes', key: 'id' }, onDelete: 'CASCADE' },
      premio_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'loja_premios', key: 'id' }, onDelete: 'RESTRICT' },
      cupom_id: { type: Sequelize.INTEGER, references: { model: 'loja_cupons', key: 'id' }, onDelete: 'SET NULL' },
      codigo: { type: Sequelize.STRING(40), allowNull: false },
      pontos: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ativo' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.createTable('loja_pontos_movimentos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
      cliente_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'clientes', key: 'id' }, onDelete: 'CASCADE' },
      venda_id: { type: Sequelize.INTEGER, references: { model: 'vendas', key: 'id' }, onDelete: 'SET NULL' },
      resgate_id: { type: Sequelize.INTEGER, references: { model: 'loja_pontos_resgates', key: 'id' }, onDelete: 'SET NULL' },
      tipo: { type: Sequelize.STRING(20), allowNull: false },
      pontos: { type: Sequelize.INTEGER, allowNull: false },
      descricao: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('loja_premios', ['empresa_id', 'ativo'], { name: 'idx_loja_premios_empresa_ativo' });
    await queryInterface.addIndex('loja_roleta_leads', ['empresa_id', 'status', 'created_at'], { name: 'idx_loja_roleta_leads_empresa_status' });
    await queryInterface.addIndex('loja_pontos_resgates', ['empresa_id', 'cliente_id', 'status'], { name: 'idx_loja_pontos_resgates_cliente' });
    await queryInterface.addIndex('loja_pontos_movimentos', ['empresa_id', 'cliente_id', 'created_at'], { name: 'idx_loja_pontos_movimentos_cliente' });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_loja_pontos_ganho_venda
      ON loja_pontos_movimentos (venda_id)
      WHERE tipo = 'ganho' AND venda_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_loja_pontos_ganho_venda');
    await queryInterface.dropTable('loja_pontos_movimentos');
    await queryInterface.dropTable('loja_pontos_resgates');
    await queryInterface.dropTable('loja_roleta_leads');
    await queryInterface.dropTable('loja_premios');
    await queryInterface.sequelize.query(`
      ALTER TABLE loja_cupons DROP COLUMN IF EXISTS uso_unico_cliente, DROP COLUMN IF EXISTS produto_id,
      DROP COLUMN IF EXISTS premio_id, DROP COLUMN IF EXISTS roleta_lead_id, DROP COLUMN IF EXISTS cliente_id
    `);
    await queryInterface.sequelize.query('ALTER TABLE clientes DROP COLUMN IF EXISTS pontos_acumulados, DROP COLUMN IF EXISTS pontos_saldo');
  },
};
