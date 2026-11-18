import RawMaterial from '../models/RawMaterial.js';
import Product from '../models/Product.js';
import { Op } from 'sequelize';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

const syncToProduct = async (mp, empresaId) => {
    try {
        const empId = empresaId ?? mp.empresa_id ?? null;
        const preco = Number(mp.price) || 0;
        const data = {
            name: mp.name,
            price: preco,
            preco_compra: preco,
            currentQuantity: Number(mp.currentQuantity) || 0,
            minQuantity: Number(mp.minQuantity ?? mp.min_quantity) || 0,
            unidade_medida: mp.unit ?? null,
            is_materia_prima: true,
            category: 'Matéria Prima',
            empresa_id: empId,
            raw_material_id: mp.id
        };

        // Atualiza todos os produtos com esse nome (inclui duplicatas criadas por sync antigo)
        // e também o vínculo direto por raw_material_id
        const { Op } = await import('sequelize');
        const todos = await Product.findAll({
            where: { [Op.or]: [{ raw_material_id: mp.id }, { name: mp.name }] }
        });

        if (todos.length > 0) {
            await Promise.all(todos.map(p => p.update(data)));
            console.log(`[syncToProduct] "${mp.name}" → atualizou ${todos.length} produto(s): ${todos.map(p => p.id).join(', ')}`);
        } else {
            await Product.create(data);
            console.log(`[syncToProduct] "${mp.name}" → criou novo produto`);
        }
    } catch (e) {
        console.log('[RawMaterial] Erro ao sincronizar com Products:', e.message);
    }
};

class RawMaterialService {
  async create(data, currentUser) {
    try {
      const empresa = empresaParaGravar(currentUser);
      if (empresa) data.empresa_id = empresa;
      const rawMaterial = await RawMaterial.create(data);
      await syncToProduct(rawMaterial, empresa);
      return rawMaterial;
    } catch (error) {
      throw new Error(`Erro ao criar matéria-prima: ${error.message}`);
    }
  }

  async getAll(filters = {}, currentUser) {
    try {
      const where = {};

      if (filters.name) {
        where.name = { [Op.iLike]: `%${filters.name}%` };
      }

      aplicarEmpresaScope(where, currentUser);

      const rawMaterials = await RawMaterial.findAll({ where });

      // Puxa currentQuantity do espelho em Products (sempre atualizado por produção/vendas/inventário)
      // Tenta por raw_material_id primeiro; fallback por nome para registros sem o link
      const ids   = rawMaterials.map(rm => rm.id);
      const nomes = rawMaterials.map(rm => rm.name);

      const produtos = (ids.length || nomes.length)
        ? await Product.findAll({
            where: {
              is_materia_prima: true,
              [Op.or]: [
                ...(ids.length   ? [{ raw_material_id: { [Op.in]: ids } }] : []),
                ...(nomes.length ? [{ name: { [Op.in]: nomes } }]           : [])
              ]
            },
            attributes: ['raw_material_id', 'name', 'currentQuantity']
          })
        : [];

      const qtdPorRmId = {};
      const qtdPorNome = {};
      produtos.forEach(p => {
        if (p.raw_material_id) qtdPorRmId[p.raw_material_id] = Number(p.currentQuantity);
        qtdPorNome[p.name] = Number(p.currentQuantity);
      });

      return rawMaterials.map(rm => {
        const json = rm.toJSON();
        const qtd = qtdPorRmId[rm.id] ?? qtdPorNome[rm.name];
        if (qtd !== undefined) json.currentQuantity = qtd;
        return json;
      });
    } catch (error) {
      throw new Error(`Erro ao buscar matérias-primas: ${error.message}`);
    }
  }

  async getById(id, currentUser) {
    try {
      const where = { id };
      
      // Isolamento multi-tenant
      aplicarEmpresaScope(where, currentUser);
      
      const rawMaterial = await RawMaterial.findOne({ where });
      if (!rawMaterial) throw new Error('Matéria-prima não encontrada');
      return rawMaterial;
    } catch (error) {
      throw new Error(`Erro ao buscar matéria-prima: ${error.message}`);
    }
  }

  async update(id, data, currentUser) {
    try {
      const where = { id };
      aplicarEmpresaScope(where, currentUser);
      const rawMaterial = await RawMaterial.findOne({ where });
      if (!rawMaterial) throw new Error('Matéria-prima não encontrada');
      await rawMaterial.update(data);
      await syncToProduct(rawMaterial, rawMaterial.empresa_id);
      return rawMaterial;
    } catch (error) {
      throw new Error(`Erro ao atualizar matéria-prima: ${error.message}`);
    }
  }

  async delete(id, currentUser) {
    try {
      const where = { id };
      aplicarEmpresaScope(where, currentUser);
      const rawMaterial = await RawMaterial.findOne({ where });
      if (!rawMaterial) throw new Error('Matéria-prima não encontrada');
      // Remove o Product espelho antes de deletar
      await Product.destroy({ where: { raw_material_id: rawMaterial.id } }).catch(() => {});
      await rawMaterial.destroy();
      return true;
    } catch (error) {
      throw new Error(`Erro ao deletar matéria-prima: ${error.message}`);
    }
  }
}

export default new RawMaterialService();