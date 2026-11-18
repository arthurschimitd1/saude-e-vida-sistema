import { Router } from 'express';
import auth from '../middlewares/auth.js';
import masterOnly from '../middlewares/masterOnly.js';
import sequelize from '../config/database.js';
import { overview, revenue, retention, churnRisk, companyDetail } from '../controllers/MasterAnalyticsController.js';

const router = Router();

// Compatibilidade de rollout: não substitui as migrations, mas evita que a
// tela estratégica retorne 500 enquanto uma instância nova ainda inicializa
// o schema de telemetria.
const analyticsSchemaReady = (async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS empresa_usage_daily (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
        usage_date DATE NOT NULL,
        route VARCHAR(180) NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 0,
        last_visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS empresa_usage_daily_empresa_date_route_unique ON empresa_usage_daily (empresa_id, usage_date, route)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS empresa_usage_daily_empresa_date_idx ON empresa_usage_daily (empresa_id, usage_date)`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS master_analytics_audit (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        report VARCHAR(160) NOT NULL,
        filters JSONB NOT NULL DEFAULT '{}'::jsonb,
        accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS master_analytics_audit_accessed_at_idx ON master_analytics_audit (accessed_at)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS master_analytics_audit_user_date_idx ON master_analytics_audit (user_id, accessed_at)`);
  } catch (error) {
    console.warn('[master-analytics] schema de telemetria indisponível:', error.message);
  }
})();

router.use(auth, masterOnly);
router.use(async (req, _res, next) => {
  try {
    await analyticsSchemaReady;
    await sequelize.query(`
      INSERT INTO master_analytics_audit (user_id, report, filters, accessed_at)
      VALUES (:userId, :report, CAST(:filters AS jsonb), CURRENT_TIMESTAMP)
    `, { replacements: { userId: req.user.id, report: req.path, filters: JSON.stringify(req.query || {}) } });
  } catch (error) {
    // O relatório continua disponível durante uma implantação em que a migration ainda não rodou.
    console.warn('[master-analytics] auditoria indisponível:', error.message);
  }
  return next();
});

router.get('/overview', overview);
router.get('/revenue', revenue);
router.get('/retention', retention);
router.get('/churn-risk', churnRisk);
router.get('/company/:id', companyDetail);

export default router;
