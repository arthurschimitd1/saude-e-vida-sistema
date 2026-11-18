import { Op } from 'sequelize';
import Product from '../models/Product.js';
import RawMaterial from '../models/RawMaterial.js';
import Movimento from '../models/Movimento.js';
import Inventario from '../models/Inventario.js';
import VendaItem from '../models/VendaItem.js';
import OrcamentoItem from '../models/OrcamentoItem.js';
import Fornecedor from '../models/Fornecedor.js';
import sequelize from '../config/database.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

// Alias só pra reaproveitar o helper já criado em utils
const empresaFiltroDe = empresaParaGravar;
const unidadeEhEmbalagem = unidade => ['CX', 'CAIXA', 'CAIXAS', 'PCT', 'PACOTE', 'PACOTES'].includes(
  String(unidade || '').trim().toUpperCase()
);
const rotuloEmbalagem = unidade => ['PCT', 'PACOTE', 'PACOTES'].includes(
  String(unidade || '').trim().toUpperCase()
) ? 'pacote' : 'caixa';
const referenciaEmbalagem = unidade => rotuloEmbalagem(unidade) === 'pacote'
  ? 'este pacote'
  : 'esta caixa';

const CAMPOS_FISCAIS_HERDADOS = [
  'origem',
  'ncm',
  'cfop',
  'cest',
  'cst_csosn',
  'cst_pis',
  'cst_cofins',
  'aliquota_icms',
  'aliquota_pis',
  'aliquota_cofins',
  'aliquota_ipi',
  'ibs_cbs_situacao_tributaria',
  'ibs_cbs_classificacao_tributaria',
];

export const dadosFiscaisHerdados = (produtoOrigem) => Object.fromEntries(
  CAMPOS_FISCAIS_HERDADOS.map(campo => [campo, produtoOrigem?.[campo] ?? null])
);

// Formulários antigos podem enviar booleanos como texto. Boolean('false')
// resulta em true, o que fazia a classificação de matéria-prima voltar
// incorreta após uma edição.
const normalizarBooleano = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalizado = String(value).trim().toLowerCase();
  if (['false', '0', 'nao', 'não', 'off'].includes(normalizado)) return false;
  if (['true', '1', 'sim', 'yes', 'on'].includes(normalizado)) return true;
  return Boolean(value);
};

const validarFornecedor = async (fornecedorId, empresaId, transaction) => {
  if (fornecedorId === null || fornecedorId === undefined || fornecedorId === '') {
    return null;
  }
  if (!Number.isInteger(Number(fornecedorId)) || Number(fornecedorId) <= 0) {
    throw new Error('ID do fornecedor inválido');
  }

  const fornecedor = await Fornecedor.findOne({
    where: { id: Number(fornecedorId), empresa_id: empresaId },
    transaction
  });
  if (!fornecedor) {
    throw new Error('Fornecedor não encontrado para a empresa selecionada');
  }

  return fornecedor.id;
};

