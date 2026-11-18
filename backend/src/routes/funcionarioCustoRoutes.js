// backend/src/routes/funcionarioCustoRoutes.js
import express from 'express';
import {
    createFuncionario,
    getFuncionarios,
    getFuncionarioById,
    updateFuncionario,
    deleteFuncionario
} from '../controllers/FuncionarioCustoController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

// ===========================================
// ROTAS PARA FUNCIONÁRIOS E CUSTOS
// ===========================================

router.use(auth);

/**
 * @route   GET /api/funcionarios-custos
 * @desc    Listar todos os funcionários da empresa do usuário autenticado
 * @access  Privado
 */
router.get('/', getFuncionarios);

/**
 * @route   GET /api/funcionarios-custos/:id
 * @desc    Buscar um funcionário por ID (escopado à empresa do usuário)
 * @access  Privado
 */
router.get('/:id', getFuncionarioById);

/**
 * @route   POST /api/funcionarios-custos
 * @desc    Criar um novo funcionário
 * @access  Privado
 */
router.post('/', createFuncionario);

/**
 * @route   PUT /api/funcionarios-custos/:id
 * @desc    Atualizar um funcionário existente (escopado à empresa do usuário)
 * @access  Privado
 */
router.put('/:id', updateFuncionario);

/**
 * @route   DELETE /api/funcionarios-custos/:id
 * @desc    Remover um funcionário (escopado à empresa do usuário)
 * @access  Privado
 */
router.delete('/:id', deleteFuncionario);

export default router;
