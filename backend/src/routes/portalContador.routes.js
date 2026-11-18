import express from 'express';
import portalContadorController from '../controllers/PortalContador.controller.js';
import auth from '../middlewares/auth.js';
import { uploadSingle } from '../middlewares/upload.js';

const router = express.Router();

// Todas as rotas exigem autenticação
router.get('/contexto', auth, portalContadorController.getContexto);
router.get('/dashboard-clientes', auth, portalContadorController.getDashboardClientes);
router.get('/clientes-disponiveis', auth, portalContadorController.getClientesDisponiveis);
router.post('/clientes', auth, portalContadorController.vincularCliente);
router.get('/contador-status', auth, portalContadorController.getContadorStatus);
router.put('/contador-status', auth, portalContadorController.updateContadorStatus);
router.put('/perfil', auth, portalContadorController.updatePerfilContador);
router.get('/documentos', auth, portalContadorController.getDocumentos);
router.post('/documentos', auth, uploadSingle, portalContadorController.createDocumento);
router.get('/documentos/download/zip', auth, portalContadorController.downloadDocumentosZip);
router.get('/documentos/:id/download', auth, portalContadorController.downloadDocumento);
router.delete('/documentos/:id', auth, portalContadorController.deleteDocumento);
router.get('/documento-solicitacoes', auth, portalContadorController.getSolicitacoes);
router.post('/documento-solicitacoes', auth, portalContadorController.createSolicitacao);
router.patch('/documento-solicitacoes/:id/status', auth, portalContadorController.updateSolicitacaoStatus);
router.get('/obrigacoes', auth, portalContadorController.getObrigacoes);
router.post('/obrigacoes', auth, portalContadorController.createObrigacao);
router.put('/obrigacoes/:id', auth, portalContadorController.updateObrigacao);
router.patch('/obrigacoes/:id/concluir', auth, portalContadorController.concluirObrigacao);
router.delete('/obrigacoes/:id', auth, portalContadorController.deleteObrigacao);
router.get('/reunioes', auth, portalContadorController.getReunioes);
router.post('/reunioes', auth, portalContadorController.createReuniao);
router.put('/reunioes/:id', auth, portalContadorController.updateReuniao);
router.patch('/reunioes/:id/cancelar', auth, portalContadorController.cancelarReuniao);
router.delete('/reunioes/:id', auth, portalContadorController.deleteReuniao);

export default router;
