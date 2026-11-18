import LancamentoVinculo from '../models/LancamentoVinculo.js';
import Saida from '../models/Saida.js';
import ApiResponse from '../utils/apiResponse.js';
import { Op } from 'sequelize';

class LancamentoVinculoController {

    async getAll(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { produto_id, departamento_id } = req.query;

            const where = { empresa_id };
            if (produto_id) where.produto_id = produto_id;

            let vinculos = await LancamentoVinculo.findAll({ where });

            if (departamento_id) {
                vinculos = vinculos.filter(v =>
                    Array.isArray(v.rateio) && v.rateio.some((r) => String(r.departamento_id) === String(departamento_id))
                );
            }

            new ApiResponse(res).success(200, vinculos);
        } catch (error) { next(error); }
    }

    async getBySaida(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const vinculo = await LancamentoVinculo.findOne({ where: { saida_id: req.params.saida_id, empresa_id } });
            new ApiResponse(res).success(200, vinculo);
        } catch (error) { next(error); }
    }

    async upsert(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const { saida_id, produto_id, rateio, responsavel } = req.body;

            const existing = await LancamentoVinculo.findOne({ where: { saida_id, empresa_id } });
            if (existing) {
                await existing.update({ produto_id, rateio, responsavel });
                return new ApiResponse(res).success(200, existing, 'Vínculo atualizado');
            }
            const vinculo = await LancamentoVinculo.create({ saida_id, produto_id, rateio, responsavel, empresa_id });
            new ApiResponse(res).success(201, vinculo, 'Vínculo criado');
        } catch (error) { next(error); }
    }

    async delete(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const vinculo = await LancamentoVinculo.findOne({ where: { id: req.params.id, empresa_id } });
            if (!vinculo) throw { status: 404, message: 'Vínculo não encontrado' };
            await vinculo.destroy();
            new ApiResponse(res).success(200, null, 'Vínculo removido');
        } catch (error) { next(error); }
    }

    async semVinculo(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const saidas = await Saida.findAll({ where: { empresa_id } });
            const vinculos = await LancamentoVinculo.findAll({ where: { empresa_id } });
            const vinculados = new Set(vinculos.map(v => v.saida_id));
            const semVinculo = saidas.filter(s => !vinculados.has(s.id));
            new ApiResponse(res).success(200, semVinculo);
        } catch (error) { next(error); }
    }
}

export default new LancamentoVinculoController();