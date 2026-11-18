import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MODULE_CASE = `
  CASE
    WHEN route LIKE '/uikit/formlayout%' OR route LIKE '/uikit/overlay%' THEN 'Estoque'
    WHEN route LIKE '/uikit/producao%' THEN 'Produção'
    WHEN route LIKE '/uikit/agendamentos%' THEN 'Agenda'
    WHEN route LIKE '/uikit/input%' THEN 'Caixa'
    WHEN route LIKE '/uikit/crm%' THEN 'CRM / RFM'
    WHEN route LIKE '/uikit/automacao-whatsapp%' OR route LIKE '/uikit/prospeccao%' THEN 'CRM Comercial'
    WHEN route LIKE '/uikit/servicos-nfe%' OR route LIKE '/uikit/servicos-nfce%'
      OR route LIKE '/uikit/historico-notas%' OR route LIKE '/uikit/manifestos%' THEN 'Fiscal'
    WHEN route LIKE '/financeiro%' OR route LIKE '/uikit/list%' OR route LIKE '/uikit/comissoes%' THEN 'Financeiro'
    WHEN route LIKE '/uikit/pedidos%' THEN 'Pedidos'
    ELSE 'Outros'
  END
`;

const asNumber = value => Number(value || 0);

const normalizeFilters = filters => {
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(filters.endDate || ''))
    ? filters.endDate
    : new Date().toISOString().slice(0, 10);
  const requestedDays = Math.min(Math.max(Number(filters.days) || 30, 7), 365);
  const defaultStart = new Date(`${endDate}T12:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - requestedDays + 1);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(filters.startDate || ''))
    ? filters.startDate
    : defaultStart.toISOString().slice(0, 10);
  const companyId = filters.companyId && filters.companyId !== 'all'
    ? Number(filters.companyId)
    : null;

  if (companyId !== null && (!Number.isInteger(companyId) || companyId <= 0)) {
    const error = new Error('Empresa inválida');
    error.status = 400;
    throw error;
  }

  if (startDate > endDate) {
    const error = new Error('A data inicial não pode ser posterior à data final');
    error.status = 400;
    throw error;
  }

  return {
    startDate,
    endDate,
    companyId,
    packageName: String(filters.packageName || '').trim().slice(0, 80) || null
  };
};

const companyFilter = alias => `
  (:companyId IS NULL OR ${alias}.id = :companyId)
  AND (:packageName IS NULL OR COALESCE(${alias}.pacote, 'sem_pacote') = :packageName)
`;

class MasterAnalyticsService {
  static async getOverview(rawFilters = {}) {
    const filters = normalizeFilters(rawFilters);
    const replacements = filters;

    const [summaryRows, trendRows, moduleRows, packageRows, riskRows, activationRows] = await Promise.all([
      sequelize.query(`
        WITH usage_last AS (
          SELECT empresa_id, MAX(last_visited_at) AS last_use
          FROM empresa_usage_daily
          WHERE usage_date <= CAST(:endDate AS date)
          GROUP BY empresa_id
        ), value_last AS (
          SELECT empresa_id, MAX(event_at) AS last_value
          FROM (
            SELECT empresa_id, data AS event_at FROM vendas
            UNION ALL SELECT empresa_id, created_at FROM clientes
            UNION ALL SELECT empresa_id, created_at FROM agendamentos
            UNION ALL SELECT empresa_id, created_at FROM notas_fiscais_emitidas
          ) events
          WHERE empresa_id IS NOT NULL AND event_at::date <= CAST(:endDate AS date)
          GROUP BY empresa_id
        ), period_sales AS (
          SELECT empresa_id, COUNT(*)::int AS sales_count,
                 COALESCE(SUM(valor_total), 0)::numeric AS volume,
                 COALESCE(AVG(valor_total), 0)::numeric AS avg_ticket
          FROM vendas
          WHERE data::date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
          GROUP BY empresa_id
        )
        SELECT
          COUNT(*)::int AS total_companies,
          COUNT(*) FILTER (WHERE e.arquivada_em IS NULL)::int AS available_companies,
          COUNT(*) FILTER (WHERE e.arquivada_em IS NOT NULL)::int AS archived_companies,
          COUNT(*) FILTER (WHERE e.arquivada_em IS NULL AND GREATEST(u.last_use, v.last_value) >= CAST(:endDate AS date) - INTERVAL '29 days')::int AS active_30,
          COUNT(*) FILTER (WHERE e.arquivada_em IS NULL AND (GREATEST(u.last_use, v.last_value) < CAST(:endDate AS date) - INTERVAL '20 days' OR GREATEST(u.last_use, v.last_value) IS NULL))::int AS high_risk,
          COALESCE(SUM(s.volume), 0)::numeric AS business_volume,
          COALESCE(SUM(s.sales_count), 0)::int AS sales_count,
          CASE WHEN COALESCE(SUM(s.sales_count), 0) = 0 THEN 0
               ELSE COALESCE(SUM(s.volume), 0) / SUM(s.sales_count) END::numeric AS avg_ticket
        FROM empresas e
        LEFT JOIN usage_last u ON u.empresa_id = e.id
        LEFT JOIN value_last v ON v.empresa_id = e.id
        LEFT JOIN period_sales s ON s.empresa_id = e.id
        WHERE ${companyFilter('e')}
      `, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CAST(:startDate AS date)),
            date_trunc('month', CAST(:endDate AS date)),
            INTERVAL '1 month'
          )::date AS month
        ), sales AS (
          SELECT date_trunc('month', v.data)::date AS month,
                 COALESCE(SUM(v.valor_total), 0)::numeric AS volume,
                 COUNT(*)::int AS sales
          FROM vendas v JOIN empresas e ON e.id = v.empresa_id
          WHERE v.data::date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
            AND ${companyFilter('e')}
          GROUP BY 1
        ), usage AS (
          SELECT date_trunc('month', u.usage_date)::date AS month,
                 SUM(u.visit_count)::int AS visits,
                 COUNT(DISTINCT u.empresa_id)::int AS active_companies
          FROM empresa_usage_daily u JOIN empresas e ON e.id = u.empresa_id
          WHERE u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
            AND ${companyFilter('e')}
          GROUP BY 1
        )
        SELECT m.month, COALESCE(s.volume, 0)::numeric AS volume,
               COALESCE(s.sales, 0)::int AS sales, COALESCE(u.visits, 0)::int AS visits,
               COALESCE(u.active_companies, 0)::int AS active_companies
        FROM months m LEFT JOIN sales s USING (month) LEFT JOIN usage u USING (month)
        ORDER BY m.month
      `, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(`
        SELECT ${MODULE_CASE} AS module, SUM(u.visit_count)::int AS visits,
               COUNT(DISTINCT u.empresa_id)::int AS companies
        FROM empresa_usage_daily u JOIN empresas e ON e.id = u.empresa_id
        WHERE u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
          AND ${companyFilter('e')}
        GROUP BY 1 ORDER BY visits DESC
      `, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(`
        SELECT COALESCE(e.pacote, 'sem_pacote') AS package, COUNT(*)::int AS companies
        FROM empresas e WHERE ${companyFilter('e')}
        GROUP BY 1 ORDER BY companies DESC
      `, { replacements, type: QueryTypes.SELECT }),
      this.getChurnRisk({ ...rawFilters, limit: 8, page: 1 }),
      sequelize.query(`
        WITH companies AS (
          SELECT e.id FROM empresas e WHERE e.arquivada_em IS NULL AND ${companyFilter('e')}
        ), usage AS (
          SELECT empresa_id, MIN(last_visited_at) AS first_access,
                 COUNT(DISTINCT usage_date) FILTER (WHERE usage_date BETWEEN CAST(:endDate AS date) - INTERVAL '29 days' AND CAST(:endDate AS date)) AS active_days
          FROM empresa_usage_daily
          WHERE usage_date <= CAST(:endDate AS date)
          GROUP BY empresa_id
        ), clients AS (
          SELECT empresa_id, MIN(created_at) AS first_client
          FROM clientes WHERE created_at::date <= CAST(:endDate AS date) GROUP BY empresa_id
        ), sales AS (
          SELECT empresa_id, MIN(data) AS first_sale
          FROM vendas WHERE data::date <= CAST(:endDate AS date) GROUP BY empresa_id
        )
        SELECT COUNT(*)::int AS registered,
          COUNT(*) FILTER (WHERE u.first_access IS NOT NULL)::int AS first_access,
          COUNT(*) FILTER (WHERE c.first_client IS NOT NULL)::int AS first_client,
          COUNT(*) FILTER (WHERE s.first_sale IS NOT NULL)::int AS first_sale,
          COUNT(*) FILTER (WHERE u.active_days >= 4)::int AS recurring_use
        FROM companies co
        LEFT JOIN usage u ON u.empresa_id = co.id
        LEFT JOIN clients c ON c.empresa_id = co.id
        LEFT JOIN sales s ON s.empresa_id = co.id
      `, { replacements, type: QueryTypes.SELECT })
    ]);

    const summary = summaryRows[0] || {};
    return {
      filters,
      definitions: {
        activeCompany: 'Uso ou ação de valor nos últimos 30 dias',
        highRisk: 'Sem uso ou ação de valor há mais de 21 dias',
        businessVolume: 'Valor transacionado pelos clientes dentro do Lucro+, não receita de assinatura'
      },
      summary: {
        totalCompanies: asNumber(summary.total_companies),
        availableCompanies: asNumber(summary.available_companies),
        archivedCompanies: asNumber(summary.archived_companies),
        active30: asNumber(summary.active_30),
        highRisk: asNumber(summary.high_risk),
        businessVolume: asNumber(summary.business_volume),
        salesCount: asNumber(summary.sales_count),
        averageTicket: asNumber(summary.avg_ticket)
      },
      trend: trendRows.map(row => ({ ...row, volume: asNumber(row.volume), sales: asNumber(row.sales), visits: asNumber(row.visits), activeCompanies: asNumber(row.active_companies) })),
      modules: moduleRows.map(row => ({ module: row.module, visits: asNumber(row.visits), companies: asNumber(row.companies) })),
      packages: packageRows.map(row => ({ package: row.package, companies: asNumber(row.companies) })),
      risks: riskRows.items,
      activation: Object.fromEntries(Object.entries(activationRows[0] || {}).map(([key, value]) => [key, asNumber(value)]))
    };
  }

  static async getRevenue(rawFilters = {}) {
    const filters = normalizeFilters(rawFilters);
    const rows = await sequelize.query(`
      SELECT date_trunc('month', v.data)::date AS month,
             COUNT(*)::int AS sales,
             COALESCE(SUM(v.valor_total), 0)::numeric AS volume,
             COALESCE(AVG(v.valor_total), 0)::numeric AS average_ticket
      FROM vendas v JOIN empresas e ON e.id = v.empresa_id
      WHERE v.data::date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
        AND ${companyFilter('e')}
      GROUP BY 1 ORDER BY 1
    `, { replacements: filters, type: QueryTypes.SELECT });

    const paymentMethods = await sequelize.query(`
      SELECT COALESCE(NULLIF(v.forma_pagamento, ''), 'Não informado') AS method,
             COUNT(*)::int AS sales, COALESCE(SUM(v.valor_total), 0)::numeric AS volume
      FROM vendas v JOIN empresas e ON e.id = v.empresa_id
      WHERE v.data::date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
        AND ${companyFilter('e')}
      GROUP BY 1 ORDER BY volume DESC
    `, { replacements: filters, type: QueryTypes.SELECT });

    return {
      filters,
      metricScope: 'customer_operations',
      notice: 'Estes valores representam vendas operadas pelos clientes no Lucro+, não mensalidades do SaaS.',
      monthly: rows.map(row => ({ ...row, sales: asNumber(row.sales), volume: asNumber(row.volume), averageTicket: asNumber(row.average_ticket) })),
      paymentMethods: paymentMethods.map(row => ({ method: row.method, sales: asNumber(row.sales), volume: asNumber(row.volume) }))
    };
  }

  static async getRetention(rawFilters = {}) {
    const filters = normalizeFilters(rawFilters);
    const activity = await sequelize.query(`
      WITH usage AS (
        SELECT empresa_id, MAX(last_visited_at) AS last_use
        FROM empresa_usage_daily WHERE usage_date <= CAST(:endDate AS date) GROUP BY empresa_id
      ), sales AS (
        SELECT empresa_id, MAX(data) AS last_sale
        FROM vendas WHERE data::date <= CAST(:endDate AS date) GROUP BY empresa_id
      ), last_activity AS (
        SELECT e.id, GREATEST(u.last_use, v.last_sale) AS last_activity
        FROM empresas e
        LEFT JOIN usage u ON u.empresa_id = e.id
        LEFT JOIN sales v ON v.empresa_id = e.id
        WHERE e.arquivada_em IS NULL AND ${companyFilter('e')}
      )
      SELECT COUNT(*)::int AS eligible,
        COUNT(*) FILTER (WHERE last_activity >= CAST(:endDate AS date) - INTERVAL '6 days')::int AS active_7,
        COUNT(*) FILTER (WHERE last_activity >= CAST(:endDate AS date) - INTERVAL '29 days')::int AS active_30,
        COUNT(*) FILTER (WHERE last_activity >= CAST(:endDate AS date) - INTERVAL '89 days')::int AS active_90
      FROM last_activity
    `, { replacements: filters, type: QueryTypes.SELECT });

    const cohorts = await sequelize.query(`
      WITH registrations AS (
        SELECT e.id, date_trunc('month', MIN(u.created_at))::date AS cohort_month
        FROM empresas e LEFT JOIN users u ON u.empresa_id = e.id
        WHERE ${companyFilter('e')}
        GROUP BY e.id
      ), recent AS (
        SELECT empresa_id, MAX(last_visited_at) AS last_use
        FROM empresa_usage_daily WHERE usage_date <= CAST(:endDate AS date) GROUP BY empresa_id
      )
      SELECT r.cohort_month, COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE a.last_use >= CAST(:endDate AS date) - INTERVAL '29 days')::int AS retained_30
      FROM registrations r LEFT JOIN recent a ON a.empresa_id = r.id
      WHERE r.cohort_month IS NOT NULL
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12
    `, { replacements: filters, type: QueryTypes.SELECT });

    return {
      filters,
      activity: Object.fromEntries(Object.entries(activity[0] || {}).map(([key, value]) => [key, asNumber(value)])),
      cohorts: cohorts.map(row => ({ month: row.cohort_month, companies: asNumber(row.companies), retained30: asNumber(row.retained_30), rate30: asNumber(row.companies) ? Math.round(asNumber(row.retained_30) * 1000 / asNumber(row.companies)) / 10 : 0 }))
    };
  }

  static async getChurnRisk(rawFilters = {}) {
    const filters = normalizeFilters(rawFilters);
    const page = Math.max(Number(rawFilters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(rawFilters.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const risk = rawFilters.risk && ['high', 'medium', 'low', 'archived'].includes(rawFilters.risk) ? rawFilters.risk : null;
    const search = String(rawFilters.search || '').trim().slice(0, 100) || null;
    const replacements = { ...filters, limit, offset, risk, search };

    const base = `
      WITH usage AS (
        SELECT empresa_id, MAX(last_visited_at) AS last_use,
          SUM(visit_count) FILTER (WHERE usage_date BETWEEN CAST(:endDate AS date) - INTERVAL '29 days' AND CAST(:endDate AS date))::int AS current_visits,
          SUM(visit_count) FILTER (WHERE usage_date BETWEEN CAST(:endDate AS date) - INTERVAL '59 days' AND CAST(:endDate AS date) - INTERVAL '30 days')::int AS previous_visits,
          COUNT(DISTINCT (${MODULE_CASE})) FILTER (WHERE usage_date BETWEEN CAST(:endDate AS date) - INTERVAL '29 days' AND CAST(:endDate AS date))::int AS modules_used
        FROM empresa_usage_daily
        WHERE usage_date <= CAST(:endDate AS date)
        GROUP BY empresa_id
      ), sales AS (
        SELECT empresa_id, MAX(data) AS last_sale
        FROM vendas WHERE data::date <= CAST(:endDate AS date) GROUP BY empresa_id
      ), clients AS (
        SELECT empresa_id, MAX(created_at) AS last_client, COUNT(*)::int AS clients
        FROM clientes WHERE created_at::date <= CAST(:endDate AS date) GROUP BY empresa_id
      ), appointments AS (
        SELECT empresa_id, MAX(created_at) AS last_appointment
        FROM agendamentos WHERE created_at::date <= CAST(:endDate AS date) GROUP BY empresa_id
      ),
      base AS (
        SELECT e.id, e.nome, e.pacote, e.arquivada_em, u.last_use, s.last_sale,
          c.last_client, a.last_appointment, COALESCE(u.current_visits, 0) AS current_visits,
          COALESCE(u.previous_visits, 0) AS previous_visits, COALESCE(u.modules_used, 0) AS modules_used,
          COALESCE(c.clients, 0) AS clients,
          GREATEST(u.last_use, s.last_sale, c.last_client, a.last_appointment) AS last_value,
          CASE
            WHEN e.arquivada_em IS NOT NULL THEN 'archived'
            WHEN GREATEST(u.last_use, s.last_sale, c.last_client, a.last_appointment) IS NULL
              OR GREATEST(u.last_use, s.last_sale, c.last_client, a.last_appointment) < CAST(:endDate AS date) - INTERVAL '20 days' THEN 'high'
            WHEN GREATEST(u.last_use, s.last_sale, c.last_client, a.last_appointment) < CAST(:endDate AS date) - INTERVAL '9 days'
              OR (COALESCE(u.previous_visits, 0) >= 4 AND COALESCE(u.current_visits, 0) * 2 < u.previous_visits) THEN 'medium'
            ELSE 'low'
          END AS risk
        FROM empresas e
        LEFT JOIN usage u ON u.empresa_id = e.id LEFT JOIN sales s ON s.empresa_id = e.id
        LEFT JOIN clients c ON c.empresa_id = e.id LEFT JOIN appointments a ON a.empresa_id = e.id
        WHERE ${companyFilter('e')} AND (:search IS NULL OR e.nome ILIKE '%' || :search || '%')
      )
    `;
    const rows = await sequelize.query(`${base}
      SELECT *, COUNT(*) OVER()::int AS total
      FROM base WHERE (:risk IS NULL OR risk = :risk)
      ORDER BY CASE risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
               last_value ASC NULLS FIRST LIMIT :limit OFFSET :offset
    `, { replacements, type: QueryTypes.SELECT });

    return {
      filters,
      page,
      limit,
      total: asNumber(rows[0]?.total),
      items: rows.map(row => {
        const reasons = [];
        if (row.risk === 'archived') reasons.push('Empresa arquivada');
        if (!row.last_value) reasons.push('Nenhuma ação de valor registrada');
        else {
          const periodEnd = new Date(`${filters.endDate}T23:59:59Z`).getTime();
          const inactiveDays = Math.max(0, Math.floor((periodEnd - new Date(row.last_value).getTime()) / 86400000));
          if (inactiveDays > 21) reasons.push(`Sem ação de valor há ${inactiveDays} dias`);
        }
        if (asNumber(row.previous_visits) >= 4 && asNumber(row.current_visits) * 2 < asNumber(row.previous_visits)) reasons.push('Uso caiu mais de 50%');
        if (asNumber(row.modules_used) <= 1 && row.risk !== 'archived') reasons.push('Baixa adoção de módulos');
        return { id: row.id, name: row.nome, package: row.pacote, archivedAt: row.arquivada_em, lastUse: row.last_use, lastSale: row.last_sale, lastValue: row.last_value, currentVisits: asNumber(row.current_visits), previousVisits: asNumber(row.previous_visits), modulesUsed: asNumber(row.modules_used), clients: asNumber(row.clients), risk: row.risk, reasons };
      })
    };
  }

  static async getCompany(companyId, rawFilters = {}) {
    if (!Number.isInteger(Number(companyId))) {
      const error = new Error('Empresa inválida'); error.status = 400; throw error;
    }
    const filters = normalizeFilters({ ...rawFilters, companyId: Number(companyId) });
    const overview = await this.getOverview(filters);
    const [companyRows, recentSales, monthlyUsage] = await Promise.all([
      sequelize.query(`
        SELECT e.id, e.nome, e.cnpj, e.pacote, e.arquivada_em,
          (SELECT COUNT(*)::int FROM users u WHERE u.empresa_id = e.id) AS users,
          (SELECT COUNT(*)::int FROM clientes c WHERE c.empresa_id = e.id) AS clients,
          (SELECT COUNT(*)::int FROM agendamentos a WHERE a.empresa_id = e.id) AS appointments,
          (SELECT COUNT(*)::int FROM notas_fiscais_emitidas n WHERE n.empresa_id = e.id) AS invoices
        FROM empresas e WHERE e.id = :companyId
      `, { replacements: filters, type: QueryTypes.SELECT }),
      sequelize.query(`SELECT id, data, valor_total, forma_pagamento FROM vendas WHERE empresa_id = :companyId ORDER BY data DESC LIMIT 10`, { replacements: filters, type: QueryTypes.SELECT }),
      sequelize.query(`
        SELECT usage_date AS date, SUM(visit_count)::int AS visits
        FROM empresa_usage_daily WHERE empresa_id = :companyId
          AND usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
        GROUP BY usage_date ORDER BY usage_date
      `, { replacements: filters, type: QueryTypes.SELECT })
    ]);
    if (!companyRows[0]) { const error = new Error('Empresa não encontrada'); error.status = 404; throw error; }
    const riskData = await this.getChurnRisk({ ...filters, companyId, limit: 1 });
    return {
      filters,
      company: { ...companyRows[0], users: asNumber(companyRows[0].users), clients: asNumber(companyRows[0].clients), appointments: asNumber(companyRows[0].appointments), invoices: asNumber(companyRows[0].invoices) },
      summary: overview.summary,
      modules: overview.modules,
      risk: riskData.items[0] || null,
      recentSales: recentSales.map(row => ({ ...row, value: asNumber(row.valor_total) })),
      usage: monthlyUsage.map(row => ({ date: row.date, visits: asNumber(row.visits) }))
    };
  }
}

export { normalizeFilters };
export default MasterAnalyticsService;
