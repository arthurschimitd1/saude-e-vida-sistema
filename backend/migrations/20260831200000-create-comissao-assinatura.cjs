'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comissao_assinatura_configuracoes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      percentual_pote: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 50 },
      faixas: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.createTable('comissao_assinatura_competencias', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }, empresa_id: { type: Sequelize.INTEGER, allowNull: false }, competencia: { type: Sequelize.STRING(7), allowNull: false },
      status: { type: Sequelize.ENUM('EM_ANDAMENTO', 'FECHADA', 'PAGA'), allowNull: false, defaultValue: 'EM_ANDAMENTO' },
      receita_assinaturas: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, valor_barbearia: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, valor_pote: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, assinantes_ativos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      percentual_pote_snapshot: { type: Sequelize.DECIMAL(5, 2), allowNull: false }, faixas_snapshot: { type: Sequelize.JSONB, allowNull: false },
      fechado_em: Sequelize.DATE, fechado_por: Sequelize.INTEGER, pago_em: Sequelize.DATE, pago_por: Sequelize.INTEGER,
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('comissao_assinatura_competencias', { fields: ['empresa_id', 'competencia'], type: 'unique', name: 'uq_comissao_assinatura_competencia' });
    await queryInterface.createTable('comissao_assinatura_itens', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }, empresa_id: { type: Sequelize.INTEGER, allowNull: false }, competencia_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'comissao_assinatura_competencias', key: 'id' }, onDelete: 'CASCADE' },
      atendimento_id: { type: Sequelize.INTEGER, allowNull: false }, recorrencia_id: { type: Sequelize.INTEGER, allowNull: false }, cliente_id: Sequelize.INTEGER, cliente_nome: { type: Sequelize.STRING, allowNull: false }, plano_nome: { type: Sequelize.STRING, allowNull: false }, servico_id: Sequelize.STRING, servico_nome: { type: Sequelize.STRING, allowNull: false }, profissional_id: { type: Sequelize.INTEGER, allowNull: false }, profissional_nome: { type: Sequelize.STRING, allowNull: false }, realizado_em: { type: Sequelize.DATE, allowNull: false }, minutos: { type: Sequelize.INTEGER, allowNull: false },
      valor_assinatura: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, valor_barbearia: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, valor_pote: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, faixa: Sequelize.STRING, peso: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 1 }, participacao: { type: Sequelize.DECIMAL(12, 8), allowNull: false, defaultValue: 0 }, comissao: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, tipo_atendimento: { type: Sequelize.STRING, allowNull: false, defaultValue: 'ASSINATURA' }, origem_comissao: { type: Sequelize.STRING, allowNull: false, defaultValue: 'POTE_ASSINATURA' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('comissao_assinatura_itens', { fields: ['empresa_id', 'atendimento_id'], type: 'unique', name: 'uq_comissao_assinatura_atendimento' });
    await queryInterface.addIndex('comissao_assinatura_itens', ['competencia_id', 'profissional_id'], { name: 'idx_comissao_assinatura_profissional' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('comissao_assinatura_itens');
    await queryInterface.dropTable('comissao_assinatura_competencias');
    await queryInterface.dropTable('comissao_assinatura_configuracoes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_comissao_assinatura_competencias_status";');
  },
};