class ProductService {
  async createProduct(productData, currentUser) {
    const t = await sequelize.transaction();
    try {
      // Empresa: usa override se MASTER, senão a empresa do usuário
      const empresa = empresaFiltroDe(currentUser) ?? currentUser?.empresa_id ?? null;
      if (!empresa) throw new Error('Selecione uma empresa para cadastrar o produto');
      productData.empresa_id = empresa;
      if (Object.prototype.hasOwnProperty.call(productData, 'is_materia_prima')) {
        productData.is_materia_prima = normalizarBooleano(productData.is_materia_prima);
      }

      if (productData.caixa_origem_id && productData.granel_origem_id) {
        throw new Error('O produto derivado deve possuir somente uma origem: caixa/pacote ou granel');
      }

      if (productData.granel_origem_id) {
        const origemGranel = await Product.findOne({
          where: { id: Number(productData.granel_origem_id), empresa_id: empresa },
          transaction: t,
        });
        if (!origemGranel) throw new Error('Produto de origem do granel não encontrado para esta empresa');

        Object.assign(productData, dadosFiscaisHerdados(origemGranel));
        productData.fornecedor_id = origemGranel.fornecedor_id;
      }

      if (productData.caixa_origem_id) {
        const caixa = await Product.findOne({
          where: { id: Number(productData.caixa_origem_id), empresa_id: empresa },
          transaction: t
        });
        if (!caixa) throw new Error('Caixa ou pacote de origem não encontrado para esta empresa');
        const unidadeOrigem = caixa.unidade_medida || caixa.unidade_comercial || caixa.unidade_tributavel;
        const tipoOrigem = rotuloEmbalagem(unidadeOrigem);
        if (!unidadeEhEmbalagem(unidadeOrigem)) {
          throw new Error('O produto de origem não está cadastrado como caixa ou pacote');
        }
        const unidadesPorCaixa = Number(caixa.unidades_por_caixa);
        if (!Number.isInteger(unidadesPorCaixa) || unidadesPorCaixa <= 0) {
          throw new Error(`O ${tipoOrigem} de origem não possui uma quantidade de unidades válida`);
        }
        const unidadeExistente = await Product.findOne({
          where: {
            empresa_id: empresa,
            caixa_origem_id: caixa.id,
          },
          transaction: t,
        });
        if (unidadeExistente) {
          throw new Error(`Já existe um produto unitário vinculado a ${referenciaEmbalagem(unidadeOrigem)}: "${unidadeExistente.name}"`);
        }
        const custoCaixa = caixa.is_materia_prima
          ? Number(caixa.price || 0)
          : Number(caixa.preco_compra || 0);
        productData.preco_compra = Number((custoCaixa / unidadesPorCaixa).toFixed(2));
        productData.currentQuantity = 0;
        productData.unidades_por_caixa = null;
        productData.unidade_medida = 'UN';
        productData.unidade_comercial = 'UN';
        productData.unidade_tributavel = 'UN';
        productData.fornecedor_id = caixa.fornecedor_id;
        Object.assign(productData, dadosFiscaisHerdados(caixa));
      }

      if (normalizarBooleano(productData.is_materia_prima)) {
        const custoMateriaPrima = productData.price ?? productData.preco_compra ?? 0;
        productData.price = custoMateriaPrima;
        productData.preco_compra = custoMateriaPrima;
      }

      productData.fornecedor_id = await validarFornecedor(productData.fornecedor_id, empresa, t);
      if (productData.code === '') productData.code = null;

      const product = await Product.create(productData, { transaction: t });

      // Se já cadastrou com estoque > 0, registra entrada inicial
      if (product.currentQuantity > 0) {
        await Movimento.create({
          produto_id: product.id,
          empresa_id: empresa,
          usuario_id: currentUser?.id ?? null,
          tipo: 'entrada',
          quantidade: product.currentQuantity,
          motivo: 'Cadastro inicial',
          origem_tipo: 'produto_cadastro',
          origem_id: product.id,
          data: new Date()
        }, { transaction: t });
      }

      await t.commit();
      return product;
    } catch (error) {
      await t.rollback();
      
      // 🔴 LOG COMPLETO DO ERRO (IMPRESCINDÍVEL)
      console.error('❌ ERRO NO createProduct (detalhado):', JSON.stringify(error, null, 2));
      console.error('❌ Nome do erro:', error.name);
      console.error('❌ Mensagem original:', error.message);
      if (error.errors) console.error('❌ Errors array:', error.errors.map(e => ({ path: e.path, message: e.message })));

      // Tratamento específico para cada tipo de erro do Sequelize
      if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => `${e.path || 'campo'}: ${e.message}`).join('; ');
        throw new Error(`Erro de validação: ${messages}`);
      }
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new Error(`Erro de chave estrangeira: ${error.message}. Verifique se o ID da empresa (${productData.empresa_id}) existe na tabela empresas.`);
      }
      if (error.name === 'SequelizeUniqueConstraintError') {
        const camposEnvolvidos = error.errors.map(e => e.path);
        if (camposEnvolvidos.includes('code')) {
          throw new Error(`Este código SKU já está sendo utilizado por outro produto. Escolha um código diferente.`);
        }
        throw new Error(`Valor duplicado: um produto com esses dados já existe.`);
      }
      // Qualquer outro erro (incluindo hook beforeCreate)
      throw new Error(`Erro inesperado ao criar produto: ${error.message}`);
    }
  }

  async getProducts(filters = {}, currentUser) {
    try {
      const where = {};

      if (filters.name) where.name = { [Op.iLike]: `%${filters.name}%` };
      if (filters.category) where.category = { [Op.iLike]: `%${filters.category}%` };
      if (filters.is_materia_prima === 'true') where.is_materia_prima = true;
      if (filters.fornecedor_id) {
        const fornecedorId = Number(filters.fornecedor_id);
        if (!Number.isInteger(fornecedorId) || fornecedorId <= 0) {
          throw new Error('ID do fornecedor inválido');
        }
        where.fornecedor_id = fornecedorId;
      }

      // Isolamento multi-tenant (com suporte a override do MASTER)
      const empresa = empresaFiltroDe(currentUser);
      if (empresa) where.empresa_id = empresa;

      const products = await Product.findAll({ where, order: [['name', 'ASC']] });

      let filteredProducts = products;
      if (filters.stockStatus === 'below') {
        filteredProducts = products.filter(p => Number(p.currentQuantity) < Number(p.minQuantity));
      } else if (filters.stockStatus === 'ok') {
        filteredProducts = products.filter(p => Number(p.currentQuantity) >= Number(p.minQuantity));
      }

      return filteredProducts;
    } catch (error) {
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
  }

  async updateProduct(id, productData, currentUser) {
    const t = await sequelize.transaction();
    try {
      const where = { id };
      const empresa = empresaFiltroDe(currentUser);
      if (empresa) where.empresa_id = empresa;

      const product = await Product.findOne({ where, transaction: t });
      if (!product) {
        await t.rollback();
        throw new Error('Produto não encontrado');
      }

      const qtdAntes = Number(product.currentQuantity);
      const recebeuQuantidade = Object.prototype.hasOwnProperty.call(productData, 'currentQuantity')
        && productData.currentQuantity != null;
      const qtdDepois = recebeuQuantidade ? Number(productData.currentQuantity) : qtdAntes;
      if (recebeuQuantidade && !Number.isFinite(qtdDepois)) {
        throw new Error('Quantidade atual inválida');
      }
      if (Object.prototype.hasOwnProperty.call(productData, 'fornecedor_id')) {
        productData.fornecedor_id = await validarFornecedor(productData.fornecedor_id, product.empresa_id, t);
      }
      const materiaPrimaAtualizada = Object.prototype.hasOwnProperty.call(productData, 'is_materia_prima')
        ? normalizarBooleano(productData.is_materia_prima)
        : Boolean(product.is_materia_prima);
      if (Object.prototype.hasOwnProperty.call(productData, 'is_materia_prima')) {
        productData.is_materia_prima = materiaPrimaAtualizada;
      }
      if (materiaPrimaAtualizada) {
        const recebeuPrice = Object.prototype.hasOwnProperty.call(productData, 'price');
        const recebeuPrecoCompra = Object.prototype.hasOwnProperty.call(productData, 'preco_compra');
        const custoMateriaPrima = recebeuPrice
          ? productData.price
          : (recebeuPrecoCompra ? productData.preco_compra : product.price);
        productData.price = custoMateriaPrima ?? 0;
        productData.preco_compra = custoMateriaPrima ?? 0;
      }
      // Normaliza code: string vazia → null para não violar o índice único (empresa_id, code) WHERE code IS NOT NULL
      if (productData.code === '') productData.code = null;
      await product.update(productData, { transaction: t });

      // Se a quantidade mudou, registra movimento e sincroniza raw_materials
      const diff = qtdDepois - qtdAntes;
      if (recebeuQuantidade && Math.abs(diff) >= 0.0005) {
        await Movimento.create({
          produto_id: product.id,
          empresa_id: product.empresa_id ?? null,
          usuario_id: currentUser?.id ?? null,
          tipo: diff > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(diff),
          motivo: 'Edição manual',
          origem_tipo: 'produto_edicao',
          origem_id: product.id,
          data: new Date()
        }, { transaction: t });

        if (product.raw_material_id && qtdDepois >= 0) {
          await RawMaterial.update(
            { currentQuantity: qtdDepois },
            { where: { id: product.raw_material_id }, transaction: t }
          );
        }
      }

      await t.commit();
      return product;
    } catch (error) {
      await t.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') {
        const camposEnvolvidos = error.errors.map(e => e.path);
        if (camposEnvolvidos.includes('code')) {
          throw new Error(`Este código SKU já está sendo utilizado por outro produto. Escolha um código diferente.`);
        }
        throw new Error(`Valor duplicado: um produto com esses dados já existe.`);
      }
      throw new Error(`Erro ao atualizar produto: ${error.message}`);
    }
  }

  async transferBoxes({ origem_id, unidade_id, quantidade_caixas }, currentUser) {
    const origemId = Number(origem_id);
    const unidadeId = Number(unidade_id);
    const quantidadeCaixas = Number(quantidade_caixas);
    if (!Number.isInteger(origemId) || origemId <= 0
      || !Number.isInteger(unidadeId) || unidadeId <= 0
      || !Number.isInteger(quantidadeCaixas) || quantidadeCaixas <= 0) {
      throw new Error('origem_id, unidade_id e quantidade_caixas (inteiro maior que zero) são obrigatórios');
    }

    const empresa = empresaFiltroDe(currentUser);
    if (!empresa) throw new Error('Selecione uma empresa para transferir o estoque');

    const t = await sequelize.transaction();
    try {
      const origem = await Product.findOne({
        where: { id: origemId, empresa_id: empresa },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const unidade = await Product.findOne({
        where: { id: unidadeId, empresa_id: empresa },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!origem) throw new Error('Embalagem de origem não encontrada');
      if (!unidade) throw new Error('Produto unitário não encontrado');
      const unidadeOrigem = origem.unidade_medida || origem.unidade_comercial || origem.unidade_tributavel;
      const tipoOrigem = rotuloEmbalagem(unidadeOrigem);
      if (!unidadeEhEmbalagem(unidadeOrigem)) {
        throw new Error('O produto de origem não está cadastrado como caixa ou pacote');
      }
      if (Number(unidade.caixa_origem_id) !== origem.id) {
        throw new Error(`O produto unitário não pertence a ${referenciaEmbalagem(unidadeOrigem)}`);
      }

      const unidadesPorCaixa = Number(origem.unidades_por_caixa);
      if (!Number.isInteger(unidadesPorCaixa) || unidadesPorCaixa <= 0) {
        throw new Error(`Informe quantas unidades existem por ${tipoOrigem} no cadastro do produto`);
      }

      const estoqueOrigem = Number(origem.currentQuantity);
      if (estoqueOrigem < quantidadeCaixas) {
        throw new Error(
          `Estoque insuficiente: "${origem.name}" tem ${estoqueOrigem} ${tipoOrigem}(s), precisa ${quantidadeCaixas}`
        );
      }

      const quantidadeUnidades = quantidadeCaixas * unidadesPorCaixa;
      const estoqueUnidade = Number(unidade.currentQuantity);
      const usuarioId = currentUser?.id ?? null;
      const novoEstoqueOrigem = estoqueOrigem - quantidadeCaixas;
      const novoEstoqueUnidade = estoqueUnidade + quantidadeUnidades;

      await origem.update({ currentQuantity: novoEstoqueOrigem }, { transaction: t });
      await Movimento.create({
        produto_id: origem.id,
        empresa_id: empresa,
        usuario_id: usuarioId,
        tipo: 'saida',
        quantidade: quantidadeCaixas,
        motivo: `Transferência para unidades — ${unidade.name}`,
        origem_tipo: 'caixa_transferencia',
        origem_id: unidade.id,
        data: new Date()
      }, { transaction: t });

      await unidade.update({ currentQuantity: novoEstoqueUnidade }, { transaction: t });
      await Movimento.create({
        produto_id: unidade.id,
        empresa_id: empresa,
        usuario_id: usuarioId,
        tipo: 'entrada',
        quantidade: quantidadeUnidades,
        motivo: `Conversão de ${quantidadeCaixas} ${tipoOrigem}(s) — ${origem.name}`,
        origem_tipo: 'caixa_transferencia',
        origem_id: origem.id,
        data: new Date()
      }, { transaction: t });

      await t.commit();
      return {
        ok: true,
        quantidade_caixas: quantidadeCaixas,
        tipo_origem: tipoOrigem,
        quantidade_unidades: quantidadeUnidades,
        origem: { id: origem.id, currentQuantity: novoEstoqueOrigem },
        unidade: { id: unidade.id, currentQuantity: novoEstoqueUnidade },
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async linkLegacyBoxUnit({ origem_id, unidade_id }, currentUser) {
    const origemId = Number(origem_id);
    const unidadeId = Number(unidade_id);
    if (!Number.isInteger(origemId) || origemId <= 0 || !Number.isInteger(unidadeId) || unidadeId <= 0) {
      throw new Error('origem_id e unidade_id são obrigatórios');
    }

    const empresa = empresaFiltroDe(currentUser);
    if (!empresa) throw new Error('Selecione uma empresa para vincular o produto');

    const t = await sequelize.transaction();
    try {
      const origem = await Product.findOne({
        where: { id: origemId, empresa_id: empresa },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const unidade = await Product.findOne({
        where: { id: unidadeId, empresa_id: empresa },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!origem) throw new Error('Embalagem de origem não encontrada');
      if (!unidade) throw new Error('Produto unitário não encontrado');
      const unidadeOrigem = origem.unidade_medida || origem.unidade_comercial || origem.unidade_tributavel;
      const tipoOrigem = rotuloEmbalagem(unidadeOrigem);
      if (!unidadeEhEmbalagem(unidadeOrigem)) {
        throw new Error('O produto de origem não está cadastrado como caixa ou pacote');
      }
      if (unidade.caixa_origem_id && Number(unidade.caixa_origem_id) !== origem.id) {
        throw new Error('O produto unitário já pertence a outra caixa ou pacote');
      }

      const unidadesPorCaixa = Number(origem.unidades_por_caixa);
      if (!Number.isInteger(unidadesPorCaixa) || unidadesPorCaixa <= 0) {
        throw new Error(`O ${tipoOrigem} de origem não possui uma quantidade de unidades válida`);
      }
      const codigoLegado = origem.code ? `${origem.code}-UN` : null;
      const nomeLegado = `${origem.name} (UN)`.trim().toLocaleLowerCase('pt-BR');
      const correspondeAoLegado = (codigoLegado && unidade.code === codigoLegado)
        || String(unidade.name || '').trim().toLocaleLowerCase('pt-BR') === nomeLegado;
      if (!correspondeAoLegado) {
        throw new Error(`O produto informado não corresponde à unidade criada anteriormente para ${referenciaEmbalagem(unidadeOrigem)}`);
      }

      const custoCaixa = origem.is_materia_prima
        ? Number(origem.price || 0)
        : Number(origem.preco_compra || 0);
      await unidade.update({
        caixa_origem_id: origem.id,
        preco_compra: Number((custoCaixa / unidadesPorCaixa).toFixed(2)),
        unidade_medida: 'UN',
        unidade_comercial: 'UN',
        unidade_tributavel: 'UN',
        unidades_por_caixa: null,
      }, { transaction: t });

      await t.commit();
      return unidade;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async deleteProduct(id, currentUser) {
    const t = await sequelize.transaction();
    try {
      // Busca por id sem filtro de empresa primeiro — o filtro de empresa pode falhar
      // se o produto foi criado com empresa_id diferente (import, troca de conta, etc.)
      const product = await Product.findByPk(id);
      if (!product) throw new Error('Produto não encontrado');

      // Valida que o produto pertence à empresa do usuário (ou empresa_id nulo = legado)
      const empresa = empresaFiltroDe(currentUser);
      if (empresa && product.empresa_id !== null && Number(product.empresa_id) !== Number(empresa)) {
        throw new Error('Produto não encontrado');
      }

      // Limpa dependências na ordem certa para evitar FK violations
      await Inventario.destroy({ where: { produto_id: id }, transaction: t });
      await Movimento.destroy({ where: { produto_id: id }, transaction: t });
      // VendaItem e OrcamentoItem: allowNull=true → nullifica para preservar histórico
      await VendaItem.update({ produto_id: null }, { where: { produto_id: id }, transaction: t });
      await OrcamentoItem.update({ produto_id: null }, { where: { produto_id: id }, transaction: t });
      await Product.update(
        { caixa_origem_id: null },
        { where: { caixa_origem_id: id, empresa_id: product.empresa_id }, transaction: t }
      );

      await product.destroy({ transaction: t });

      await t.commit();
      return { success: true };
    } catch (error) {
      await t.rollback();
      throw new Error(`Erro ao deletar produto: ${error.message}`);
    }
  }
}

export default new ProductService();
export { normalizarBooleano };
