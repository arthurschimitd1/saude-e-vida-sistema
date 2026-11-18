import express from 'express';
import monitoriaController from '../../controllers/whatsappCrm/MonitoriaController.js';
import auth from '../../middlewares/auth.js';
import requireCargo from '../../middlewares/requireCargo.js';

const router = express.Router();

// Relatório de monitoria = transcrição/resumo de conversas de pacientes:
// gestão-only (o front já esconde o botão pra quem não é gestor —
// MASTER ou cargo em CARGOS_GESTAO). Fecha o mesmo escopo no backend.
const somenteGestao = requireCargo({ mensagem: 'Sem permissão para acessar a monitoria de conversas' });

router.get('/relatorio', auth, somenteGestao, monitoriaController.buscarUltimoRelatorio);
router.post('/relatorio', auth, somenteGestao, monitoriaController.gerarRelatorio);

export default router;
