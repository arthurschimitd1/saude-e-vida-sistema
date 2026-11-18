import { SALES_SQL, RECEIVABLES_SQL, OUTGOINGS_SQL, CUSTOMERS_SQL, PRODUCTS_SQL, STOCK_SQL, detalhesSQL } from './queries.js';

export class CentralGestaoRepository {
  constructor(database) { this.database = database; }

  async ler(context, periodo, callback) {
    if (!Number.isSafeInteger(context?.empresaId) || context.empresaId<=0) throw new Error('Contexto empresarial obrigatório');
    return this.database.transaction({ isolationLevel: 'REPEATABLE READ', readOnly: true }, async transaction => {
      // SET TRANSACTION também protege contra escrita em conexões/poolers que
      // não aplicam a opção readOnly do driver.
      await this.database.query('SET TRANSACTION READ ONLY', { transaction });
      await this.database.query("SET LOCAL statement_timeout = '5000ms'", { transaction });
      const replacements = { ...periodo, empresaId: context.empresaId };
      const query = async (sql, extra = {}) => {
        const rows = await this.database.query(sql, { replacements: { ...replacements, ...extra }, type: 'SELECT', transaction });
        return rows[0].dados;
      };
      return callback(query);
    });
  }

  async visaoGeral(context, periodo) {
    return this.ler(context, periodo, async query => {
      const result = {};
      // Seis consultas agregadas, sequenciais em uma conexão e snapshot.
      for (const [key, sql] of Object.entries({ vendas: SALES_SQL, recebiveis: RECEIVABLES_SQL, saidas: OUTGOINGS_SQL, clientes: CUSTOMERS_SQL, produtos: PRODUCTS_SQL, estoque: STOCK_SQL })) {
        result[key] = await query(sql);
      }
      return result;
    });
  }

  async detalhes(context, periodo, pagination) {
    return this.ler(context, periodo, async query => ({ ...await query(detalhesSQL(pagination.tipo), pagination), ...pagination }));
  }
}

