// src/routes/focus/FocusInvoice.routes.js

import { Router } from 'express';
import FocusInvoiceController from '../../controllers/focus/FocusInvoiceController.js';
import FocusStockImportController from '../../controllers/focus/FocusStockImportController.js';
import auth from '../../middlewares/auth.js';
import requireCargo, { PERM_FISCAL } from '../../middlewares/requireCargo.js';
import resolveFiscalEmpresa from '../../middlewares/resolveFiscalEmpresa.js';

const router = Router();

router.use(auth);
router.use(requireCargo({
  permissoes: PERM_FISCAL,
  mensagem: 'Sem permissão para acessar documentos fiscais'
}));

/**
 * Consultas de documentos recebidos
 */

// Lista NF-e ou NFS-e recebidas
// GET /focus/invoices/:empresaId?type=nfe|nfse
router.get(
  '/:empresaId',
  resolveFiscalEmpresa,
  FocusInvoiceController.listar
);

/**
 * Manifestação do destinatário
 */

// Manifestar NF-e
router.post(
  '/:empresaId/nfe/:chave/manifestacao',
  resolveFiscalEmpresa,
  FocusInvoiceController.manifestar
);

router.get(
  '/:empresaId/nfe/:chave/estoque-preview',
  resolveFiscalEmpresa,
  FocusStockImportController.preview
);

router.post(
  '/:empresaId/nfe/:chave/estoque-aplicar',
  resolveFiscalEmpresa,
  FocusStockImportController.apply
);

/**
 * Download XML
 */

// XML NF-e
router.get(
  '/:empresaId/nfe/:chave/xml',
  resolveFiscalEmpresa,
  FocusInvoiceController.baixarXMLNFe
);

// XML NFS-e
router.get(
  '/:empresaId/nfse/:chave/xml',
  resolveFiscalEmpresa,
  FocusInvoiceController.baixarXMLNFSe
);

/**
 * Download PDF
 */

// PDF NF-e
router.get(
  '/:empresaId/nfe/:chave/pdf',
  resolveFiscalEmpresa,
  FocusInvoiceController.baixarPDFNFe
);

// PDF NFS-e
router.get(
  '/:empresaId/nfse/:chave/pdf',
  resolveFiscalEmpresa,
  FocusInvoiceController.baixarPDFNFSe
);

export default router;
