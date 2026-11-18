import EntradaInsumoSemNota from '../models/EntradaInsumoSemNota.js';
import Movimento from '../models/Movimento.js';
import Product from '../models/Product.js';
import RawMaterial from '../models/RawMaterial.js';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const arredondar = (valor, casas) => Number(Number(valor).toFixed(casas));

export const registrarHistoricoEntrada = async ({
  empresaId,
  rawMaterialId = null,
  produtoId,
  usuarioId = null,
  quantidade,
  precoUnitario = null,
  precoAnterior = null,
  estoqueAnterior = null,
  estoquePosterior = null,
  dataEntrada = new Date(),
  observacao = null,
  origemTipo = 'entrada_sem_nf',
  origemId = null,
  documento = null
}, transaction) => EntradaInsumoSemNota.create({
  empresa_id: empresaId,
  raw_material_id: rawMaterialId,
  produto_id: produtoId,
  usuario_id: usuarioId,
  quantidade: arredondar(quantidade, 3),
  preco_unitario: precoUnitario === null ? null : arredondar(precoUnitario, 4),
  preco_anterior: precoAnterior === null ? null : arredondar(precoAnterior, 4),
  estoque_anterior: estoqueAnterior === null ? null : arredondar(estoqueAnterior, 3),
  estoque_posterior: estoquePosterior === null ? null : arredondar(estoquePosterior, 3),
  data_entrada: dataEntrada,
  observacao: observacao || null,
  origem_tipo: origemTipo,
  origem_id: origemId,
  documento: documento || null
}, { transaction });

const numeroObrigatorio = (valor, nome) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(`${nome} deve ser maior que zero`);
  }
  return numero;
};

const numeroOpcional = (valor, nome) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${nome} deve ser um valor válido`);
  }
  return numero;
};

const empresaObrigatoria = (usuario) => {
  const empresaId = Number(empresaParaGravar(usuario));
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error('Selecione uma empresa para registrar a entrada');
  }
  return empresaId;
};

const produtoEspelhoDoInsumo = async (insumo, empresaId, transaction) => {
  let produto = await Product.findOne({
    where: {
      empresa_id: empresaId,
      raw_material_id: insumo.id
    },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  // Cadastros antigos podem ainda estar vinculados apenas pelo nome. Vincular
  // esse espelho evita criar um segundo produto para o mesmo insumo.
  if (!produto) {
    produto = await Product.findOne({
      where: {
        empresa_id: empresaId,
        name: insumo.name,
        is_materia_prima: true
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (produto && Number(produto.raw_material_id) !== Number(insumo.id)) {
      await produto.update({ raw_material_id: insumo.id }, { transaction });
    }
  }

  if (produto) return produto;

  return Product.create({
    name: insumo.name,
    price: Number(insumo.price) || 0,
    preco_compra: Number(insumo.price) || 0,
    currentQuantity: Number(insumo.currentQuantity) || 0,
    minQuantity: Number(insumo.minQuantity ?? insumo.min_quantity) || 0,
    unidade_medida: insumo.unit || null,
    is_materia_prima: true,
    category: 'Matéria Prima',
    empresa_id: empresaId,
    raw_material_id: insumo.id
  }, { transaction });
};

class EntradaInsumoSemNotaService {
  async registrar(rawMaterialId, dados, usuario) {
    const empresaId = empresaObrigatoria(usuario);
    const materialId = Number(rawMaterialId);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      throw new Error('Insumo inválido');
    }

    const quantidade = numeroObrigatorio(dados?.quantidade, 'Quantidade');
    const precoUnitario = numeroOpcional(dados?.preco_unitario, 'Custo unitário');
    const observacao = String(dados?.observacao || '').trim();
    if (observacao.length > 1000) {
      throw new Error('A observação pode ter no máximo 1.000 caracteres');
    }

    const transaction = await sequelize.transaction();
    try {
      const insumo = await RawMaterial.findOne({
        where: { id: materialId, empresa_id: empresaId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!insumo) throw new Error('Insumo não encontrado para a empresa selecionada');

      const produto = await produtoEspelhoDoInsumo(insumo, empresaId, transaction);
      const estoqueAnterior = Number(produto.currentQuantity);
      const estoquePosterior = arredondar(estoqueAnterior + quantidade, 3);
      const precoAnterior = Number(produto.price ?? insumo.price ?? 0);

      const atualizacaoProduto = { currentQuantity: estoquePosterior };
      const atualizacaoInsumo = { currentQuantity: estoquePosterior };
      if (precoUnitario !== null) {
        atualizacaoProduto.price = precoUnitario;
        atualizacaoProduto.preco_compra = precoUnitario;
        atualizacaoInsumo.price = precoUnitario;
      }

      await produto.update(atualizacaoProduto, { transaction });
      await insumo.update(atualizacaoInsumo, { transaction });

      const entrada = await registrarHistoricoEntrada({
        empresaId,
        rawMaterialId: insumo.id,
        produtoId: produto.id,
        usuarioId: usuario?.id ?? null,
        quantidade,
        precoUnitario,
        precoAnterior,
        estoqueAnterior,
        estoquePosterior,
        dataEntrada: new Date(),
        observacao,
        origemTipo: 'entrada_sem_nf'
      }, transaction);

      await Movimento.create({
        produto_id: produto.id,
        empresa_id: empresaId,
        usuario_id: usuario?.id ?? null,
        tipo: 'entrada',
        quantidade: arredondar(quantidade, 3),
        motivo: 'Entrada sem NF',
        origem_tipo: 'entrada_sem_nf',
        origem_id: entrada.id,
        data: entrada.data_entrada
      }, { transaction });

      await transaction.commit();
      return entrada;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listar(rawMaterialId, usuario) {
    const empresaId = empresaObrigatoria(usuario);
    const materialId = Number(rawMaterialId);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      throw new Error('Insumo inválido');
    }

    const insumo = await RawMaterial.findOne({
      where: { id: materialId, empresa_id: empresaId }
    });
    if (!insumo) throw new Error('Insumo não encontrado para a empresa selecionada');

    const entradas = await EntradaInsumoSemNota.findAll({
      where: { empresa_id: empresaId, raw_material_id: materialId },
      order: [['data_entrada', 'DESC'], ['id', 'DESC']]
    });

    return {
      insumo: {
        id: insumo.id,
        nome: insumo.name,
        unidade: insumo.unit,
        custo_atual: Number(insumo.price || 0)
      },
      entradas
    };
  }

  async listarPorProduto(productId, usuario) {
    const empresaId = empresaObrigatoria(usuario);
    const produtoId = Number(productId);
    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      throw new Error('Produto inválido');
    }

    const produto = await Product.findOne({
      where: { id: produtoId, empresa_id: empresaId }
    });
    if (!produto) throw new Error('Produto não encontrado para a empresa selecionada');

    const entradas = await EntradaInsumoSemNota.findAll({
      where: { empresa_id: empresaId, produto_id: produtoId },
      order: [['data_entrada', 'DESC'], ['id', 'DESC']]
    });

    return {
      produto: {
        id: produto.id,
        nome: produto.name,
        unidade: produto.unidade_medida,
        custo_atual: Number(produto.preco_compra ?? produto.price ?? 0)
      },
      entradas
    };
  }
}

export default new EntradaInsumoSemNotaService();
