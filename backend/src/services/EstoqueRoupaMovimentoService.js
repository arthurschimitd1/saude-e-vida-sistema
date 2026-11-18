import { Op } from 'sequelize';
import EstoqueRoupaMovimento from '../models/EstoqueRoupaMovimento.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';

const empresaDoUsuario = (user) => {
  const override = Number(user?.empresa_id_override);
  if (Number.isInteger(override) && override > 0) return override;
  const empresa = Number(user?.empresa_id);
  return Number.isInteger(empresa) && empresa > 0 ? empresa : null;
};

class EstoqueRoupaMovimentoService {
  async registrar(data, transaction) {
    return EstoqueRoupaMovimento.create({
      ...data,
      quantidade: Math.abs(Number(data.quantidade)),
      empresa_id: Number(data.empresa_id),
    }, transaction ? { transaction } : {});
  }

  async listar(filters = {}, user) {
    const empresa_id = empresaDoUsuario(user);
    if (!empresa_id) throw new Error('Selecione uma empresa para consultar as movimentações');
    const where = { empresa_id };
    if (filters.roupa_id) where.roupa_id = Number(filters.roupa_id);
    if (filters.variacao_id) where.variacao_id = Number(filters.variacao_id);
    if (filters.tipo) where.tipo = String(filters.tipo);
    if (filters.dataInicio || filters.dataFim) {
      where.data = {};
      if (filters.dataInicio) where.data[Op.gte] = new Date(filters.dataInicio);
      if (filters.dataFim) where.data[Op.lte] = new Date(`${filters.dataFim}T23:59:59.999`);
    }
    return EstoqueRoupaMovimento.findAll({
      where,
      include: [
        { model: EstoqueRoupa, as: 'roupa', attributes: ['id', 'nome', 'codigo'] },
        { model: EstoqueRoupaVariacao, as: 'variacao', attributes: ['id', 'tamanho', 'cor'] },
      ],
      order: [['data', 'DESC'], ['id', 'DESC']],
      limit: 500,
    });
  }
}

export { empresaDoUsuario };
export default new EstoqueRoupaMovimentoService();
