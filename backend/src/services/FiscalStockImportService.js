import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Product from '../models/Product.js';
import Movimento from '../models/Movimento.js';
import RawMaterial from '../models/RawMaterial.js';
import Fornecedor from '../models/Fornecedor.js';
import FiscalProductMapping from '../models/FiscalProductMapping.js';
import FiscalStockImport from '../models/FiscalStockImport.js';
import FiscalStockImportItem from '../models/FiscalStockImportItem.js';
import { registrarHistoricoEntrada } from './EntradaInsumoSemNotaService.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const arrayDe = value => value == null ? [] : (Array.isArray(value) ? value : [value]);
const numero = value => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const texto = value => String(value ?? '').trim();
const documento = value => texto(value).replace(/\D/g, '');
const normalizar = value => texto(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();
const codigoBarrasValido = value => {
  const codigo = texto(value);
  return codigo && !['SEM GTIN', 'SEMGTIN'].includes(codigo.toUpperCase()) ? codigo : null;
};
const primeiraChave = value => {
  if (!value || typeof value !== 'object') return {};
  const key = Object.keys(value)[0];
  return key ? value[key] : {};
};

export const chaveExternaItem = item => (
  texto(item.external_code)
    ? `codigo:${normalizar(item.external_code)}`
    : `descricao:${normalizar(item.description)}`
);

export const dadosAtualizacaoProdutoExistente = (product, item, supplier) => ({
  currentQuantity: Number(product.currentQuantity) + item.quantity,
  preco_compra: item.unit_cost > 0 ? item.unit_cost : product.preco_compra,
  fornecedor_id: supplier?.id ?? product.fornecedor_id
});

export const parseNFeXml = xmlContent => {
  const xml = Buffer.isBuffer(xmlContent) ? xmlContent.toString('utf8') : texto(xmlContent);
  if (!xml) throw new Error('XML da nota não informado');

  let parsed;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false
    }).parse(xml);
  } catch {
    throw new Error('XML da nota inválido');
  }

  const nfe = parsed?.nfeProc?.NFe ?? parsed?.NFe;
  const infNFe = nfe?.infNFe;
  if (!infNFe) throw new Error('O arquivo não contém uma NF-e válida');

  const emit = infNFe.emit ?? {};
  const emitAddress = emit.enderEmit ?? {};
  const supplierDocument = documento(emit.CNPJ ?? emit.CPF);
  const accessKey = texto(infNFe['@_Id']).replace(/^NFe/i, '')
    || texto(parsed?.nfeProc?.protNFe?.infProt?.chNFe);
  const details = arrayDe(infNFe.det);
  if (!details.length) throw new Error('Nenhum produto encontrado no XML');

  const items = details.map((det, index) => {
    const prod = det?.prod ?? {};
    const icms = primeiraChave(det?.imposto?.ICMS);
    return {
      item_key: texto(det?.['@_nItem']) || String(index + 1),
      external_code: texto(prod.cProd) || null,
      description: texto(prod.xProd),
      quantity: numero(prod.qCom),
      unit_cost: numero(prod.vUnCom),
      total: numero(prod.vProd),
      commercial_unit: texto(prod.uCom) || null,
      taxable_unit: texto(prod.uTrib) || texto(prod.uCom) || null,
      barcode: codigoBarrasValido(prod.cEANTrib ?? prod.cEAN),
      ncm: texto(prod.NCM) || null,
      cest: texto(prod.CEST) || null,
      origem: texto(icms?.orig) === '' ? null : numero(icms.orig),
      cst_csosn: texto(icms?.CST ?? icms?.CSOSN) || null
    };
  }).filter(item => item.description && item.quantity > 0);

  if (!items.length) throw new Error('Nenhum produto com quantidade válida foi encontrado no XML');

  return {
    source_hash: crypto.createHash('sha256').update(xml).digest('hex'),
    access_key: accessKey || null,
    invoice_number: texto(infNFe.ide?.nNF) || null,
    issued_at: texto(infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi) || null,
    supplier_document: supplierDocument,
    supplier_name: texto(emit.xNome) || null,
    supplier_snapshot: {
      nomeCompleto: texto(emit.xNome) || null,
      cpf: texto(emit.CPF) || null,
      cnpj: texto(emit.CNPJ) || null,
      email: texto(emit.email) || null,
      telefone: texto(emitAddress.fone) || null,
      cep: texto(emitAddress.CEP) || null,
      rua: texto(emitAddress.xLgr) || null,
      bairro: texto(emitAddress.xBairro) || null,
      cidade: texto(emitAddress.xMun) || null,
      estado: texto(emitAddress.UF) || null,
      pais: texto(emitAddress.xPais) || 'Brasil',
      numero: texto(emitAddress.nro) || null,
      complemento: texto(emitAddress.xCpl) || null,
      inscricao_estadual: texto(emit.IE) || null
    },
    items
  };
};

