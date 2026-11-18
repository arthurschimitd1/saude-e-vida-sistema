import { Router } from 'express';
import NFCeController from '../../controllers/focus/NFCeController.js';
import auth from '../../middlewares/auth.js';

const router = Router();

router.use(auth);

// Emitir NFC-e
router.post('/emitir', NFCeController.emitir);

// XML/PDF
router.get('/:id/xml', NFCeController.baixarXml);
router.get('/:id/pdf', NFCeController.baixarPdf);
router.get('/:id/danfe', NFCeController.visualizarDanfe);

// Buscar por venda — deixar antes de /:id
router.get('/venda/:vendaId', NFCeController.buscarPorVenda);

// Consultar local
router.get('/:id', NFCeController.buscarPorId);

// Consultar Focus
router.get('/:id/consultar', NFCeController.consultar);

// Refazer uma emissão rejeitada corrigindo apenas dados fiscais dos itens
router.post('/:id/refazer', NFCeController.refazer);

// Cancelar
router.post('/:id/cancelar', NFCeController.cancelar);

// Listar
router.get('/', NFCeController.listar);

export default router;
