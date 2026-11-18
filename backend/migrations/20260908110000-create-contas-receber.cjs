'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260908110000-create-contas-receber'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS contas_receber (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id),
          cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
          venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
          nota_fiscal_id INTEGER REFERENCES notas_fiscais_emitidas(id) ON DELETE SET NULL,
          origem VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
          descricao VARCHAR(300) NOT NULL,
          valor NUMERIC(12,2) NOT NULL,
          valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
          data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
          data_vencimento DATE NOT NULL,
          data_pagamento DATE,
          status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
          observacao TEXT,
          criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT contas_receber_valor_check CHECK (valor > 0),
          CONSTRAINT contas_receber_valor_pago_check CHECK (valor_pago >= 0 AND valor_pago <= valor),
          CONSTRAINT contas_receber_origem_check CHECK (origem IN ('MANUAL', 'VENDA', 'NF_E', 'RECORRENCIA')),
          CONSTRAINT contas_receber_status_check CHECK (status IN ('ABERTA', 'PAGA', 'CANCELADA'))
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS contas_receber_empresa_status_vencimento_idx
          ON contas_receber (empresa_id, status, data_vencimento)
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS contas_receber_cliente_idx
          ON contas_receber (empresa_id, cliente_id)
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS contas_receber_venda_aberta_unique
          ON contas_receber (empresa_id, venda_id)
          WHERE venda_id IS NOT NULL AND status <> 'CANCELADA'
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS contas_receber_nota_fiscal_unique
          ON contas_receber (empresa_id, nota_fiscal_id)
          WHERE nota_fiscal_id IS NOT NULL AND status <> 'CANCELADA'
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS contas_receber');
  }
};
