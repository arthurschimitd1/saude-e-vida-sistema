'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('lucromais:20260903110000-caixa-recorrencias-taxas'))`,
        { transaction },
      );

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS caixa_lancamentos (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id),
          turno_id INTEGER REFERENCES turnos_caixa(id),
          tipo VARCHAR(20) NOT NULL DEFAULT 'entrada',
          origem_tipo VARCHAR(40) NOT NULL,
          origem_id INTEGER NOT NULL,
          descricao VARCHAR(300) NOT NULL,
          valor NUMERIC(10,2) NOT NULL,
          forma_pagamento VARCHAR(40),
          data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          estornado_em TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS caixa_lancamentos_origem_unique
        ON caixa_lancamentos (empresa_id, origem_tipo, origem_id)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS taxas_cartao (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id),
          adquirente VARCHAR(100) NOT NULL,
          bandeira VARCHAR(40) NOT NULL,
          tipo_cartao VARCHAR(20) NOT NULL,
          parcelas_de INTEGER NOT NULL DEFAULT 1,
          parcelas_ate INTEGER NOT NULL DEFAULT 1,
          percentual NUMERIC(7,4) NOT NULL DEFAULT 0,
          taxa_fixa NUMERIC(10,2) NOT NULL DEFAULT 0,
          vigencia_inicio DATE NOT NULL,
          vigencia_fim DATE,
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT taxas_cartao_parcelas_check CHECK (parcelas_de > 0 AND parcelas_ate >= parcelas_de),
          CONSTRAINT taxas_cartao_valores_check CHECK (percentual >= 0 AND percentual <= 100 AND taxa_fixa >= 0)
        )
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS taxas_cartao_busca_idx
        ON taxas_cartao (empresa_id, bandeira, tipo_cartao, parcelas_de, parcelas_ate, ativo)
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE venda_itens
          ADD COLUMN IF NOT EXISTS catalogo_servico_id INTEGER REFERENCES services(id) ON DELETE SET NULL
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS venda_itens_catalogo_servico_idx
          ON venda_itens (catalogo_servico_id)
          WHERE catalogo_servico_id IS NOT NULL
      `, { transaction });

      // Bancos antigos podem conter duplicidades históricas. Elas não devem
      // impedir a inicialização da nova versão nem ser removidas sem auditoria.
      // Quando a base já está consistente, o índice reforça a idempotência.
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
              FROM comissoes
             GROUP BY venda_id, origem, COALESCE(servico_id, '')
            HAVING COUNT(*) > 1
          ) THEN
            CREATE UNIQUE INDEX IF NOT EXISTS comissoes_venda_origem_servico_unique
              ON comissoes (venda_id, origem, COALESCE(servico_id, ''));
          END IF;
        END $$
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS comissoes_venda_origem_servico_unique', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS venda_itens_catalogo_servico_idx', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE venda_itens DROP COLUMN IF EXISTS catalogo_servico_id', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS taxas_cartao', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS caixa_lancamentos', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
