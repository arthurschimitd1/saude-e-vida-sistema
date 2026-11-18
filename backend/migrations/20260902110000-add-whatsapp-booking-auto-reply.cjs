'use strict';

const CONFIG_PADRAO = JSON.stringify({
  ativa: false,
  mensagem: 'Olá! Para escolher a unidade, o profissional, os serviços e o melhor horário, faça seu agendamento por aqui:\n{{link}}',
  cooldown_horas: 168,
});

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const transaction = await q.transaction();
    try {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260902110000-whatsapp-booking-auto-reply'))`,
        { transaction },
      );
      await q.query(`
        ALTER TABLE whatsapp_config
        ADD COLUMN IF NOT EXISTS automacao_agendamento JSONB NOT NULL
        DEFAULT '${CONFIG_PADRAO.replace(/'/g, "''")}'::jsonb
      `, { transaction });
      await q.query(`
        ALTER TABLE whatsapp_conversas
        ADD COLUMN IF NOT EXISTS resposta_agendamento_em TIMESTAMPTZ
      `, { transaction });
      await q.query(`
        ALTER TABLE whatsapp_mensagens
        ADD COLUMN IF NOT EXISTS origem VARCHAR(50)
      `, { transaction });
      await q.query(`
        CREATE INDEX IF NOT EXISTS wa_mensagens_origem_idx
        ON whatsapp_mensagens (empresa_id, conversa_id, origem, criado_em DESC)
        WHERE origem IS NOT NULL
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    const transaction = await q.transaction();
    try {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260902110000-whatsapp-booking-auto-reply'))`,
        { transaction },
      );
      await q.query('DROP INDEX IF EXISTS wa_mensagens_origem_idx', { transaction });
      await q.query('ALTER TABLE whatsapp_mensagens DROP COLUMN IF EXISTS origem', { transaction });
      await q.query('ALTER TABLE whatsapp_conversas DROP COLUMN IF EXISTS resposta_agendamento_em', { transaction });
      await q.query('ALTER TABLE whatsapp_config DROP COLUMN IF EXISTS automacao_agendamento', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
