import WhatsappLog from '../../models/WhatsappLog.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';

const TIPOS_VALIDOS = ['webhook_recebido', 'mensagem_enviada', 'falha_envio', 'conexao', 'desconexao', 'diagnostico', 'merge_confirmado', 'merge_manual', 'resposta_automatica'];

class LogService {
    async listar({ pagina = 1, tamanho = 20 } = {}, user) {
        const where = {};
        aplicarEmpresaScope(where, user);
        const limit = Math.min(Number(tamanho) || 20, 100);
        const offset = (Math.max(Number(pagina) || 1, 1) - 1) * limit;

        const { rows, count } = await WhatsappLog.findAndCountAll({
            where,
            order: [['criado_em', 'DESC']],
            limit,
            offset,
        });
        return { registros: rows, total: count, pagina: Number(pagina) || 1, tamanho: limit };
    }

    async recentes(user, limite = 5) {
        const where = {};
        aplicarEmpresaScope(where, user);
        return WhatsappLog.findAll({ where, order: [['criado_em', 'DESC']], limit: limite });
    }

    async registrar({ tipo, mensagem, conversa_id = null, metadata = {} }, user) {
        if (!TIPOS_VALIDOS.includes(tipo)) {
            throw new Error(`Tipo de log inválido: ${tipo}`);
        }
        const empresa_id = empresaParaGravar(user);
        return WhatsappLog.create({ empresa_id, conversa_id, tipo, mensagem, metadata });
    }
}

export default new LogService();
