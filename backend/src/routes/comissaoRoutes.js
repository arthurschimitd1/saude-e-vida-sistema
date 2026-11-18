import { Router } from 'express';
import {
    getComissoes,
    getResumo,
    getEscopo,
    pagarComissao,
    pagarTodasPendentes,
    deleteComissao,
    getConfiguracoesServico,
    getCatalogoServicos,
    salvarConfiguracaoServico,
    excluirConfiguracaoServico,
    getInconsistencias,
    getProdutosPorProfissional
} from '../controllers/ComissaoController.js';
import auth from '../middlewares/auth.js';
import requireCargo, { PERM_COMISSOES } from '../middlewares/requireCargo.js';

const router = Router();
const autorizarComissoes = requireCargo({
    cargos: [],
    permissoes: PERM_COMISSOES,
    mensagem: 'Sem permissão para acessar comissões'
});

router.use(auth, autorizarComissoes);
router.get('/', getComissoes);
router.get('/resumo', getResumo);
router.get('/inconsistencias', getInconsistencias);
router.get('/produtos-por-profissional', getProdutosPorProfissional);
router.get('/escopo', getEscopo);
router.get('/configuracoes-servico', getConfiguracoesServico);
router.get('/catalogo-servicos', getCatalogoServicos);
router.post('/configuracoes-servico', salvarConfiguracaoServico);
router.delete('/configuracoes-servico/:id', excluirConfiguracaoServico);
router.put('/:id/pagar', pagarComissao);
router.put('/funcionario/:funcionario_id/pagar-todas', pagarTodasPendentes);
router.delete('/:id', deleteComissao);

export default router;
