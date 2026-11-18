import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { producaoPorProduto, vendasFinanceiras, vendasPorProduto } from '../controllers/RelatorioProdutosController.js';

const router = Router();

router.get('/vendas', auth, vendasPorProduto);
router.get('/financeiro', auth, vendasFinanceiras);
router.get('/producao', auth, producaoPorProduto);

export default router;
