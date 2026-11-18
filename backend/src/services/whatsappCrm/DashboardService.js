import { Op } from 'sequelize';
import logService from './LogService.js';
import configService from './ConfigService.js';
import zApiService from './ZApiService.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import { aplicarEmpresaScope } from '../../utils/empresaScope.js';

class DashboardService {
    async resumo(user) {
        const whereConversa = {};
        aplicarEmpresaScope(whereConversa, user);

        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);
        const whereMensagem = { criado_em: { [Op.gte]: inicioHoje } };
        aplicarEmpresaScope(whereMensagem, user);

        const config = await configService.buscar(user);

        const [statusZapi, naoLidas, mensagensHoje, eventosRecentes] = await Promise.all([
            config?.zapi_instance_id ? zApiService.statusInstancia(config) : Promise.resolve({ connected: false, error: 'Z-API não configurada', smartphoneConnected: false }),
            WhatsappConversa.sum('nao_lidas', { where: whereConversa }),
            WhatsappMensagem.count({ where: whereMensagem }),
            logService.recentes(user, 5),
        ]);

        return {
            conectado: !!statusZapi.connected,
            erroConexao: statusZapi.error ?? null,
            conversasNaoLidas: naoLidas || 0,
            mensagensHoje: mensagensHoje || 0,
            eventosRecentes,
        };
    }
}

export default new DashboardService();
