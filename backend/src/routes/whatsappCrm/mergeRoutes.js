import express from 'express';
import mergeController from '../../controllers/whatsappCrm/MergeController.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

// Palpites de junção pendentes (opção B — merge na tela).
router.get('/pendentes', auth, mergeController.listarPendentes);
// Busca contatos (nome/telefone) pra a telinha de "juntar na mão".
router.get('/buscar', auth, mergeController.buscar);
// Junção MANUAL: atendente escolheu duas conversas → junta (mais antiga fica).
router.post('/manual', auth, mergeController.manual);
// Atendente confirma que são a mesma pessoa → junta as conversas.
router.post('/:id/confirmar', auth, mergeController.confirmar);
// Atendente diz que NÃO são → descarta o palpite (nunca sugere de novo).
router.post('/:id/descartar', auth, mergeController.descartar);

export default router;
