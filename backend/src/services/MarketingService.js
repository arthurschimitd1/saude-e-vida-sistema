import Marketing from '../models/Marketing.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

class MarketingService {
    async getAll(filters = {}, currentUser) {
        const where = {};
        if (filters.status) where.status = filters.status;
        aplicarEmpresaScope(where, currentUser);

        return await Marketing.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }

    async getById(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const projeto = await Marketing.findOne({ where });
        if (!projeto) throw new Error('Projeto não encontrado');
        return projeto;
    }

    async create(data, currentUser) {
        return await Marketing.create({
            ...data,
            empresa_id: empresaParaGravar(currentUser)
        });
    }

    async update(id, data, currentUser) {
        const projeto = await this.getById(id, currentUser);
        await projeto.update(data);
        return projeto;
    }

    async delete(id, currentUser) {
        const projeto = await this.getById(id, currentUser);
        await projeto.destroy();
        return true;
    }
}

export default new MarketingService();
