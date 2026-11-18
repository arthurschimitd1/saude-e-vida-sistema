'use strict';

/**
 * Schema usado pelas telas de Caixa e Produção.
 * Antes desta migration parte dele era criada somente no bootstrap das rotas,
 * o que deixava uma instância nova sujeita a corrida entre a API e o DDL.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS receitas (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(200) NOT NULL,
          produto_id INTEGER,
          empresa_id INTEGER,
          descricao TEXT,
          valor_unitario DECIMAL(10,2),
          custo_estimado DECIMAL(10,2),
          rendimento DECIMAL(10,3),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS receita_itens (
          id SERIAL PRIMARY KEY,
          receita_id INTEGER NOT NULL,
          raw_material_id INTEGER,
          produto_id INTEGER,
          quantidade DECIMAL(10,3) NOT NULL DEFAULT 1
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ordens_producao (
          id SERIAL PRIMARY KEY,
          receita_id INTEGER,
          quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
          quantidade_final DECIMAL(10,3),
          status VARCHAR(20) NOT NULL DEFAULT 'pendente',
          empresa_id INTEGER,
          usuario_id INTEGER,
          observacao TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS turnos_caixa (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER,
          func_abertura_id INTEGER,
          func_abertura_nome VARCHAR(200) NOT NULL,
          valor_abertura DECIMAL(10,2) NOT NULL DEFAULT 0,
          data_abertura TIMESTAMP NOT NULL DEFAULT NOW(),
          func_fechamento_id INTEGER,
          func_fechamento_nome VARCHAR(200),
          valor_fechamento DECIMAL(10,2),
          data_fechamento TIMESTAMP,
          status VARCHAR(10) NOT NULL DEFAULT 'aberto',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `, { transaction });

      const itens = await queryInterface.describeTable('venda_itens');
      if (!itens.nome_item) await queryInterface.addColumn('venda_itens', 'nome_item', { type: Sequelize.STRING(300), allowNull: true }, { transaction });

      const vendas = await queryInterface.describeTable('vendas');
      if (!vendas.pagamentos) await queryInterface.addColumn('vendas', 'pagamentos', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      if (!vendas.turno_id) await queryInterface.addColumn('vendas', 'turno_id', { type: Sequelize.INTEGER, allowNull: true }, { transaction });

      const products = await queryInterface.describeTable('Products');
      for (const [column, definition] of [
        ['cfop', { type: Sequelize.STRING(255), allowNull: true }],
        ['ncm', { type: Sequelize.STRING(255), allowNull: true }],
        ['codigo_barras', { type: Sequelize.STRING(255), allowNull: true }],
      ]) {
        if (!products[column]) await queryInterface.addColumn('Products', column, definition, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    // Não destrói tabelas/colunas em rollback: parte do schema pode ter sido
    // criada pelo bootstrap legado antes da migration ser registrada.
  },
};
