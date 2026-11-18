import { Router } from 'express';
import centroCustoController from '../controllers/CentroCustoController.js';
import auth from '../middlewares/auth.js';

const router = Router();
router.use(auth);

// ── CRUD base
router.get('/',       centroCustoController.getAll.bind(centroCustoController));
router.post('/',      centroCustoController.create.bind(centroCustoController));
router.put('/:id',    centroCustoController.update.bind(centroCustoController));
router.delete('/:id', centroCustoController.delete.bind(centroCustoController));

// ── Endpoints globais (sem :id) — devem vir ANTES de /:id
router.get('/cards',                centroCustoController.getCards.bind(centroCustoController));
router.get('/listagem',             centroCustoController.getListagem.bind(centroCustoController));
router.get('/grafico-departamento', centroCustoController.getGraficoDepartamento.bind(centroCustoController));
router.get('/exportar',             centroCustoController.exportarListagem.bind(centroCustoController));
router.get('/rateios',              centroCustoController.listarRateios.bind(centroCustoController));
router.post('/calcular-rateio',     centroCustoController.calcularRateio.bind(centroCustoController));

// ── Endpoints por :id
router.get('/:id',          centroCustoController.getOne.bind(centroCustoController));
router.get('/:id/resumo',   centroCustoController.getResumo.bind(centroCustoController));
router.get('/:id/detalhes', centroCustoController.getDetalhes.bind(centroCustoController));
router.get('/:id/exportar', centroCustoController.exportarDetalhes.bind(centroCustoController));

// ── Rateio
router.get('/:id/rateio',  centroCustoController.getRateio.bind(centroCustoController));
router.post('/:id/rateio', centroCustoController.salvarRateio.bind(centroCustoController));

// ── Departamentos
router.get('/:id/departamentos',                    centroCustoController.getDepartamentos.bind(centroCustoController));
router.post('/:id/departamentos',                   centroCustoController.adicionarDepartamento.bind(centroCustoController));
router.delete('/:id/departamentos/:departamentoId', centroCustoController.removerDepartamento.bind(centroCustoController));

// ── Projetos
router.get('/:id/projetos',               centroCustoController.getProjetos.bind(centroCustoController));
router.post('/:id/projetos',              centroCustoController.criarProjeto.bind(centroCustoController));
router.put('/:id/projetos/:projetoId',    centroCustoController.atualizarProjeto.bind(centroCustoController));
router.delete('/:id/projetos/:projetoId', centroCustoController.deletarProjeto.bind(centroCustoController));

export default router;