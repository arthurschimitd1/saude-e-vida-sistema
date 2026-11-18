import { Router } from 'express';
import * as minhaEmpresaController from '../controllers/Minhaempresacontroller.js';
import auth from '../middlewares/auth.js';

const router = Router();

// POST permanece público: fluxo de onboarding/cadastro da landing page
router.post('/', minhaEmpresaController.criarEmpresa);

// Demais verbos protegidos por autenticação
router.get('/', auth, minhaEmpresaController.listarEmpresas);
router.get('/:id', auth, minhaEmpresaController.buscarEmpresa);
router.put('/:id', auth, minhaEmpresaController.atualizarEmpresa);
router.delete('/:id', auth, minhaEmpresaController.deletarEmpresa);

export default router;