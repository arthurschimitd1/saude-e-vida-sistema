import { Router } from 'express';
import auth from '../middlewares/auth.js';
import sequelize from '../config/database.js';

const router = Router();

const routeNames = [
  ['/uikit/formlayout', 'Estoque'], ['/uikit/producao', 'Produção'],
  ['/uikit/relatorios-produtos', 'Relatórios de produtos'],
  ['/uikit/pedidos', 'Pedidos'], ['/uikit/fornecedores', 'Fornecedores'],
  ['/uikit/agendamentos', 'Agendamentos'], ['/uikit/button', 'Clientes'],
  ['/uikit/tree', 'Orçamentos'], ['/uikit/input', 'Caixa'],
  ['/uikit/servicos-nfe', 'NF-e'], ['/uikit/servicos-nfce', 'NFC-e'],
  ['/uikit/historico-notas', 'Histórico de Notas'], ['/uikit/manifestos', 'Manifestos'],
  ['/uikit/comissoes', 'Comissões'], ['/uikit/crm', 'CRM / RFM'],
  ['/uikit/automacao-whatsapp', 'WhatsApp CRM'], ['/uikit/prospeccao', 'CRM Comercial'],
  ['/uikit/contabil-fiscal', 'Contábil & Fiscal'], ['/financeiro', 'Financeiro'],
  ['/dashboard', 'Dashboard']
];

const normalizeRoute = (value) => {
  const route = String(value || '').trim().slice(0, 180);
  if (!route.startsWith('/') || route.startsWith('/auth')) return null;
  return route;
};

const companyName = (route) => routeNames.find(([prefix]) => route.startsWith(prefix))?.[1] || route;

router.post('/', auth, async (req, res) => {
  const route = normalizeRoute(req.body?.route);
  const empresaId = req.user?.tipo === 'MASTER' ? null : req.user?.empresa_id;
  if (!route || !empresaId) return res.status(204).end();

  try {
    await sequelize.query(`
      INSERT INTO empresa_usage_daily
        (empresa_id, usage_date, route, visit_count, last_visited_at, created_at, updated_at)
      VALUES (:empresaId, CURRENT_DATE, :route, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (empresa_id, usage_date, route)
      DO UPDATE SET visit_count = empresa_usage_daily.visit_count + 1,
                    last_visited_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
    `, { replacements: { empresaId, route } });
    return res.status(204).end();
  } catch (error) {
    console.error('[usage] falha ao registrar uso:', error.message);
    return res.status(204).end();
  }
});

router.get('/report', auth, async (req, res) => {
  if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const empresaId = req.query.empresa_id && req.query.empresa_id !== 'all'
    ? Number(req.query.empresa_id) : null;
  if (req.query.empresa_id && req.query.empresa_id !== 'all' && !Number.isInteger(empresaId)) {
    return res.status(400).json({ error: 'Empresa inválida' });
  }

  try {
    const [rows] = await sequelize.query(`
      SELECT u.empresa_id, e.nome AS empresa_nome, u.route,
             SUM(u.visit_count)::int AS acessos,
             MAX(u.last_visited_at) AS ultimo_acesso
      FROM empresa_usage_daily u
      JOIN empresas e ON e.id = u.empresa_id
      WHERE u.usage_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
        AND (:empresaId IS NULL OR u.empresa_id = :empresaId)
      GROUP BY u.empresa_id, e.nome, u.route
      ORDER BY acessos DESC, ultimo_acesso DESC
    `, { replacements: { days, empresaId } });

    const total = rows.reduce((sum, row) => sum + Number(row.acessos || 0), 0);
    return res.json({
      periodoDias: days,
      empresaId,
      totalAcessos: total,
      abasUtilizadas: rows.length,
      empresasComUso: new Set(rows.map(row => row.empresa_id)).size,
      rows: rows.map(row => ({ ...row, aba: companyName(row.route) }))
    });
  } catch (error) {
    console.error('[usage] falha no relatorio:', error);
    return res.status(500).json({ error: 'Não foi possível carregar o relatório de uso' });
  }
});

export default router;
