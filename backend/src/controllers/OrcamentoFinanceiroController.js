import OrcamentoFinanceiro from '../models/OrcamentoFinanceiro.js';
import Saida from '../models/Saida.js';
import ApiResponse from '../utils/apiResponse.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

class OrcamentoFinanceiroController {

    async getByPeriodo(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { mes, ano } = req.query;
            if (!mes || !ano) throw { status: 400, message: 'mes e ano são obrigatórios' };

            const orcamentos = await OrcamentoFinanceiro.findAll({
                where: { empresa_id, mes: Number(mes), ano: Number(ano) },
                order: [['categoria', 'ASC']]
            });

            // Busca realizados do mesmo mês/ano na tabela saidas
            const inicioMes = new Date(Number(ano), Number(mes) - 1, 1);
            const fimMes = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
            const saidas = await Saida.findAll({
                where: { empresa_id, data: { [Op.between]: [inicioMes, fimMes] } }
            });

            // Agrupa realizados por categoria e natureza
            const realizados = {};
            for (const s of saidas) {
                const key = `${s.categoria || 'Sem categoria'}__${s.natureza}`;
                if (!realizados[key]) realizados[key] = 0;
                realizados[key] += Number(s.valor);
            }

            new ApiResponse(res).success(200, { orcamentos, realizados });
        } catch (error) { next(error); }
    }

    async getHistorico(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const periodos = await OrcamentoFinanceiro.findAll({
                where: { empresa_id },
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('mes')), 'mes'], 'ano'],
                order: [['ano', 'DESC'], ['mes', 'DESC']]
            });
            new ApiResponse(res).success(200, periodos);
        } catch (error) { next(error); }
    }

    async upsert(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { mes, ano, categoria, tipo, valor_previsto } = req.body;

            const existing = await OrcamentoFinanceiro.findOne({
                where: { empresa_id, mes, ano, categoria, tipo }
            });

            if (existing) {
                await existing.update({ valor_previsto });
                return new ApiResponse(res).success(200, existing, 'Orçamento atualizado');
            }

            const orcamento = await OrcamentoFinanceiro.create({
                mes, ano, categoria, tipo, valor_previsto, empresa_id
            });
            new ApiResponse(res).success(201, orcamento, 'Orçamento criado');
        } catch (error) { next(error); }
    }

    async delete(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const orc = await OrcamentoFinanceiro.findOne({ where: { id: req.params.id, empresa_id } });
            if (!orc) throw { status: 404, message: 'Orçamento não encontrado' };
            await orc.destroy();
            new ApiResponse(res).success(200, null, 'Orçamento excluído');
        } catch (error) { next(error); }
    }
}

export default new OrcamentoFinanceiroController();