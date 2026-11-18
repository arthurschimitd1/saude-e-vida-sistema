import { Router } from 'express';
import FocusConfiguracao from '../models/FocusConfiguracao.js';
import checkContadorRole from '../middlewares/checkContadorRole.js';

const router = Router();

// Obter configuração da empresa logada (apenas contador ou master)
router.get('/config', checkContadorRole, async (req, res) => {
  const empresaId = req.user.empresa_id; // contador pertence a uma empresa (escritório)
  let config = await FocusConfiguracao.findOne({ where: { empresa_id: empresaId } });
  if (!config) config = {};
  res.json(config);
});

// Salvar/atualizar configuração
router.post('/config', checkContadorRole, async (req, res) => {
  const { token, ambiente } = req.body;
  const empresaId = req.user.empresa_id;
  const [config, created] = await FocusConfiguracao.upsert({
    empresa_id: empresaId,
    token,
    ambiente: ambiente || 'producao'
  });
  res.json({ success: true, config });
});

export default router;