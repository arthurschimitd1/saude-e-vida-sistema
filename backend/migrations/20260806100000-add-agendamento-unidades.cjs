'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agendamento_unidades', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false },
      nome: { type: Sequelize.STRING(150), allowNull: false },
      endereco: { type: Sequelize.STRING(300), allowNull: true },
      telefone: { type: Sequelize.STRING(30), allowNull: true },
      ativa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      principal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('agendamento_unidades', ['empresa_id', 'nome'], { unique: true, name: 'agendamento_unidades_empresa_nome_unique' });
    await queryInterface.addColumn('agendamento_colaboradores', 'unidade_id', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'agendamento_unidades', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('agendamentos', 'unidade_id', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'agendamento_unidades', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('agendamento_colaboradores', ['empresa_id', 'unidade_id']);
    await queryInterface.addIndex('agendamentos', ['empresa_id', 'unidade_id', 'data']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agendamentos', 'unidade_id');
    await queryInterface.removeColumn('agendamento_colaboradores', 'unidade_id');
    await queryInterface.dropTable('agendamento_unidades');
  },
};
