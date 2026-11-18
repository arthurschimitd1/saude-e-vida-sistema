import { Router } from 'express';
import auth from '../middlewares/auth.js';
import sequelize from '../config/database.js';
import access from '../services/access/AccessControlService.js';
import { obterContextoCentral } from '../services/centralGestao/CentralGestaoAccessService.js';
import { CentralGestaoRepository } from '../services/centralGestao/CentralGestaoRepository.js';
import { CentralGestaoService } from '../services/centralGestao/CentralGestaoService.js';

const service = new CentralGestaoService(new CentralGestaoRepository(sequelize));

// Injeção usada pelos testes para montar somente estas rotas, sem inicializar
// a aplicação operacional e seus efeitos de startup.
export function criarCentralGestaoRouter({ authenticate = auth, authorize, centralService = service } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(authenticate);
  router.use(async (req, res, next) => {
    try {
      req.centralContext = authorize ? await authorize(req) : await obterContextoCentral(req, {
        access, enabled: process.env.CENTRAL_GESTAO_ENABLED === 'true',
        query: (sql, replacements) => sequelize.query(sql, { replacements, type: 'SELECT' }),
      });
      next();
    } catch (error) {
      res.status(error.status ?? 503).json({ error: error.status ? error.message : 'Não foi possível verificar o acesso à Central de Gestão.' });
    }
  });
  router.get('/contexto', (req, res) => res.json({ habilitado: true, autorizado: true, empresaId: req.centralContext.empresaId }));
  const handle = method => async (req, res) => {
    try { res.json(await centralService[method](req.centralContext, req.query)); }
    catch (error) {
      if (!error.status) console.error('[Central de Gestão] Consulta indisponível:', error.original?.code ?? error.name);
      res.status(error.status ?? 503).json({ error: error.status ? error.message : 'Não foi possível consultar os indicadores. Tente novamente.' });
    }
  };
  router.get('/visao-geral', handle('visaoGeral'));
  router.get('/detalhes', handle('detalhes'));
  return router;
}

export default criarCentralGestaoRouter();

