'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('comissao_servicos')) {
      await queryInterface.createTable('comissao_servicos', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        empresa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'id' }, onDelete: 'CASCADE' },
        funcionario_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        servico_nome: { type: Sequelize.STRING(200), allowNull: false },
        servico_chave: { type: Sequelize.STRING(200), allowNull: false },
        percentual: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      });
    }
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'comissao_servicos_empresa_funcionario_servico_unique'
    `);
    if (!constraints.length) {
      await queryInterface.addConstraint('comissao_servicos', {
        fields: ['empresa_id', 'funcionario_id', 'servico_chave'],
        type: 'unique',
        name: 'comissao_servicos_empresa_funcionario_servico_unique'
      });
    }
    const columns = await queryInterface.describeTable('comissoes');
    if (!columns.origem_calculo) {
      await queryInterface.addColumn('comissoes', 'origem_calculo', {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'colaborador'
      });
    }
    if (!columns.detalhes_calculo) {
      await queryInterface.addColumn('comissoes', 'detalhes_calculo', {
        type: Sequelize.JSONB, allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('comissoes');
    if (columns.detalhes_calculo) await queryInterface.removeColumn('comissoes', 'detalhes_calculo');
    if (columns.origem_calculo) await queryInterface.removeColumn('comissoes', 'origem_calculo');
    const tables = await queryInterface.showAllTables();
    if (tables.includes('comissao_servicos')) await queryInterface.dropTable('comissao_servicos');
  }
};
