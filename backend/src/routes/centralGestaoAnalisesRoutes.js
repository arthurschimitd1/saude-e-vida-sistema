import { Router } from "express";
import auth from "../middlewares/auth.js";
import sequelize from "../config/database.js";
import access from "../services/access/AccessControlService.js";
import { obterContextoCentral } from "../services/centralGestao/CentralGestaoAccessService.js";
import { AnalisesService } from "../services/centralGestao/analises/AnalisesService.js";

export function permissoesAnalises(context, permissions = []) {
  return Object.fromEntries(
    ["comercial", "estoque"].map((view) => [
      view,
      context.master || permissions.includes(`central_gestao:${view}`),
    ])
  );
}

export function criarAnalisesRouter({
  authenticate = auth,
  authorize,
  service = new AnalisesService(sequelize),
} = {}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  router.use(authenticate);
  router.use(async (req, res, next) => {
    try {
      if (authorize) req.analises = await authorize(req);
      else {
        const context = await obterContextoCentral(req, {
          access,
          enabled: process.env.CENTRAL_GESTAO_ENABLED === "true",
          query: (sql, replacements) =>
            sequelize.query(sql, { replacements, type: "SELECT" }),
        });
        const effective = context.master
          ? null
          : await access.getUserEffectiveAccess(req.user.id);
        req.analises = {
          context,
          views: permissoesAnalises(context, effective?.permissions),
        };
      }
      next();
    } catch (e) {
      res
        .status(e.status ?? 503)
        .json({
          error: e.status ? e.message : "Não foi possível verificar o acesso.",
        });
    }
  });
  router.get("/acesso", (req, res) =>
    res.json({
      empresaId: req.analises.context.empresaId,
      ...req.analises.views,
    })
  );
  router.get("/:view/:operation", async (req, res) => {
    const { view, operation } = req.params;
    if (!["comercial", "estoque"].includes(view))
      return res.status(404).json({ error: "Visão não encontrada." });
    if (!req.analises.views[view])
      return res
        .status(403)
        .json({ error: "Sem permissão para esta visão da Central de Gestão." });
    try {
      res.json(
        await service.consultar(
          req.analises.context,
          view,
          operation,
          req.query
        )
      );
    } catch (e) {
      res
        .status(e.status ?? 503)
        .json({
          error: e.status
            ? e.message
            : "Não foi possível consultar os indicadores. Tente novamente.",
        });
    }
  });
  return router;
}
export default criarAnalisesRouter();

