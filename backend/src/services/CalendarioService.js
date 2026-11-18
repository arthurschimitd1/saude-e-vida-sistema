import CalendarioEvento from '../models/CalendarioEvento.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import { Op } from 'sequelize';

class CalendarioService {
    async getAll(filters = {}, currentUser) {
        const where = {};
        aplicarEmpresaScope(where, currentUser);

        if (filters.mes && filters.ano) {
            const mes = String(filters.mes).padStart(2, '0');
            const ano = filters.ano;
            const ultimoDia = new Date(ano, filters.mes, 0).getDate();
            // Usa offset de Brasília (UTC-3) para não perder eventos do dia 1 e do último dia
            const inicio = new Date(`${ano}-${mes}-01T00:00:00-03:00`);
            const fim    = new Date(`${ano}-${mes}-${String(ultimoDia).padStart(2,'0')}T23:59:59-03:00`);
            where.data_inicio = { [Op.between]: [inicio, fim] };
        }

        if (filters.responsavel) {
            where.responsavel = filters.responsavel;
        }

        return await CalendarioEvento.findAll({
            where,
            order: [['data_inicio', 'ASC']]
        });
    }

    async getProximos(currentUser, dias = 3) {
        const where = {};
        aplicarEmpresaScope(where, currentUser);

        const agora = new Date();
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);

        where.data_inicio = { [Op.between]: [agora, limite] };

        return await CalendarioEvento.findAll({
            where,
            order: [['data_inicio', 'ASC']]
        });
    }

    async create(data, currentUser) {
        return await CalendarioEvento.create({
            ...data,
            empresa_id: empresaParaGravar(currentUser)
        });
    }

    async update(id, data, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const evento = await CalendarioEvento.findOne({ where });
        if (!evento) throw new Error('Evento não encontrado');
        await evento.update(data);
        return evento;
    }

    async delete(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const evento = await CalendarioEvento.findOne({ where });
        if (!evento) throw new Error('Evento não encontrado');
        await evento.destroy();
        return true;
    }
}

export default new CalendarioService();
