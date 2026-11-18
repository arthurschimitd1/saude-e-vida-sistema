'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS asaas_integracoes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
          ambiente VARCHAR(20) NOT NULL DEFAULT 'sandbox',
          api_key_encrypted TEXT NOT NULL,
          webhook_auth_token_encrypted TEXT,
          webhook_id VARCHAR(80),
          webhook_url TEXT,
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT asaas_integracoes_ambiente_check CHECK (ambiente IN ('sandbox', 'producao'))
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS asaas_clientes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
          asaas_customer_id VARCHAR(80) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, cliente_id),
          UNIQUE (empresa_id, asaas_customer_id)
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS asaas_webhook_eventos (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          evento_id VARCHAR(120) NOT NULL,
          evento VARCHAR(100) NOT NULL,
          recebido_em TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, evento_id)
        )`, { transaction });

      const addColumnIfMissing = async (table, column, definition) => {
        const description = await queryInterface.describeTable(table, { transaction });
        if (!description[column]) {
          await queryInterface.addColumn(table, column, definition, { transaction });
        }
      };

      await addColumnIfMissing('recorrencias', 'asaas_customer_id', {
        type: Sequelize.STRING(80), allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_subscription_id', {
        type: Sequelize.STRING(80), allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_payment_link_id', {
        type: Sequelize.STRING(80), allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_payment_link_url', {
        type: Sequelize.TEXT, allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_status', {
        type: Sequelize.STRING(50), allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_last_synced_at', {
        type: Sequelize.DATE, allowNull: true
      });

      await addColumnIfMissing('historico_pagamentos', 'asaas_payment_id', {
        type: Sequelize.STRING(80), allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'asaas_status', {
        type: Sequelize.STRING(50), allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'asaas_invoice_url', {
        type: Sequelize.TEXT, allowNull: true
      });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_asaas_clientes_empresa_cliente
        ON asaas_clientes (empresa_id, cliente_id)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_asaas_recorrencias_subscription
        ON recorrencias (empresa_id, asaas_subscription_id)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_asaas_historico_payment
        ON historico_pagamentos (empresa_id, asaas_payment_id)`, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const column of ['asaas_payment_id', 'asaas_status', 'asaas_invoice_url']) {
        const description = await queryInterface.describeTable('historico_pagamentos', { transaction });
        if (description[column]) await queryInterface.removeColumn('historico_pagamentos', column, { transaction });
      }
      for (const column of ['asaas_customer_id', 'asaas_subscription_id', 'asaas_payment_link_id', 'asaas_payment_link_url', 'asaas_status', 'asaas_last_synced_at']) {
        const description = await queryInterface.describeTable('recorrencias', { transaction });
        if (description[column]) await queryInterface.removeColumn('recorrencias', column, { transaction });
      }
      await queryInterface.dropTable('asaas_webhook_eventos', { transaction });
      await queryInterface.dropTable('asaas_clientes', { transaction });
      await queryInterface.dropTable('asaas_integracoes', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
