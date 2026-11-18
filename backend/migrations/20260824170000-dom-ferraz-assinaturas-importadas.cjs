'use strict';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS assinatura_planos_importados (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          nome VARCHAR(200) NOT NULL,
          nome_normalizado VARCHAR(200) NOT NULL,
          dia_vencimento VARCHAR(80),
          periodicidade VARCHAR(40),
          valor DECIMAL(12,2) NOT NULL DEFAULT 0,
          tipo VARCHAR(80),
          origem VARCHAR(80) NOT NULL DEFAULT 'AppBarber',
          origem_linha INTEGER,
          metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, origem, origem_linha)
        )`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS assinatura_assinantes_importados (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
          plano_id INTEGER REFERENCES assinatura_planos_importados(id) ON DELETE SET NULL,
          nome VARCHAR(200) NOT NULL,
          plano_original VARCHAR(200) NOT NULL,
          plano_normalizado VARCHAR(200) NOT NULL,
          contratacao DATE,
          proximo_vencimento DATE,
          status VARCHAR(50),
          celular VARCHAR(40),
          celular_normalizado VARCHAR(20),
          email VARCHAR(200),
          origem VARCHAR(80) NOT NULL DEFAULT 'AppBarber',
          origem_linha INTEGER,
          situacao_importacao VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_MAPEAMENTO',
          metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (empresa_id, origem, origem_linha)
        )`, { transaction });

      // Rollout aditivo para instalações que já possuíam uma tabela parcial.
      await queryInterface.sequelize.query(`
        ALTER TABLE assinatura_planos_importados
          ADD COLUMN IF NOT EXISTS nome_normalizado VARCHAR(200),
          ADD COLUMN IF NOT EXISTS dia_vencimento VARCHAR(80),
          ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(40),
          ADD COLUMN IF NOT EXISTS valor DECIMAL(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS tipo VARCHAR(80),
          ADD COLUMN IF NOT EXISTS origem VARCHAR(80) DEFAULT 'AppBarber',
          ADD COLUMN IF NOT EXISTS origem_linha INTEGER,
          ADD COLUMN IF NOT EXISTS metadados JSONB DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE assinatura_assinantes_importados
          ADD COLUMN IF NOT EXISTS nome_normalizado VARCHAR(200),
          ADD COLUMN IF NOT EXISTS plano_original VARCHAR(200),
          ADD COLUMN IF NOT EXISTS plano_normalizado VARCHAR(200),
          ADD COLUMN IF NOT EXISTS contratacao DATE,
          ADD COLUMN IF NOT EXISTS proximo_vencimento DATE,
          ADD COLUMN IF NOT EXISTS status VARCHAR(50),
          ADD COLUMN IF NOT EXISTS celular VARCHAR(40),
          ADD COLUMN IF NOT EXISTS celular_normalizado VARCHAR(20),
          ADD COLUMN IF NOT EXISTS email VARCHAR(200),
          ADD COLUMN IF NOT EXISTS origem VARCHAR(80) DEFAULT 'AppBarber',
          ADD COLUMN IF NOT EXISTS origem_linha INTEGER,
          ADD COLUMN IF NOT EXISTS situacao_importacao VARCHAR(40) DEFAULT 'PENDENTE_MAPEAMENTO',
          ADD COLUMN IF NOT EXISTS metadados JSONB DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE assinatura_planos_importados
        SET nome_normalizado = LOWER(TRIM(nome))
        WHERE nome_normalizado IS NULL AND nome IS NOT NULL`, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE assinatura_assinantes_importados
        SET plano_normalizado = LOWER(TRIM(plano_original))
        WHERE plano_normalizado IS NULL AND plano_original IS NOT NULL`, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS assinatura_planos_importados_empresa_idx
        ON assinatura_planos_importados (empresa_id, nome_normalizado)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS assinatura_assinantes_importados_empresa_idx
        ON assinatura_assinantes_importados (empresa_id, status, proximo_vencimento)`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS assinatura_assinantes_importados_cliente_idx
        ON assinatura_assinantes_importados (empresa_id, cliente_id)`, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS assinatura_assinantes_importados', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS assinatura_planos_importados', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
