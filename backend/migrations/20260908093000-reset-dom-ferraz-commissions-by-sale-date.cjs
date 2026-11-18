'use strict';

const migrationKey = 'lucromais:20260908093000-reset-dom-ferraz-commissions-by-sale-date';
const cutoff = '2026-09-08 00:00:00-03:00';
const backupTable = 'backup_comissoes_dom_ferraz_venda_20260908';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        'LOCK TABLE comissoes IN SHARE ROW EXCLUSIVE MODE',
        { transaction },
      );

      const [companies] = await queryInterface.sequelize.query(`
        SELECT id
          FROM empresas
         WHERE LOWER(nome) IN (
           LOWER('Dom Ferraz - Manaira'),
           LOWER('Dom Ferraz - Miramar'),
           LOWER('Dom Ferraz - Sapé')
         )
           AND arquivada_em IS NULL
         FOR UPDATE
      `, { transaction });
      if (companies.length === 0) {
        await transaction.commit();
        return;
      }
      if (companies.length !== 3) {
        throw new Error(`Reset cancelado: esperadas 3 unidades Dom Ferraz; encontradas ${companies.length}`);
      }

      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${backupTable} (
          origem VARCHAR(50) NOT NULL,
          registro_id INTEGER NOT NULL,
          empresa_id INTEGER NOT NULL,
          corte TIMESTAMPTZ NOT NULL,
          dados JSONB NOT NULL,
          salvo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (origem, registro_id)
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO ${backupTable} (origem, registro_id, empresa_id, corte, dados)
        SELECT 'comissoes', c.id, c.empresa_id, TIMESTAMPTZ '${cutoff}', TO_JSONB(c)
          FROM comissoes c
          JOIN vendas v ON v.id = c.venda_id
          JOIN empresas e ON e.id = c.empresa_id
         WHERE LOWER(e.nome) IN (
           LOWER('Dom Ferraz - Manaira'),
           LOWER('Dom Ferraz - Miramar'),
           LOWER('Dom Ferraz - Sapé')
         )
           AND v.data < TIMESTAMPTZ '${cutoff}'
        ON CONFLICT (origem, registro_id) DO NOTHING
      `, { transaction });

      const [sourceRows] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::integer AS quantidade
          FROM comissoes c
          JOIN vendas v ON v.id = c.venda_id
          JOIN empresas e ON e.id = c.empresa_id
         WHERE LOWER(e.nome) IN (
           LOWER('Dom Ferraz - Manaira'),
           LOWER('Dom Ferraz - Miramar'),
           LOWER('Dom Ferraz - Sapé')
         )
           AND v.data < TIMESTAMPTZ '${cutoff}'
      `, { transaction });
      const [backupRows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*)::integer AS quantidade FROM ${backupTable} WHERE origem = 'comissoes'`,
        { transaction },
      );
      if (Number(sourceRows[0].quantidade) !== Number(backupRows[0].quantidade)) {
        throw new Error('Reset cancelado: backup por data da venda ficou incompleto');
      }

      await queryInterface.sequelize.query(`
        DELETE FROM comissoes c
         USING empresas e, vendas v
         WHERE e.id = c.empresa_id
           AND v.id = c.venda_id
           AND LOWER(e.nome) IN (
             LOWER('Dom Ferraz - Manaira'),
             LOWER('Dom Ferraz - Miramar'),
             LOWER('Dom Ferraz - Sapé')
           )
           AND v.data < TIMESTAMPTZ '${cutoff}'
      `, { transaction });

      const [remainingRows] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::integer AS quantidade
          FROM comissoes c
          JOIN vendas v ON v.id = c.venda_id
          JOIN empresas e ON e.id = c.empresa_id
         WHERE LOWER(e.nome) IN (
           LOWER('Dom Ferraz - Manaira'),
           LOWER('Dom Ferraz - Miramar'),
           LOWER('Dom Ferraz - Sapé')
         )
           AND v.data < TIMESTAMPTZ '${cutoff}'
      `, { transaction });
      if (Number(remainingRows[0].quantidade) !== 0) {
        throw new Error('Reset cancelado: ainda existem comissões de vendas anteriores ao corte');
      }

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
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );
      await queryInterface.sequelize.query(`
        INSERT INTO comissoes
        SELECT (JSONB_POPULATE_RECORD(NULL::comissoes, dados)).*
          FROM ${backupTable}
         WHERE origem = 'comissoes'
        ON CONFLICT (id) DO NOTHING
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
