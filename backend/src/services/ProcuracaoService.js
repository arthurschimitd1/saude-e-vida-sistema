import Procuracao from '../models/Procuracao.js';
import { Op } from 'sequelize';

class ProcuracaoService {

    async getAll(empresa_id, filters = {}) {
        const where = { empresa_id };

        if (filters.status) where.status = filters.status;
        if (filters.tipo) where.tipo = filters.tipo;
        if (filters.cliente_id) where.cliente_id = filters.cliente_id;

        return await Procuracao.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }

    async getById(id, empresa_id) {
        const procuracao = await Procuracao.findOne({ where: { id, empresa_id } });
        if (!procuracao) throw { status: 404, message: 'Procuração não encontrada' };
        return procuracao;
    }

    async create(data, user) {
        const empresa_id = user?.empresa_id_override ?? user?.empresa_id;
        if (!empresa_id) throw { status: 400, message: 'empresa_id não encontrado' };

        return await Procuracao.create({ ...data, empresa_id, criado_por: user?.id });
    }

    async update(id, data, user) {
        const empresa_id = user?.empresa_id_override ?? user?.empresa_id;
        const procuracao = await this.getById(id, empresa_id);

        if (procuracao.status === 'revogada') {
            throw { status: 400, message: 'Procuração revogada não pode ser editada' };
        }

        await procuracao.update(data);
        return procuracao;
    }

    async revogar(id, data, user) {
        const empresa_id = user?.empresa_id_override ?? user?.empresa_id;
        const procuracao = await this.getById(id, empresa_id);

        if (procuracao.status === 'revogada') {
            throw { status: 400, message: 'Procuração já está revogada' };
        }

        await procuracao.update({
            status: 'revogada',
            data_revogacao: data.data_revogacao || new Date(),
            motivo_revogacao: data.motivo_revogacao
        });

        return procuracao;
    }

    async delete(id, user) {
        const empresa_id = user?.empresa_id_override ?? user?.empresa_id;
        const procuracao = await this.getById(id, empresa_id);
        await procuracao.destroy();
    }
}

export default new ProcuracaoService();