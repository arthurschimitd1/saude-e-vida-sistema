import AutomacaoService from '../services/AutomacaoService.js';
import AutomacaoNotificacao from '../models/AutomacaoNotificacao.js';
import Empresa from '../models/Empresa.js';
import ApiResponse from '../utils/apiResponse.js';

class AutomacaoController {

    async getAll(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
            const data = await AutomacaoService.getAll(empresa_id, req.query);
            new ApiResponse(res).success(200, data);
        } catch (e) { next(e); }
    }

    async getResumo(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
            const data = await AutomacaoService.getResumo(empresa_id);
            new ApiResponse(res).success(200, data);
        } catch (e) { next(e); }
    }

    async getTemplates(req, res, next) {
        try {
            const data = AutomacaoService.getTemplates();
            new ApiResponse(res).success(200, data);
        } catch (e) { next(e); }
    }

    async getById(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id_override ?? req.user?.empresa_id;
            const data = await AutomacaoService.getById(req.params.id, empresa_id);
            new ApiResponse(res).success(200, data);
        } catch (e) { next(e); }
    }

    async getHistorico(req, res, next) {
        try {
            const data = await AutomacaoService.getHistorico(req.params.id, req.user);
            new ApiResponse(res).success(200, data);
        } catch (e) { next(e); }
    }

    async create(req, res, next) {
        try {
            const data = await AutomacaoService.create(req.body, req.user);
            new ApiResponse(res).success(201, data, 'Regra criada com sucesso');
        } catch (e) { next(e); }
    }

    async update(req, res, next) {
        try {
            const data = await AutomacaoService.update(req.params.id, req.body, req.user);
            new ApiResponse(res).success(200, data, 'Regra atualizada com sucesso');
        } catch (e) { next(e); }
    }

    async toggleStatus(req, res, next) {
        try {
            const data = await AutomacaoService.toggleStatus(req.params.id, req.user);
            new ApiResponse(res).success(200, data, `Regra ${data.status === 'ativo' ? 'ativada' : 'desativada'}`);
        } catch (e) { next(e); }
    }

    async duplicar(req, res, next) {
        try {
            const data = await AutomacaoService.duplicar(req.params.id, req.user);
            new ApiResponse(res).success(201, data, 'Regra duplicada com sucesso');
        } catch (e) { next(e); }
    }

    async delete(req, res, next) {
        try {
            await AutomacaoService.delete(req.params.id, req.user);
            new ApiResponse(res).success(200, null, 'Regra excluída com sucesso');
        } catch (e) { next(e); }
    }
    async getNotificacoes(req, res, next) {
        try {
            const empresaSelecionada = req.user?.empresa_id_override ?? req.user?.empresa_id;
            let empresas = empresaSelecionada ? [Number(empresaSelecionada)] : [];

            // Quando o MASTER está em “Todas as empresas”, não há override no
            // token. Nesse caso, ele ainda precisa receber os pedidos de todas
            // as empresas visíveis no seletor da topbar.
            if (!empresas.length && req.user?.tipo === 'MASTER') {
                const registros = await Empresa.findAll({
                    attributes: ['id'],
                    where: { arquivada_em: null },
                    raw: true,
                });
                empresas = registros.map((empresa) => Number(empresa.id)).filter(Number.isFinite);
            }

            if (!empresas.length) return new ApiResponse(res).success(200, []);

            const notificacoes = await AutomacaoNotificacao.findAll({
                where: { empresa_id: empresas, lida: false },
                order: [['created_at', 'DESC']],
                limit: 50
            });
            new ApiResponse(res).success(200, notificacoes);
        } catch (e) { next(e); }
    }

    async marcarLida(req, res, next) {
        try {
            const empresaSelecionada = req.user?.empresa_id_override ?? req.user?.empresa_id;
            const { id } = req.params;
            const where = { id };
            if (empresaSelecionada) where.empresa_id = Number(empresaSelecionada);
            await AutomacaoNotificacao.update({ lida: true }, { where });
            new ApiResponse(res).success(200, null, 'Notificação marcada como lida');
        } catch (e) { next(e); }
    }
}

export default new AutomacaoController();
