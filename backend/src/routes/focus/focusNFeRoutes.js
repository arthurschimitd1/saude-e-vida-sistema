import { Router } from 'express';
import NFeController from '../../controllers/focus/NFeController.js';
import auth from '../../middlewares/auth.js';

const router = Router();

router.use(auth);

// Emitir NF-e
router.post('/emitir', NFeController.emitir);

// XML/PDF
router.get('/:id/xml', NFeController.baixarXml);
router.get('/:id/pdf', NFeController.baixarPdf);

// Buscar por venda — também melhor deixar antes de /:id
router.get('/venda/:vendaId', NFeController.buscarPorVenda);

// Consultar local
router.get('/:id', NFeController.buscarPorId);

// Consultar Focus
router.get('/:id/consultar', NFeController.consultar);

// Refazer uma emissão rejeitada corrigindo apenas dados fiscais dos itens
router.post('/:id/refazer', NFeController.refazer);

// Cancelar
router.post('/:id/cancelar', NFeController.cancelar);

// Listar
router.get('/', NFeController.listar);

export default router;
