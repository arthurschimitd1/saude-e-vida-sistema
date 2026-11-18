'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901090000-agendamento-configuracoes'))`,
        { transaction },
      );

      const [rows] = await queryInterface.sequelize.query(
        `SELECT to_regclass('agendamento_configuracoes')::text AS tabela`,
        { transaction },
      );
      if (!rows[0]?.tabela) {
        await queryInterface.createTable('agendamento_configuracoes', {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          empresa_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'empresas', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          hora_inicio: { type: Sequelize.TIME, allowNull: false },
          hora_fim: { type: Sequelize.TIME, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        }, { transaction });
      }

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS agendamento_configuracoes_empresa_unique
         ON agendamento_configuracoes (empresa_id)`,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS agendamento_configuracoes_empresa_unique',
        { transaction },
      );
      await queryInterface.dropTable('agendamento_configuracoes', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
