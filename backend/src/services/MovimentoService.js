import { Op } from 'sequelize';
import Movimento from '../models/Movimento.js';
import Product from '../models/Product.js';
import { aplicarEmpresaScope } from '../utils/empresaScope.js';
import { filtroDataInclusivo } from '../utils/financeiroPeriodo.js';

class MovimentoService {
    // Registra um movimento (chamado internamente por outros services)
    async registrar({ produto_id, tipo, quantidade, motivo, origem_tipo, origem_id, empresa_id, usuario_id }, transaction = null) {
        return await Movimento.create({
            produto_id,
            tipo,
            quantidade,
            motivo,
            origem_tipo: origem_tipo ?? null,
            origem_id: origem_id ?? null,
            empresa_id: empresa_id ?? null,
            usuario_id: usuario_id ?? null,
            data: new Date()
        }, transaction ? { transaction } : {});
    }

    async getAll(filters = {}, currentUser) {
        // Movimentos zerados não alteram estoque e só distorcem a quantidade de
        // ocorrências exibida no histórico. Registros antigos assim permanecem
        // no banco para auditoria, mas deixam de compor a visão operacional.
        const where = { quantidade: { [Op.gt]: 0 } };
        if (filters.produto_id) where.produto_id = filters.produto_id;
        if (filters.tipo) where.tipo = filters.tipo;
        const filtroData = filtroDataInclusivo(filters.dataInicio, filters.dataFim, Op);
        if (filtroData) where.data = filtroData;
        aplicarEmpresaScope(where, currentUser);

        return await Movimento.findAll({
            where,
            include: [{ model: Product, as: 'produto', attributes: ['id', 'name', 'code', 'unidade_medida'] }],
            order: [['data', 'DESC']]
        });
    }

    async delete(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const m = await Movimento.findOne({ where });
        if (!m) throw new Error('Movimento não encontrado');
        await m.destroy();
        return true;
    }
}

export default new MovimentoService();
