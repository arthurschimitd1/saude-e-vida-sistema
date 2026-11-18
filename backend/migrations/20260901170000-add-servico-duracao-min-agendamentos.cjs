'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260901170000-agendamentos-duracao'))`,
        { transaction },
      );

      const tabela = await queryInterface.describeTable('agendamentos', { transaction });
      if (!tabela.servico_duracao_min) {
        await queryInterface.addColumn('agendamentos', 'servico_duracao_min', {
          type: Sequelize.INTEGER,
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        UPDATE agendamentos AS ag
           SET servico_duracao_min = COALESCE(
             (
               SELECT unidade.duracao_min
                 FROM agendamento_servico_unidades AS unidade
                WHERE unidade.empresa_id = ag.empresa_id
                  AND unidade.unidade_id = ag.unidade_id
                  AND unidade.servico_id = ag.servico_id
                LIMIT 1
             ),
             (
               SELECT servico.duracao_min
                 FROM agendamento_servicos AS servico
                WHERE servico.empresa_id = ag.empresa_id
                  AND servico.id = ag.servico_id
                LIMIT 1
             ),
             30
           )
         WHERE ag.servico_duracao_min IS NULL
           AND ag.servico_id IS NOT NULL
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const tabela = await queryInterface.describeTable('agendamentos');
    if (tabela.servico_duracao_min) {
      await queryInterface.removeColumn('agendamentos', 'servico_duracao_min');
    }
  },
};
