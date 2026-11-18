import MasterAnalyticsService from '../services/MasterAnalyticsService.js';

const filtersFrom = req => ({
  startDate: req.query.start_date,
  endDate: req.query.end_date,
  days: req.query.days,
  companyId: req.query.empresa_id,
  packageName: req.query.pacote,
  page: req.query.page,
  limit: req.query.limit,
  risk: req.query.risco,
  search: req.query.busca
});

const respond = handler => async (req, res, next) => {
  try { return res.json(await handler(req)); } catch (error) { return next(error); }
};

export const overview = respond(req => MasterAnalyticsService.getOverview(filtersFrom(req)));
export const revenue = respond(req => MasterAnalyticsService.getRevenue(filtersFrom(req)));
export const retention = respond(req => MasterAnalyticsService.getRetention(filtersFrom(req)));
export const churnRisk = respond(req => MasterAnalyticsService.getChurnRisk(filtersFrom(req)));
export const companyDetail = respond(req => MasterAnalyticsService.getCompany(req.params.id, filtersFrom(req)));
