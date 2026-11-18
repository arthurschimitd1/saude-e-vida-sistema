import { Router } from 'express';
import auth from '../middlewares/auth.js';
import requireCargo, { PERM_COMISSOES } from '../middlewares/requireCargo.js';
import { calcular, fechar, getConfiguracao, getDashboard, pagar, putConfiguracao } from '../controllers/ComissaoAssinaturaController.js';

import { salvarMetas } from '../services/RelatorioBarbeariaMetas.js';
import { relatorioBarbearia } from '../services/RelatorioBarbeariaService.js';

const router = Router();
router.use(auth, requireCargo({ cargos: [], permissoes: PERM_COMISSOES, mensagem: 'Sem permissão para acessar comissões' }));
router.put('/relatorios/metas', async (req, res) => {
  try { res.json(await salvarMetas(req.body, req.user)); }
  catch (error) { res.status(error.status || 400).json({ error: error.message }); }
});
router.get('/relatorios', async (req, res) => {
  try { res.json(await relatorioBarbearia(req.query, req.user)); }
  catch (error) { res.status(error.status || 400).json({ error: error.message }); }
});
router.get('/configuracao', getConfiguracao);
router.put('/configuracao', putConfiguracao);
router.get('/competencias/:competencia', getDashboard);
router.post('/competencias/:competencia/calcular', calcular);
router.post('/competencias/:competencia/fechar', fechar);
router.post('/competencias/:competencia/pagar', pagar);
export default router;
