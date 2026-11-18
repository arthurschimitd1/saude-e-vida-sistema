import { Op } from 'sequelize';
import Inventario from '../models/Inventario.js';
import Product from '../models/Product.js';
import RawMaterial from '../models/RawMaterial.js';
import Movimento from '../models/Movimento.js';
import sequelize from '../config/database.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

class InventarioService {
  // Cria um único registro de inventário (e ajusta o estoque do produto)
  async create(data, currentUser) {
    const t = await sequelize.transaction();
    try {
      // Busca o produto (respeitando multi-tenant)
      const where = { id: data.produto_id };
      aplicarEmpresaScope(where, currentUser);
      const produto = await Product.findOne({ where, transaction: t });
      if (!produto) {
        await t.rollback();
        throw new Error('Produto não encontrado');
      }

      const quantidadeSistema = produto.currentQuantity;
      const quantidadeContada = parseFloat(data.quantidade_contada);
      const diferenca = quantidadeContada - quantidadeSistema;

      // Cria o registro do inventário
      const registro = await Inventario.create({
        produto_id: produto.id,
        empresa_id: currentUser?.empresa_id ?? null,
        usuario_id: currentUser?.id ?? null,
        quantidade_sistema: quantidadeSistema,
        quantidade_contada: quantidadeContada,
        diferenca: diferenca,
        observacao: data.observacao || null,
        data_inventario: data.data_inventario || new Date()
      }, { transaction: t });

      // Atualiza a quantidade atual do produto
      if (diferenca !== 0) {
        await produto.update({ currentQuantity: quantidadeContada }, { transaction: t });
        // Sincroniza com raw_materials se for matéria-prima
        if (produto.raw_material_id) {
          await RawMaterial.update(
            { currentQuantity: quantidadeContada },
            { where: { id: produto.raw_material_id }, transaction: t }
          );
        }
        // Registra movimento (entrada se sobrou, saída se faltou)
        await Movimento.create({
          produto_id: produto.id,
          empresa_id: empresaParaGravar(currentUser),
          usuario_id: currentUser?.id ?? null,
          tipo: diferenca > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(diferenca),
          motivo: 'Inventário',
          origem_tipo: 'inventario',
          origem_id: registro.id,
          data: new Date()
        }, { transaction: t });
      }

      await t.commit();
      return registro;
    } catch (error) {
      await t.rollback();
      throw new Error(`Erro ao criar inventário: ${error.message}`);
    }
  }

  // Aplica um lote de contagens — uma para cada produto. Útil quando o
  // usuário fecha o modal de inventário com vários ajustes ao mesmo tempo.
  async aplicarLote(itens, currentUser) {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new Error('Nenhum item enviado para o inventário');
    }

    const t = await sequelize.transaction();
    try {
      const resultados = [];

      for (const item of itens) {
        const where = { id: item.produto_id };
        aplicarEmpresaScope(where, currentUser);
        const produto = await Product.findOne({ where, transaction: t });
        if (!produto) continue; // ignora produto inválido

        const quantidadeSistema = produto.currentQuantity;
        const quantidadeContada = parseFloat(item.quantidade_contada);
        const diferenca = quantidadeContada - quantidadeSistema;

        const registro = await Inventario.create({
          produto_id: produto.id,
          empresa_id: empresaParaGravar(currentUser),
          usuario_id: currentUser?.id ?? null,
          quantidade_sistema: quantidadeSistema,
          quantidade_contada: quantidadeContada,
          diferenca: diferenca,
          observacao: item.observacao || null,
          data_inventario: item.data_inventario || new Date()
        }, { transaction: t });

        if (diferenca !== 0) {
          await produto.update({ currentQuantity: quantidadeContada }, { transaction: t });
          // Sincroniza com raw_materials se for matéria-prima
          if (produto.raw_material_id) {
            await RawMaterial.update(
              { currentQuantity: quantidadeContada },
              { where: { id: produto.raw_material_id }, transaction: t }
            );
          }

          const responsavelNome = item.responsavel_nome?.trim() || null;
          const justificativa   = item.justificativa?.trim()    || null;
          let motivo = 'Inventário';
          if (responsavelNome) motivo += ` — ${responsavelNome}`;
          if (justificativa)   motivo += `: ${justificativa}`;

          await Movimento.create({
            produto_id: produto.id,
            empresa_id: empresaParaGravar(currentUser),
            usuario_id: item.responsavel_id ?? currentUser?.id ?? null,
            tipo: diferenca > 0 ? 'entrada' : 'saida',
            quantidade: Math.abs(diferenca),
            motivo,
            origem_tipo: 'inventario',
            origem_id: registro.id,
            data: new Date()
          }, { transaction: t });
        }

        resultados.push(registro);
      }

      await t.commit();
      return {
        total: resultados.length,
        registros: resultados
      };
    } catch (error) {
      await t.rollback();
      throw new Error(`Erro ao aplicar inventário em lote: ${error.message}`);
    }
  }

  async getAll(filters = {}, currentUser) {
    try {
      const where = {};

      if (filters.produto_id) where.produto_id = filters.produto_id;
      if (filters.dataInicio || filters.dataFim) {
        where.data_inventario = {};
        if (filters.dataInicio) where.data_inventario[Op.gte] = new Date(filters.dataInicio);
        if (filters.dataFim) where.data_inventario[Op.lte] = new Date(filters.dataFim);
      }

      // Isolamento multi-tenant
      aplicarEmpresaScope(where, currentUser);

      return await Inventario.findAll({
        where,
        include: [
          { model: Product, as: 'produto', attributes: ['id', 'name', 'code'] }
        ],
        order: [['data_inventario', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar inventários: ${error.message}`);
    }
  }

  async getById(id, currentUser) {
    try {
      const where = { id };
      aplicarEmpresaScope(where, currentUser);
      const registro = await Inventario.findOne({
        where,
        include: [{ model: Product, as: 'produto', attributes: ['id', 'name', 'code'] }]
      });
      if (!registro) throw new Error('Inventário não encontrado');
      return registro;
    } catch (error) {
      throw new Error(`Erro ao buscar inventário: ${error.message}`);
    }
  }

  async delete(id, currentUser) {
    try {
      const where = { id };
      aplicarEmpresaScope(where, currentUser);
      const registro = await Inventario.findOne({ where });
      if (!registro) throw new Error('Inventário não encontrado');
      await registro.destroy();
      return true;
    } catch (error) {
      throw new Error(`Erro ao deletar inventário: ${error.message}`);
    }
  }
}

export default new InventarioService();
