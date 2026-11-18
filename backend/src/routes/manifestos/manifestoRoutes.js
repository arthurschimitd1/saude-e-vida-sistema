import { Router } from 'express';

import ManifestoController from '../../controllers/manifestos/ManifestoController.js';
import auth from '../../middlewares/auth.js';
import requireManifesto from '../../middlewares/requireManifesto.js';
import resolveManifestoEmpresa from '../../middlewares/resolveManifestoEmpresa.js';

const router = Router();

router.use(auth);
router.use(resolveManifestoEmpresa);

router.get('/dashboard', requireManifesto('manifestos:visualizar'), ManifestoController.dashboard);
router.get(
  '/documentos-elegiveis',
  requireManifesto('manifestos:criar_mdfe'),
  ManifestoController.documentosElegiveis
);

router.get('/veiculos', requireManifesto('manifestos:visualizar'), ManifestoController.listarVeiculos);
router.post(
  '/veiculos',
  requireManifesto('manifestos:gerenciar_veiculos'),
  ManifestoController.criarVeiculo
);
router.put(
  '/veiculos/:id',
  requireManifesto('manifestos:gerenciar_veiculos'),
  ManifestoController.atualizarVeiculo
);
router.delete(
  '/veiculos/:id',
  requireManifesto('manifestos:gerenciar_veiculos'),
  ManifestoController.excluirVeiculo
);

router.get('/condutores', requireManifesto('manifestos:visualizar'), ManifestoController.listarCondutores);
router.post(
  '/condutores',
  requireManifesto('manifestos:gerenciar_condutores'),
  ManifestoController.criarCondutor
);
router.put(
  '/condutores/:id',
  requireManifesto('manifestos:gerenciar_condutores'),
  ManifestoController.atualizarCondutor
);
router.delete(
  '/condutores/:id',
  requireManifesto('manifestos:gerenciar_condutores'),
  ManifestoController.excluirCondutor
);

router.get('/mdfe', requireManifesto('manifestos:visualizar'), ManifestoController.listarMdfe);
router.post('/mdfe', requireManifesto('manifestos:criar_mdfe'), ManifestoController.criarMdfe);
router.get('/mdfe/:id', requireManifesto('manifestos:visualizar'), ManifestoController.detalharMdfe);
router.put('/mdfe/:id', requireManifesto('manifestos:editar_mdfe'), ManifestoController.atualizarMdfe);
router.delete('/mdfe/:id', requireManifesto('manifestos:editar_mdfe'), ManifestoController.arquivarMdfe);
router.post('/mdfe/:id/validar', requireManifesto('manifestos:editar_mdfe'), ManifestoController.validarMdfe);
router.post('/mdfe/:id/emitir', requireManifesto('manifestos:emitir_mdfe'), ManifestoController.emitirMdfe);
router.post('/mdfe/:id/consultar', requireManifesto('manifestos:consultar'), ManifestoController.consultarMdfe);
router.post('/mdfe/:id/cancelar', requireManifesto('manifestos:cancelar_mdfe'), ManifestoController.cancelarMdfe);
router.post('/mdfe/:id/encerrar', requireManifesto('manifestos:encerrar_mdfe'), ManifestoController.encerrarMdfe);
router.post(
  '/mdfe/:id/condutores',
  requireManifesto('manifestos:incluir_condutor'),
  ManifestoController.incluirCondutor
);

export default router;
