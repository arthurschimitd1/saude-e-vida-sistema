import Departamento from '../models/Departamento.js';
import ApiResponse from '../utils/apiResponse.js';

class DepartamentoController {

    async getAll(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const departamentos = await Departamento.findAll({ where: { empresa_id }, order: [['nome', 'ASC']] });
            new ApiResponse(res).success(200, departamentos);
        } catch (error) { next(error); }
    }

    async create(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const departamento = await Departamento.create({ ...req.body, empresa_id });
            new ApiResponse(res).success(201, departamento, 'Departamento criado com sucesso');
        } catch (error) { next(error); }
    }

    async update(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const dep = await Departamento.findOne({ where: { id: req.params.id, empresa_id } });
            if (!dep) throw { status: 404, message: 'Departamento não encontrado' };
            await dep.update(req.body);
            new ApiResponse(res).success(200, dep, 'Departamento atualizado');
        } catch (error) { next(error); }
    }

    async delete(req, res, next) {
        try {
            const empresa_id = req.user?.empresa_id || req.user?.empresa_id_override;
            const dep = await Departamento.findOne({ where: { id: req.params.id, empresa_id } });
            if (!dep) throw { status: 404, message: 'Departamento não encontrado' };
            await dep.destroy();
            new ApiResponse(res).success(200, null, 'Departamento excluído');
        } catch (error) { next(error); }
    }
}

export default new DepartamentoController();