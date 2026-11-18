import EstoqueRoupaInventario from '../models/EstoqueRoupaInventario.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';
import sequelize from '../config/database.js';
import movimentoService, { empresaDoUsuario } from './EstoqueRoupaMovimentoService.js';
import nuvemshopCatalogSyncService from './NuvemshopCatalogSync.service.js';

const inteiroNaoNegativo = (value, nome) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${nome} deve ser um número inteiro maior ou igual a zero`);
  return n;
};

class EstoqueRoupaInventarioService {
  async aplicarLote(itens, user) {
    const empresa_id = empresaDoUsuario(user);
    if (!empresa_id) throw new Error('Selecione uma empresa para realizar o inventário');
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('Nenhuma variação enviada para o inventário');

    const transaction = await sequelize.transaction();
    try {
      const registros = [];
      const variacoesAlteradas = new Set();
      for (const item of itens) {
        const variacao_id = Number(item.variacao_id);
        const roupa_id = Number(item.roupa_id);
        const quantidade_contada = inteiroNaoNegativo(item.quantidade_contada, 'A quantidade contada');
        const variacao = await EstoqueRoupaVariacao.findOne({
          where: { id: variacao_id, roupa_id },
          include: [{ model: EstoqueRoupa, as: 'roupa', required: true, where: { empresa_id } }],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!variacao) continue;
        if (variacao.estoque_infinito) continue;
        const quantidade_sistema = Number(variacao.quantidade_atual);
        const diferenca = quantidade_contada - quantidade_sistema;
        const registro = await EstoqueRoupaInventario.create({
          empresa_id, roupa_id, variacao_id, usuario_id: user?.id ?? null,
          quantidade_sistema, quantidade_contada, diferenca,
          observacao: String(item.observacao ?? '').trim() || null,
          data_inventario: item.data_inventario || new Date(),
        }, { transaction });
        if (diferenca !== 0) {
          await variacao.update({ quantidade_atual: quantidade_contada }, { transaction });
          await movimentoService.registrar({
            empresa_id, roupa_id, variacao_id, usuario_id: user?.id ?? null,
            tipo: diferenca > 0 ? 'entrada' : 'saida', quantidade: Math.abs(diferenca),
            saldo_anterior: quantidade_sistema, saldo_posterior: quantidade_contada,
            motivo: 'Inventário', origem_tipo: 'inventario', origem_id: registro.id,
            observacao: registro.observacao,
          }, transaction);
          variacoesAlteradas.add(Number(variacao_id));
        }
        registros.push(registro);
      }
      await transaction.commit();
      try {
        await nuvemshopCatalogSyncService.pushVariationIds(empresa_id, [...variacoesAlteradas]);
      } catch (error) {
        console.error('[Nuvemshop] Falha ao enviar estoque após inventário:', error.message);
      }
      return { total: registros.length, registros };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Erro ao aplicar inventário de roupas: ${error.message}`);
    }
  }

  async listar(filters = {}, user) {
    const empresa_id = empresaDoUsuario(user);
    if (!empresa_id) throw new Error('Selecione uma empresa para consultar os inventários');
    const where = { empresa_id };
    if (filters.roupa_id) where.roupa_id = Number(filters.roupa_id);
    return EstoqueRoupaInventario.findAll({
      where,
      include: [
        { model: EstoqueRoupa, as: 'roupa', attributes: ['id', 'nome', 'codigo'] },
        { model: EstoqueRoupaVariacao, as: 'variacao', attributes: ['id', 'tamanho', 'cor'] },
      ],
      order: [['data_inventario', 'DESC'], ['id', 'DESC']],
      limit: 500,
    });
  }
}

export default new EstoqueRoupaInventarioService();
