import { Router } from 'express';
import * as estoqueRoupaController from '../controllers/EstoqueRoupaController.js';
import { uploadMultiple, uploadSingle } from '../middlewares/upload.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, estoqueRoupaController.listar);
router.post('/importar-nuvemshop/preview', auth, uploadSingle, estoqueRoupaController.preverImportacaoNuvemshop);
router.post('/importar-nuvemshop/adicionar-ausentes', auth, uploadSingle, estoqueRoupaController.adicionarAusentesNuvemshop);
router.post('/importar-nuvemshop/substituir', auth, uploadSingle, estoqueRoupaController.substituirPorNuvemshop);
router.post('/sincronizar-fotos-nuvemshop', auth, estoqueRoupaController.sincronizarFotosNuvemshop);
router.get('/:id', auth, estoqueRoupaController.buscar);
router.post('/', auth, uploadMultiple, estoqueRoupaController.criar);
router.put('/:id', auth, uploadMultiple, estoqueRoupaController.atualizar);
router.delete('/:id', auth, estoqueRoupaController.deletar);
router.delete('/:id/fotos/:fotoId', auth, estoqueRoupaController.deletarFoto);

export default router;
