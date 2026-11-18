// src/routes/focusReseller.routes.js

import { Router } from 'express';
import FocusResellerController from '../../controllers/focus/FocusResellerController.js';
import auth from '../../middlewares/auth.js';

const router = Router();

router.use(auth);

/**
 * Integração da empresa do ERP
 */

// Consulta configuração atual
router.get(
  '/config/:empresaId',
  FocusResellerController.verificarConfiguracao
);

/**
 * Operações Reseller Focus
 */

// Lista empresas da revenda
router.get(
  '/empresas',
  FocusResellerController.listarEmpresas
);

// Detalha empresa da Focus pelo ID da Focus
router.get(
  '/empresas/focus/:focusEmpresaId',
  FocusResellerController.detalharEmpresa
);

/**
 * Provisionamento Focus
 */

// Valida payload antes da criação
router.post(
  '/empresas/validar',
  FocusResellerController.validarCriacao
);

/**
 * Associação de empresa já existente
 */

// Associa empresa através dos tokens
router.post(
  '/empresas/:empresaId/associar',
  FocusResellerController.associarEmpresa
);

/**
 * Integração da empresa
 */

// Cria empresa na Focus
router.post(
  '/empresas/:empresaId',
  FocusResellerController.criarEmpresa
);

// Atualiza integração existente
router.put(
  '/empresas/:empresaId',
  FocusResellerController.editarEmpresa
);

// Remove integração
router.delete(
  '/empresas/:empresaId',
  FocusResellerController.deletarEmpresa
);

export default router;