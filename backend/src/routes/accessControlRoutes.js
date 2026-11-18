import { Router } from 'express';
import auth from '../middlewares/auth.js';
import AccessControlService from '../services/access/AccessControlService.js';

const router = Router();

const canAccessCompany = (req, empresaId) =>
  req.user?.tipo === 'MASTER' || String(req.user?.empresa_id) === String(empresaId);

router.get('/plans', auth, async (_req, res) => {
  try {
    res.json(await AccessControlService.listPlans());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/companies/:id', auth, async (req, res) => {
  if (!canAccessCompany(req, req.params.id)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const access = await AccessControlService.getCompanyAccess(req.params.id);
    if (!access) return res.status(404).json({ error: 'Empresa nao encontrada' });
    res.json(access);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/companies/:id/plan', auth, async (req, res) => {
  if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const access = await AccessControlService.updateCompanyPlan({
      empresaId: req.params.id,
      planCode: req.body.planCode,
      customRoutes: req.body.customRoutes,
      policy: req.body.policy,
      expectedVersion: req.body.expectedVersion,
      actorUserId: req.user.id
    });
    res.json({ message: 'Pacote atualizado com seguranca', access });
  } catch (error) {
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post('/plans/synchronize', auth, async (req, res) => {
  if (req.user?.tipo !== 'MASTER') return res.status(403).json({ error: 'Acesso negado' });
  try {
    res.json(await AccessControlService.synchronizePlans({
      dryRun: req.body.dryRun !== false,
      actorUserId: req.user.id
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/:id/effective', auth, async (req, res) => {
  try {
    const access = await AccessControlService.getUserEffectiveAccess(req.params.id);
    if (!access) return res.status(404).json({ error: 'Usuario nao encontrado' });
    if (
      req.user?.tipo !== 'MASTER'
      && String(access.empresaId) !== String(req.user?.empresa_id)
    ) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    res.json(access);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