const scoreProduto = (item, product) => {
  const nomeItem = normalizar(item.description);
  const nomeProduto = normalizar(product.name);
  if (item.barcode && item.barcode === texto(product.codigo_barras)) return 100;
  if (item.external_code && normalizar(item.external_code) === normalizar(product.code)) return 95;
  if (nomeItem === nomeProduto) return 90;
  const palavrasItem = new Set(nomeItem.split(' ').filter(Boolean));
  const palavrasProduto = new Set(nomeProduto.split(' ').filter(Boolean));
  if (!palavrasItem.size || !palavrasProduto.size) return 0;
  const comuns = [...palavrasItem].filter(word => palavrasProduto.has(word)).length;
  return Math.round((comuns / Math.max(palavrasItem.size, palavrasProduto.size)) * 70);
};

class FiscalStockImportService {
  empresaId(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para importar a nota');
    return Number(empresaId);
  }

  async preview(xmlContent, currentUser) {
    const empresaId = this.empresaId(currentUser);
    const parsed = parseNFeXml(xmlContent);
    const [products, mappings, imported] = await Promise.all([
      Product.findAll({
        where: { empresa_id: empresaId },
        attributes: ['id', 'name', 'code', 'codigo_barras', 'currentQuantity', 'unidade_medida'],
        order: [['name', 'ASC']]
      }),
      FiscalProductMapping.findAll({
        where: {
          empresa_id: empresaId,
          supplier_document: parsed.supplier_document || ''
        }
      }),
      FiscalStockImport.findOne({
        where: {
          empresa_id: empresaId,
          [Op.or]: [
            { source_hash: parsed.source_hash },
            ...(parsed.access_key ? [{ access_key: parsed.access_key }] : [])
          ]
        }
      })
    ]);

    const mappingByKey = new Map(mappings.map(mapping => [mapping.external_key, Number(mapping.product_id)]));
    const productIds = new Set(products.map(product => Number(product.id)));
    const items = parsed.items.map(item => {
      const externalKey = chaveExternaItem(item);
      const mappedId = mappingByKey.get(externalKey);
      const ranked = products
        .map(product => ({ product, score: scoreProduto(item, product) }))
        .filter(candidate => candidate.score >= 35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      const suggestedId = mappedId && productIds.has(mappedId)
        ? mappedId
        : (ranked[0]?.score >= 85 ? Number(ranked[0].product.id) : null);

      return {
        ...item,
        external_key: externalKey,
        suggested_product_id: suggestedId,
        suggestion_reason: mappedId && productIds.has(mappedId)
          ? 'Vínculo salvo anteriormente'
          : (suggestedId ? 'Correspondência por código, barras ou nome' : null),
        candidates: ranked.map(({ product, score }) => ({
          id: Number(product.id),
          name: product.name,
          code: product.code,
          score
        }))
      };
    });

    return {
      source_hash: parsed.source_hash,
      access_key: parsed.access_key,
      invoice_number: parsed.invoice_number,
      supplier_document: parsed.supplier_document,
      supplier_name: parsed.supplier_name,
      already_imported: Boolean(imported),
      imported_at: imported?.imported_at ?? null,
      items,
      products: products.map(product => ({
        id: Number(product.id),
        name: product.name,
        code: product.code,
        currentQuantity: Number(product.currentQuantity),
        unidade_medida: product.unidade_medida
      }))
    };
  }

  async apply(xmlContent, decisions, currentUser, sourceType = 'xml_upload') {
    const empresaId = this.empresaId(currentUser);
    const parsed = parseNFeXml(xmlContent);
    const decisionMap = new Map(arrayDe(decisions).map(decision => [String(decision.item_key), decision]));
    for (const item of parsed.items) {
      const decision = decisionMap.get(String(item.item_key));
      if (!decision || !['link', 'create', 'skip'].includes(decision.action)) {
        throw new Error(`Defina o destino do item "${item.description}"`);
      }
    }
    if (!parsed.items.some(item => decisionMap.get(String(item.item_key)).action !== 'skip')) {
      throw new Error('Selecione ao menos um produto para vincular ou criar');
    }

    const t = await sequelize.transaction();

    try {
      const duplicate = await FiscalStockImport.findOne({
        where: {
          empresa_id: empresaId,
          [Op.or]: [
            { source_hash: parsed.source_hash },
            ...(parsed.access_key ? [{ access_key: parsed.access_key }] : [])
          ]
        },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (duplicate) {
        const error = new Error('Esta nota já foi importada para o estoque');
        error.status = 409;
        throw error;
      }

      const suppliers = parsed.supplier_document
        ? await Fornecedor.findAll({ where: { empresa_id: empresaId }, transaction: t })
        : [];
      const supplier = suppliers.find(item =>
        [item.cnpj, item.cpf].some(value => documento(value) === parsed.supplier_document)
      ) ?? null;

      const stockImport = await FiscalStockImport.create({
        empresa_id: empresaId,
        source_hash: parsed.source_hash,
        access_key: parsed.access_key,
        source_type: sourceType,
        invoice_number: parsed.invoice_number,
        issued_at: parsed.issued_at,
        supplier_document: parsed.supplier_document || null,
        supplier_name: parsed.supplier_name,
        supplier_snapshot: parsed.supplier_snapshot,
        imported_by: currentUser?.id ?? null,
        imported_at: new Date()
      }, { transaction: t });

      const result = { linked: 0, created: 0, skipped: 0, items: [] };
      for (const item of parsed.items) {
        const decision = decisionMap.get(String(item.item_key));
        if (decision.action === 'skip') {
          result.skipped += 1;
          continue;
        }

        let product;
        const produtoCriadoAgora = decision.action === 'create';
        if (decision.action === 'link') {
          const productId = Number(decision.product_id);
          if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error(`Selecione o produto correspondente a "${item.description}"`);
          }
          product = await Product.findOne({
            where: { id: productId, empresa_id: empresaId },
            transaction: t,
            lock: t.LOCK.UPDATE
          });
          if (!product) throw new Error(`Produto vinculado a "${item.description}" não encontrado nesta empresa`);
          result.linked += 1;
        } else {
          const name = texto(decision.new_name) || item.description;
          const externalCodeInUse = item.external_code
            ? await Product.findOne({
                where: { empresa_id: empresaId, code: item.external_code },
                transaction: t
              })
            : null;
          product = await Product.create({
            empresa_id: empresaId,
            name,
            code: externalCodeInUse ? null : item.external_code,
            fornecedor_id: supplier?.id ?? null,
            price: 0,
            preco_compra: item.unit_cost,
            minQuantity: 0,
            currentQuantity: 0,
            unidade_medida: item.commercial_unit,
            unidade_comercial: item.commercial_unit,
            unidade_tributavel: item.taxable_unit,
            codigo_barras: item.barcode,
            ncm: item.ncm,
            cest: item.cest,
            origem: item.origem
          }, { transaction: t });
          result.created += 1;
        }

        const estoqueAnterior = Number(product.currentQuantity) || 0;
        let materiaPrima = null;
        if (product.raw_material_id) {
          materiaPrima = await RawMaterial.findOne({
            where: { id: product.raw_material_id, empresa_id: empresaId },
            transaction: t,
            lock: t.LOCK.UPDATE
          });
        }
        const precoAnterior = produtoCriadoAgora
          ? 0
          : Number(materiaPrima?.price ?? product.preco_compra ?? product.price ?? 0);
        const precoUnitario = item.unit_cost > 0 ? item.unit_cost : null;
        const updates = dadosAtualizacaoProdutoExistente(product, item, supplier);
        const nextQuantity = updates.currentQuantity;
        await product.update(updates, { transaction: t });

        if (materiaPrima) {
          const atualizacaoInsumo = { currentQuantity: nextQuantity };
          if (precoUnitario !== null) atualizacaoInsumo.price = precoUnitario;
          await materiaPrima.update(atualizacaoInsumo, { transaction: t });
        }

        await Movimento.create({
          produto_id: product.id,
          empresa_id: empresaId,
          usuario_id: currentUser?.id ?? null,
          tipo: 'entrada',
          quantidade: item.quantity,
          motivo: `Entrada pela NF-e ${parsed.invoice_number || parsed.access_key || ''}`.trim(),
          origem_tipo: 'nota_fiscal_entrada',
          origem_id: stockImport.id,
          data: new Date()
        }, { transaction: t });

        await registrarHistoricoEntrada({
          empresaId,
          rawMaterialId: materiaPrima?.id ?? product.raw_material_id ?? null,
          produtoId: product.id,
          usuarioId: currentUser?.id ?? null,
          quantidade: item.quantity,
          precoUnitario,
          precoAnterior,
          estoqueAnterior,
          estoquePosterior: nextQuantity,
          dataEntrada: stockImport.issued_at || stockImport.imported_at || new Date(),
          observacao: parsed.supplier_name ? `Fornecedor: ${parsed.supplier_name}` : null,
          origemTipo: 'nota_fiscal_entrada',
          origemId: stockImport.id,
          documento: `NF-e ${parsed.invoice_number || parsed.access_key || 'sem número'}`
        }, t);

        await FiscalStockImportItem.create({
          import_id: stockImport.id,
          product_id: product.id,
          external_code: item.external_code,
          description: item.description,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          action: decision.action
        }, { transaction: t });

        const mappingWhere = {
          empresa_id: empresaId,
          supplier_document: parsed.supplier_document || '',
          external_key: chaveExternaItem(item)
        };
        const mapping = await FiscalProductMapping.findOne({ where: mappingWhere, transaction: t });
        const mappingData = {
          external_code: item.external_code,
          last_description: item.description,
          product_id: product.id
        };
        if (mapping) await mapping.update(mappingData, { transaction: t });
        else await FiscalProductMapping.create({ ...mappingWhere, ...mappingData }, { transaction: t });

        result.items.push({
          item_key: item.item_key,
          product_id: Number(product.id),
          product_name: product.name,
          quantity: item.quantity,
          currentQuantity: nextQuantity,
          action: decision.action
        });
      }

      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') {
        const duplicateError = new Error('Esta nota já foi importada para o estoque');
        duplicateError.status = 409;
        throw duplicateError;
      }
      throw error;
    }
  }
}

export default new FiscalStockImportService();
