'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('agendamento_bloqueios');

    if (!table.hora_inicio) {
      await queryInterface.addColumn('agendamento_bloqueios', 'hora_inicio', {
        type: Sequelize.TIME,
        allowNull: true,
      });
    }

    if (!table.hora_fim) {
      await queryInterface.addColumn('agendamento_bloqueios', 'hora_fim', {
        type: Sequelize.TIME,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('agendamento_bloqueios');
    if (table.hora_fim) await queryInterface.removeColumn('agendamento_bloqueios', 'hora_fim');
    if (table.hora_inicio) await queryInterface.removeColumn('agendamento_bloqueios', 'hora_inicio');
  },
};
