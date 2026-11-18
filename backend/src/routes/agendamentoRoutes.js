import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
    atualizarAgendamento,
    atualizarBloqueio,
    atualizarColaborador,
    atualizarUnidade,
    atualizarServicoAgenda,
    bloquearDia,
    criarAgendamento,
    criarColaborador,
    criarServicoAgenda,
    criarUnidade,
    desbloquearDia,
    excluirAgendamento,
    excluirColaborador,
    excluirServicoAgenda,
    excluirUnidade,
    listarAgendamentos,
    listarBloqueios,
    listarClientesAgenda,
    listarColaboradores,
    listarServicosAgenda,
    listarUnidades,
    obterConfiguracaoAgenda,
    salvarConfiguracaoAgenda,
} from '../controllers/AgendamentoController.js';

const router = Router();

router.use(auth);

router.get('/configuracao', obterConfiguracaoAgenda);
router.put('/configuracao', salvarConfiguracaoAgenda);
router.get('/unidades', listarUnidades);
router.post('/unidades', criarUnidade);
router.put('/unidades/:id', atualizarUnidade);
router.delete('/unidades/:id', excluirUnidade);

router.get('/colaboradores', listarColaboradores);
router.post('/colaboradores', criarColaborador);
router.put('/colaboradores/:id', atualizarColaborador);
router.delete('/colaboradores/:id', excluirColaborador);

router.get('/clientes', listarClientesAgenda);

router.get('/bloqueios', listarBloqueios);
router.post('/bloqueios', bloquearDia);
router.put('/bloqueios', atualizarBloqueio);
router.delete('/bloqueios', desbloquearDia);

router.get('/servicos', listarServicosAgenda);
router.post('/servicos', criarServicoAgenda);
router.put('/servicos/:id', atualizarServicoAgenda);
router.delete('/servicos/:id', excluirServicoAgenda);

router.get('/', listarAgendamentos);
router.post('/', criarAgendamento);
router.put('/:id', atualizarAgendamento);
router.delete('/:id', excluirAgendamento);

export default router;
