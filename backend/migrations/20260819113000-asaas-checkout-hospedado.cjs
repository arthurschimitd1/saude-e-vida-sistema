'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const addColumnIfMissing = async (table, column, definition) => {
        const description = await queryInterface.describeTable(table, { transaction });
        if (!description[column]) await queryInterface.addColumn(table, column, definition, { transaction });
      };

      await addColumnIfMissing('asaas_integracoes', 'public_id', {
        type: Sequelize.STRING(80), allowNull: true
      });

      await queryInterface.sequelize.query(`
        UPDATE asaas_integracoes
        SET public_id = md5(random()::text || clock_timestamp()::text || id::text)
        WHERE public_id IS NULL`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_asaas_integracoes_public_id
        ON asaas_integracoes (public_id)`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS asaas_checkouts (
          id SERIAL PRIMARY KEY,
          public_id VARCHAR(80) NOT NULL UNIQUE,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          recorrencia_id INTEGER NOT NULL REFERENCES recorrencias(id) ON DELETE CASCADE,
          integration_id INTEGER NOT NULL REFERENCES asaas_integracoes(id) ON DELETE CASCADE,
          asaas_checkout_id VARCHAR(100) UNIQUE,
          asaas_customer_id VARCHAR(80),
          asaas_subscription_id VARCHAR(80),
          external_reference VARCHAR(200) NOT NULL,
          checkout_url TEXT,
          checkout_status VARCHAR(40) NOT NULL DEFAULT 'PROCESSANDO',
          subscription_status VARCHAR(40),
          cycle VARCHAR(30) NOT NULL,
          value NUMERIC(10,2) NOT NULL,
          next_due_date DATE NOT NULL,
          end_date DATE,
          expires_at TIMESTAMP,
          paid_at TIMESTAMP,
          canceled_at TIMESTAMP,
          request_id VARCHAR(120) NOT NULL,
          last_error_code VARCHAR(120),
          created_by INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_asaas_checkouts_intent
        ON asaas_checkouts (empresa_id, recorrencia_id, request_id)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_asaas_checkouts_recurrence
        ON asaas_checkouts (empresa_id, recorrencia_id, created_at DESC)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_asaas_checkouts_subscription
        ON asaas_checkouts (empresa_id, asaas_subscription_id)`, { transaction });

      await addColumnIfMissing('asaas_webhook_eventos', 'integration_id', {
        type: Sequelize.INTEGER, allowNull: true
      });
      await addColumnIfMissing('asaas_webhook_eventos', 'tipo_evento', {
        type: Sequelize.STRING(100), allowNull: true
      });
      await addColumnIfMissing('asaas_webhook_eventos', 'resource_id', {
        type: Sequelize.STRING(100), allowNull: true
      });
      await addColumnIfMissing('asaas_webhook_eventos', 'processamento_status', {
        type: Sequelize.STRING(30), allowNull: false, defaultValue: 'PROCESSADO'
      });
      await addColumnIfMissing('asaas_webhook_eventos', 'processado_em', {
        type: Sequelize.DATE, allowNull: true
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS asaas_checkouts', { transaction });
      for (const column of ['integration_id', 'tipo_evento', 'resource_id', 'processamento_status', 'processado_em']) {
        const description = await queryInterface.describeTable('asaas_webhook_eventos', { transaction });
        if (description[column]) await queryInterface.removeColumn('asaas_webhook_eventos', column, { transaction });
      }
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_asaas_integracoes_public_id', { transaction });
      const integrationDescription = await queryInterface.describeTable('asaas_integracoes', { transaction });
      if (integrationDescription.public_id) await queryInterface.removeColumn('asaas_integracoes', 'public_id', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
