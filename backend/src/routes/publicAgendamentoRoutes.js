import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    consultarClientePublico,
    criarAgendamentoPublico,
    listarAgendamentosPublicos,
    listarBloqueiosPublicos,
    listarProfissionaisPublicos,
    listarServicosPublicos,
    obterConfiguracaoPublica,
} from '../controllers/PublicAgendamentoController.js';

const router = Router();

const publicBookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas solicitações. Tente novamente em alguns minutos.' },
});

router.use(publicBookingLimiter);

router.get('/:empresaSlug/profissionais', listarProfissionaisPublicos);
router.get('/:empresaSlug/servicos', listarServicosPublicos);
router.get('/:empresaSlug/configuracao', obterConfiguracaoPublica);
router.get('/:empresaSlug/agendamentos', listarAgendamentosPublicos);
router.get('/:empresaSlug/bloqueios', listarBloqueiosPublicos);
router.get('/:empresaSlug/clientes', consultarClientePublico);
router.post('/:empresaSlug/agendamentos', criarAgendamentoPublico);

export default router;
