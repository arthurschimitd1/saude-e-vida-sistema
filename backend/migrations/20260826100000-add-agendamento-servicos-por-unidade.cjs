'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Em ambientes serverless, duas instâncias podem iniciar ao mesmo tempo.
      // O lock transacional serializa esta migration e evita corrida na criação
      // da tabela/índices sem bloquear o restante da aplicação.
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260826100000-agendamento-servicos-unidade'))`,
        { transaction },
      );

      const [regclassRows] = await queryInterface.sequelize.query(
        `SELECT to_regclass('agendamento_servico_unidades')::text AS tabela`,
        { transaction },
      );
      if (!regclassRows[0]?.tabela) {
        await queryInterface.createTable('agendamento_servico_unidades', {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          empresa_id: { type: Sequelize.INTEGER, allowNull: false },
          unidade_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'agendamento_unidades', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          servico_id: { type: Sequelize.STRING(80), allowNull: false },
          ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          duracao_min: { type: Sequelize.INTEGER, allowNull: true },
          preco: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          preco_texto: { type: Sequelize.STRING(200), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        }, { transaction });
      }

      const tabela = await queryInterface.describeTable('agendamento_servico_unidades', { transaction });

      const colunas = {
        ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        duracao_min: { type: Sequelize.INTEGER, allowNull: true },
        preco: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        preco_texto: { type: Sequelize.STRING(200), allowNull: true },
      };
      for (const [nome, definicao] of Object.entries(colunas)) {
        if (!tabela[nome]) await queryInterface.addColumn('agendamento_servico_unidades', nome, definicao, { transaction });
      }

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS agendamento_servico_unidades_empresa_unidade_servico_unique
         ON agendamento_servico_unidades (empresa_id, unidade_id, servico_id)`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS agendamento_servico_unidades_empresa_unidade_idx
         ON agendamento_servico_unidades (empresa_id, unidade_id)`,
        { transaction },
      );

      // O backfill só cria o vínculo; valores nulos significam "herdar o
      // cadastro-base". Portanto, serviços já existentes continuam iguais.
      await queryInterface.sequelize.query(
        `INSERT INTO agendamento_servico_unidades
          (empresa_id, unidade_id, servico_id, ativo, duracao_min, preco, preco_texto, created_at, updated_at)
         SELECT s.empresa_id, u.id, s.id, true, NULL, NULL, NULL, NOW(), NOW()
           FROM agendamento_servicos s
           JOIN agendamento_unidades u ON u.empresa_id = s.empresa_id AND u.ativa = true
          WHERE s.ativo = true
            AND NOT EXISTS (
              SELECT 1 FROM agendamento_servico_unidades su
               WHERE su.empresa_id = s.empresa_id
                 AND su.unidade_id = u.id
                 AND su.servico_id = s.id
            )`,
        { transaction },
      );

      const agendamentos = await queryInterface.describeTable('agendamentos');
      if (!agendamentos.servico_preco) {
        await queryInterface.addColumn('agendamentos', 'servico_preco', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        }, { transaction });
      }
      if (!agendamentos.servico_preco_texto) {
        await queryInterface.addColumn('agendamentos', 'servico_preco_texto', {
          type: Sequelize.STRING(200),
          allowNull: true,
        }, { transaction });
      }

      // Preserva nos registros antigos o preço vigente no momento da migração
      // quando houver preço numérico/textual no catálogo-base.
      await queryInterface.sequelize.query(
        `UPDATE agendamentos a
            SET servico_preco = CASE WHEN s.preco_texto IS NULL THEN s.preco ELSE NULL END,
                servico_preco_texto = s.preco_texto
           FROM agendamento_servicos s
          WHERE a.empresa_id = s.empresa_id
            AND a.servico_id = s.id
            AND a.servico_preco IS NULL
            AND a.servico_preco_texto IS NULL`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS agendamentos_empresa_servico_preco_idx
         ON agendamentos (empresa_id, servico_id)`,
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
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS agendamentos_empresa_servico_preco_idx', { transaction });
      const agendamentos = await queryInterface.describeTable('agendamentos');
      if (agendamentos.servico_preco_texto) await queryInterface.removeColumn('agendamentos', 'servico_preco_texto', { transaction });
      if (agendamentos.servico_preco) await queryInterface.removeColumn('agendamentos', 'servico_preco', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS agendamento_servico_unidades_empresa_unidade_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS agendamento_servico_unidades_empresa_unidade_servico_unique', { transaction });
      await queryInterface.dropTable('agendamento_servico_unidades', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
