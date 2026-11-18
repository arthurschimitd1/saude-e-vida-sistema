'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const addColumnIfMissing = async (table, column, definition) => {
        const description = await queryInterface.describeTable(table, { transaction });
        if (!description[column]) await queryInterface.addColumn(table, column, definition, { transaction });
      };

      await addColumnIfMissing('recorrencias', 'status_recorrencia', {
        type: Sequelize.STRING(30), allowNull: false, defaultValue: 'ATIVA'
      });
      await addColumnIfMissing('recorrencias', 'asaas_subscription_status', {
        type: Sequelize.STRING(50), allowNull: true
      });
      await addColumnIfMissing('recorrencias', 'asaas_sync_status', {
        type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NAO_CONFIGURADO'
      });
      await addColumnIfMissing('recorrencias', 'asaas_sync_error', {
        type: Sequelize.TEXT, allowNull: true
      });

      await addColumnIfMissing('historico_pagamentos', 'asaas_refund_status', {
        type: Sequelize.STRING(40), allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'asaas_refunded_value', {
        type: Sequelize.DECIMAL(10, 2), allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'asaas_billing_type', {
        type: Sequelize.STRING(40), allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'asaas_payment_payload', {
        type: Sequelize.JSONB, allowNull: true
      });
      await addColumnIfMissing('historico_pagamentos', 'recibo_emitido_at', {
        type: Sequelize.DATE, allowNull: true
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE historico_pagamentos
        ALTER COLUMN status TYPE VARCHAR(40)
        USING status::text`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS recorrencia_configuracoes (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
          forma_pagamento_padrao VARCHAR(40) NOT NULL DEFAULT 'PIX',
          banco_recebimento VARCHAR(120),
          banco_nome VARCHAR(120),
          banco_agencia VARCHAR(40),
          banco_conta VARCHAR(80),
          banco_pix VARCHAR(180),
          juros NUMERIC(10,2) NOT NULL DEFAULT 0,
          multa NUMERIC(10,2) NOT NULL DEFAULT 0,
          desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
          dias_antecedencia INTEGER NOT NULL DEFAULT 0,
          recibo_nome_empresa VARCHAR(255),
          recibo_documento VARCHAR(40),
          recibo_endereco TEXT,
          recibo_telefone VARCHAR(40),
          recibo_rodape TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS recorrencia_planos (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          nome VARCHAR(160) NOT NULL,
          descricao TEXT,
          valor NUMERIC(10,2) NOT NULL,
          periodicidade VARCHAR(30) NOT NULL DEFAULT 'MENSAL',
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, nome)
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS recorrencia_auditoria (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          recorrencia_id INTEGER REFERENCES recorrencias(id) ON DELETE SET NULL,
          historico_pagamento_id INTEGER REFERENCES historico_pagamentos(id) ON DELETE SET NULL,
          usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          acao VARCHAR(80) NOT NULL,
          status_anterior VARCHAR(60),
          status_novo VARCHAR(60),
          evento_asaas VARCHAR(100),
          resposta_asaas JSONB,
          detalhes JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`, { transaction });

      await addColumnIfMissing('asaas_webhook_eventos', 'payload', {
        type: Sequelize.JSONB, allowNull: true
      });
      await addColumnIfMissing('asaas_webhook_eventos', 'erro_processamento', {
        type: Sequelize.TEXT, allowNull: true
      });

      await queryInterface.sequelize.query(`
        UPDATE recorrencias
        SET status_recorrencia = CASE WHEN ativo THEN 'ATIVA' ELSE 'PAUSADA' END
        WHERE status_recorrencia IS NULL OR status_recorrencia = ''`, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE recorrencias
        SET asaas_sync_status = CASE WHEN asaas_subscription_id IS NOT NULL THEN 'SINCRONIZADO' ELSE 'NAO_CONFIGURADO' END
        WHERE asaas_sync_status IS NULL OR asaas_sync_status = ''`, { transaction });

      await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_recorrencia_config_empresa ON recorrencia_configuracoes (empresa_id)`, { transaction });
      await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_recorrencia_planos_empresa_ativo ON recorrencia_planos (empresa_id, ativo)`, { transaction });
      await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_recorrencia_auditoria_empresa_created ON recorrencia_auditoria (empresa_id, created_at DESC)`, { transaction });
      await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS idx_recorrencia_auditoria_recorrencia ON recorrencia_auditoria (empresa_id, recorrencia_id, created_at DESC)`, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS recorrencia_auditoria', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS recorrencia_planos', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS recorrencia_configuracoes', { transaction });
      for (const column of ['payload', 'erro_processamento']) {
        const description = await queryInterface.describeTable('asaas_webhook_eventos', { transaction });
        if (description[column]) await queryInterface.removeColumn('asaas_webhook_eventos', column, { transaction });
      }
      for (const column of ['recibo_emitido_at', 'asaas_payment_payload', 'asaas_billing_type', 'asaas_refunded_value', 'asaas_refund_status']) {
        const description = await queryInterface.describeTable('historico_pagamentos', { transaction });
        if (description[column]) await queryInterface.removeColumn('historico_pagamentos', column, { transaction });
      }
      for (const column of ['asaas_sync_error', 'asaas_sync_status', 'asaas_subscription_status', 'status_recorrencia']) {
        const description = await queryInterface.describeTable('recorrencias', { transaction });
        if (description[column]) await queryInterface.removeColumn('recorrencias', column, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
