import axios from 'axios';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import NuvemshopIntegracao from '../models/NuvemshopIntegracao.js';
import NuvemshopProdutoVinculo from '../models/NuvemshopProdutoVinculo.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';
import EstoqueRoupaFoto from '../models/EstoqueRoupaFoto.js';
import EstoqueRoupaMovimento from '../models/EstoqueRoupaMovimento.js';
import ApiError from '../utils/apiError.js';
import { decryptCredential } from '../utils/credentialCrypto.js';
import { codigoProdutoNuvemshop, normalizarTextoEstoque } from '../utils/estoqueRoupaNuvemshopCsv.js';
import titoPackCuecas from '../data/titoPackCuecas.cjs';

const API_VERSION = '2025-03';
const API_ORIGIN = String(process.env.NUVEMSHOP_API_ORIGIN || 'https://api.nuvemshop.com.br').replace(/\/+$/, '');
const USER_AGENT = String(process.env.NUVEMSHOP_USER_AGENT || 'LucroMais (https://lucromais-frontend-mssolucoes.vercel.app)').trim();
const SIZE_NAMES = new Set(['tamanho', 'tam', 'size', 'talle']);
const WEBHOOK_EVENTS = ['product/created', 'product/updated', 'product/deleted', 'app/suspended', 'app/resumed', 'app/uninstalled'];

const localized = (value) => {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value).trim();
  return String(value.pt_BR || value.pt || value.es || value.en || Object.values(value).find(Boolean) || '').trim();
};

const finiteMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const managedStock = (variant) => {
  if (variant?.stock_management !== true) return null;
  if (Array.isArray(variant.inventory_levels) && variant.inventory_levels.length > 0) {
    const stocks = variant.inventory_levels.map(level => (
      level?.stock == null || level.stock === '' ? null : Number(level.stock)
    ));
    if (stocks.every(stock => Number.isInteger(stock) && stock >= 0)) {
      return stocks.reduce((total, stock) => total + stock, 0);
    }
  }
  if (variant?.stock == null || variant?.stock === '') return null;
  const stock = Number(variant.stock);
  return Number.isInteger(stock) && stock >= 0 ? stock : null;
};

const variantLabels = (product, variant) => {
  const attributes = Array.isArray(product?.attributes) ? product.attributes.map(localized) : [];
  const values = Array.isArray(variant?.values) ? variant.values.map(localized) : [];
  const pairs = values.map((value, index) => ({ name: normalizarTextoEstoque(attributes[index]), value })).filter(pair => pair.value);
  const sizePair = pairs.find(pair => SIZE_NAMES.has(pair.name));
  const slug = localized(product?.handle);
  const cor = pairs.filter(pair => !SIZE_NAMES.has(pair.name)).map(pair => pair.value).join(' / ')
    || titoPackCuecas[slug]?.composicao
    || null;
  return { tamanho: sizePair?.value || 'Único', cor };
};

const selectProductVariants = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const entries = variants.map(variant => ({ variant, labels: variantLabels(product, variant) }));
  const sizesWithDetailedVariant = new Set(entries
    .filter(entry => normalizarTextoEstoque(entry.labels.cor))
    .map(entry => normalizarTextoEstoque(entry.labels.tamanho)));
  const superseded = entries.filter(entry => (
    !normalizarTextoEstoque(entry.labels.cor)
    && sizesWithDetailedVariant.has(normalizarTextoEstoque(entry.labels.tamanho))
  ));
  const supersededIds = new Set(superseded.map(entry => String(entry.variant.id)));
  return {
    active: entries.filter(entry => !supersededIds.has(String(entry.variant.id))),
    superseded,
  };
};

const variationKey = (tamanho, cor) => `${normalizarTextoEstoque(tamanho)}|${normalizarTextoEstoque(cor)}`;
const originSlug = (roupa) => String(roupa?.observacao || '').match(/Origem Nuvemshop:\s*([^\s]+)/i)?.[1] || '';
const uniqueRemoteProductIds = (mappings = []) => [...new Set(mappings
  .map(mapping => mapping?.nuvemshop_product_id)
  .filter(value => value != null && value !== '')
  .map(Number)
  .filter(value => Number.isSafeInteger(value) && value > 0))];

const scopeList = (integration) => String(integration?.scopes || '').split(/[\s,]+/).map(item => item.trim()).filter(Boolean);

const ensureScope = (integration, scope) => {
  const scopes = scopeList(integration);
  const granted = scopes.includes(scope) || (scope === 'read_products' && scopes.includes('write_products'));
  if (!granted) {
    throw new ApiError(403, `A loja precisa ser reconectada com a permissão ${scope}`);
  }
};

const getIntegration = async (empresaId, { write = false } = {}) => {
  const integration = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
  if (!integration) throw new ApiError(409, 'Conecte a loja Nuvemshop antes de sincronizar');
  ensureScope(integration, write ? 'write_products' : 'read_products');
  return integration;
};

const clientFor = (integration) => axios.create({
  baseURL: `${API_ORIGIN}/${API_VERSION}/${integration.store_id}`,
  timeout: 20000,
  headers: {
    Authorization: `Bearer ${decryptCredential(integration.access_token_encrypted)}`,
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
  },
});

const apiRequest = async (client, config, attempt = 0) => {
  try {
    return await client.request(config);
  } catch (error) {
    const status = Number(error?.response?.status);
    if (attempt < 2 && (status === 429 || status >= 500)) {
      const retryAfter = Math.min(5, Math.max(1, Number(error?.response?.headers?.['retry-after']) || (attempt + 1)));
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiRequest(client, config, attempt + 1);
    }
    throw error;
  }
};

const remoteError = (error) => {
  const details = error?.response?.data?.description || error?.response?.data?.message || error?.message;
  return String(details || 'Falha na API da Nuvemshop').slice(0, 1000);
};

const firstProductImage = (product) => (Array.isArray(product?.images) ? product.images : [])
  .map(image => ({ id: image?.id, src: String(image?.src || '').trim() }))
  .find(image => image.src)?.src || null;

const variantImages = (product, variant, includeGenericImages = false) => {
  const images = (Array.isArray(product?.images) ? product.images : [])
    .map(image => ({ id: image?.id, src: String(image?.src || '').trim() }))
    .filter(image => image.src);
  const preferred = variant?.image_id ? images.find(image => String(image.id) === String(variant.image_id)) : null;
  const assignedImageIds = new Set((Array.isArray(product?.variants) ? product.variants : [])
    .map(item => item?.image_id)
    .filter(value => value != null)
    .map(String));
  const generic = includeGenericImages ? images.filter(image => !assignedImageIds.has(String(image.id))) : [];
  return [
    ...(preferred ? [{ ...preferred, kind: 'variant' }] : []),
    ...generic.map(image => ({ ...image, kind: 'product' })),
  ];
};

const syncImages = async (product, variant, variacaoId, transaction, includeGenericImages = false) => {
  const selected = variantImages(product, variant, includeGenericImages);
  const existing = await EstoqueRoupaFoto.findAll({ where: { variacao_id: variacaoId }, transaction });
  const stale = existing.filter(photo => {
    const publicId = String(photo.public_id || '');
    return publicId.startsWith(`nuvemshop-api:${product.id}:`) || publicId.startsWith('nuvemshop:');
  });
  if (stale.length) {
    await EstoqueRoupaFoto.destroy({ where: { id: stale.map(photo => photo.id) }, transaction });
  }
  const staleIds = new Set(stale.map(photo => Number(photo.id)));
  const kept = existing.filter(photo => !staleIds.has(Number(photo.id)));
  const urls = new Set(kept.map(photo => photo.foto_url));
  const records = [];
  for (const [index, image] of selected.entries()) {
    if (urls.has(image.src)) continue;
    records.push({
      variacao_id: variacaoId,
      foto_url: image.src,
      public_id: `nuvemshop-api:${product.id}:${image.id || index}:${variacaoId}:${image.kind}`,
      ordem: kept.length + records.length,
    });
    urls.add(image.src);
  }
  if (records.length) await EstoqueRoupaFoto.bulkCreate(records, { transaction });
  return records.length;
};

const findLocalProduct = ({ product, products, mappings }) => {
  const remoteProductId = String(product.id);
  const slug = localized(product.handle);
  const linked = mappings.find(mapping => String(mapping.nuvemshop_product_id) === String(product.id) && mapping.roupa_id);
  if (linked) {
    const byLink = products.find(item => Number(item.id) === Number(linked.roupa_id));
    if (byLink) {
      const productIdsOnSameCard = [...new Set(mappings
        .filter(mapping => Number(mapping.roupa_id) === Number(byLink.id))
        .map(mapping => String(mapping.nuvemshop_product_id)))];
      if (productIdsOnSameCard.length <= 1) return byLink;
      const localSlug = originSlug(byLink);
      if (localSlug && localSlug === slug) return byLink;
      if (!localSlug && productIdsOnSameCard.sort()[0] === remoteProductId) return byLink;
      // Uma sincronização antiga podia unir cadastros homônimos em um único
      // card. Os demais IDs são recriados abaixo e seus vínculos são movidos.
    }
  }
  const bySlug = products.find(item => originSlug(item) === slug || item.codigo === codigoProdutoNuvemshop(slug));
  if (bySlug) return bySlug;
  // Nome não identifica produto: a Nuvemshop permite vários cadastros com o
  // mesmo nome, mas fotos, cores, preço e identificador URL independentes.
  return null;
};

const findLocalVariation = ({ variant, labels, roupa, existingMapping, usedIds }) => {
  if (existingMapping?.variacao_id) {
    const linked = roupa.variacoes.find(item => Number(item.id) === Number(existingMapping.variacao_id));
    if (linked && !usedIds.has(Number(linked.id))) return linked;
  }
  const key = variationKey(labels.tamanho, labels.cor);
  const exact = roupa.variacoes.find(item => !usedIds.has(Number(item.id)) && variationKey(item.tamanho, item.cor) === key);
  if (exact) return exact;
  const sameSize = roupa.variacoes.filter(item => !usedIds.has(Number(item.id))
    && normalizarTextoEstoque(item.tamanho) === normalizarTextoEstoque(labels.tamanho));
  if (!labels.cor && sameSize.length === 1) return sameSize[0];
  if ((variant?.values || []).length === 0 && roupa.variacoes.length === 1 && !usedIds.has(Number(roupa.variacoes[0].id))) {
    return roupa.variacoes[0];
  }
  return null;
};

const productData = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const first = variants[0] || {};
  const slug = localized(product.handle);
  return {
    nome: localized(product.name) || `Produto Nuvemshop ${product.id}`,
    codigo: codigoProdutoNuvemshop(slug || String(product.id)),
    tipo: localized(product?.categories?.[0]?.name) || 'Outro',
    genero: first.gender || null,
    marca: titoPackCuecas[slug]?.marca || localized(product.brand) || null,
    preco_venda: finiteMoney(first.promotional_price) || finiteMoney(first.price) || 0,
    preco_compra: finiteMoney(first.cost) || 0,
    observacao: `Origem Nuvemshop: ${slug || product.id}`,
    foto_url: firstProductImage(product),
  };
};

const listProducts = async (client) => {
  const products = [];
  for (let page = 1; ; page += 1) {
    const response = await apiRequest(client, { method: 'get', url: '/products', params: { page, per_page: 200 } });
    const batch = Array.isArray(response.data) ? response.data : [];
    products.push(...batch);
    if (batch.length < 200) break;
    if (page >= 250) throw new ApiError(502, 'A paginação de produtos da Nuvemshop excedeu o limite de segurança');
  }
  return products;
};

const listProductsPage = async (client, page, perPage) => {
  const response = await apiRequest(client, { method: 'get', url: '/products', params: { page, per_page: perPage } });
  return Array.isArray(response.data) ? response.data : [];
};

const fetchProduct = async (client, productId) => {
  const response = await apiRequest(client, { method: 'get', url: `/products/${productId}` });
  return response.data;
};

const saveSyncResult = async (integration, direction, summary, error = null) => {
  await integration.update({
    last_sync_at: new Date(),
    last_sync_direction: direction,
    last_sync_summary: summary || null,
    last_sync_error: error ? String(error).slice(0, 2000) : null,
  });
};

class NuvemshopCatalogSyncService {
  async pullPage(empresaId, options = {}) {
    const page = Math.max(1, Math.min(250, Math.trunc(Number(options.page) || 1)));
    const perPage = Math.max(1, Math.min(20, Math.trunc(Number(options.perPage) || 5)));
    const integration = await getIntegration(empresaId);
    const client = clientFor(integration);
    try {
      const products = await listProductsPage(client, page, perPage);
      const summary = await this.pullProducts({ integration, products });
      const result = { ...summary, page, perPage, hasMore: products.length === perPage };
      await saveSyncResult(integration, 'pull', result);
      return result;
    } catch (error) {
      await saveSyncResult(integration, 'pull', null, remoteError(error));
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `Falha ao consultar a Nuvemshop: ${remoteError(error)}`);
    }
  }

  async pullAll(empresaId) {
    const integration = await getIntegration(empresaId);
    const client = clientFor(integration);
    try {
      const products = await listProducts(client);
      const summary = await this.pullProducts({ integration, products });
      await saveSyncResult(integration, 'pull', summary);
      return summary;
    } catch (error) {
      await saveSyncResult(integration, 'pull', null, remoteError(error));
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `Falha ao consultar a Nuvemshop: ${remoteError(error)}`);
    }
  }

  async pullOneByStore(storeId, productId) {
    const integration = await NuvemshopIntegracao.findOne({ where: { store_id: storeId, ativo: true } });
    if (!integration) return { ignored: true };
    const client = clientFor(integration);
    try {
      const product = await fetchProduct(client, productId);
      const summary = await this.pullProducts({ integration, products: [product] });
      await saveSyncResult(integration, 'webhook', summary);
      return summary;
    } catch (error) {
      await saveSyncResult(integration, 'webhook', null, remoteError(error));
      throw error;
    }
  }

  async pullProducts({ integration, products }) {
    const empresaId = Number(integration.empresa_id);
    const localProducts = await EstoqueRoupa.findAll({
      where: { empresa_id: empresaId },
      include: [{ model: EstoqueRoupaVariacao, as: 'variacoes' }],
    });
    const mappings = await NuvemshopProdutoVinculo.findAll({ where: { integracao_id: integration.id } });
    const summary = {
      productsReceived: products.length,
      productsCreated: 0,
      productsMatched: 0,
      variantsLinked: 0,
      variantsCreated: 0,
      supersededVariantsReset: 0,
      managedStocksUpdated: 0,
      unlimitedStocksPreserved: 0,
      imagesAdded: 0,
    };

    for (const product of products) {
      const transaction = await sequelize.transaction();
      try {
        let roupa = findLocalProduct({ product, products: localProducts, mappings });
        const data = productData(product);
        if (!roupa) {
          roupa = await EstoqueRoupa.create({ empresa_id: empresaId, ...data }, { transaction });
          roupa.variacoes = [];
          localProducts.push(roupa);
          summary.productsCreated += 1;
        } else {
          const update = {
            nome: data.nome,
            tipo: data.tipo || roupa.tipo,
            marca: data.marca || roupa.marca,
            genero: data.genero || roupa.genero,
            preco_venda: data.preco_venda || roupa.preco_venda,
            preco_compra: data.preco_compra || roupa.preco_compra,
            foto_url: data.foto_url || roupa.foto_url,
          };
          if (!originSlug(roupa)) update.observacao = data.observacao;
          await roupa.update(update, { transaction });
          summary.productsMatched += 1;
        }

        const selectedVariants = selectProductVariants(product);
        const variants = selectedVariants.active.map(entry => entry.variant);
        const labelsByVariantId = new Map(selectedVariants.active.map(entry => [String(entry.variant.id), entry.labels]));
        const remoteVariantIds = new Set(variants.map(variant => String(variant.id)));
        const staleMappings = mappings.filter(mapping => (
          String(mapping.nuvemshop_product_id) === String(product.id)
          && !remoteVariantIds.has(String(mapping.nuvemshop_variant_id))
          && mapping.variacao_id
        ));
        const reusedStaleMappingIds = new Set();
        const usedIds = new Set();
        for (const [variantIndex, variant] of variants.entries()) {
          const labels = labelsByVariantId.get(String(variant.id)) || variantLabels(product, variant);
          let existingMapping = mappings.find(mapping => String(mapping.nuvemshop_variant_id) === String(variant.id));
          let variacao = null;
          if (existingMapping?.variacao_id) {
            const mappedVariation = await EstoqueRoupaVariacao.findByPk(existingMapping.variacao_id, { transaction });
            const mappedProductIds = [...new Set(mappings
              .filter(mapping => Number(mapping.variacao_id) === Number(existingMapping.variacao_id))
              .map(mapping => String(mapping.nuvemshop_product_id)))];
            if (mappedVariation && Number(mappedVariation.roupa_id) !== Number(roupa.id) && mappedProductIds.length === 1) {
              const oldCard = localProducts.find(item => Number(item.id) === Number(mappedVariation.roupa_id));
              if (oldCard) oldCard.variacoes = oldCard.variacoes.filter(item => Number(item.id) !== Number(mappedVariation.id));
              await mappedVariation.update({ roupa_id: roupa.id, tamanho: labels.tamanho, cor: labels.cor }, { transaction });
              roupa.variacoes.push(mappedVariation);
              variacao = mappedVariation;
            }
          }
          if (!variacao) variacao = findLocalVariation({ variant, labels, roupa, existingMapping, usedIds });
          if (!existingMapping) {
            const linkedStaleMapping = variacao && staleMappings.find(mapping => (
              !reusedStaleMappingIds.has(Number(mapping.id))
              && Number(mapping.variacao_id) === Number(variacao.id)
            ));
            const availableStaleMappings = staleMappings.filter(mapping => (
              !reusedStaleMappingIds.has(Number(mapping.id))
              && !usedIds.has(Number(mapping.variacao_id))
            ));
            const sameSkuMapping = variant.sku && availableStaleMappings.find(mapping => (
              mapping.nuvemshop_sku && String(mapping.nuvemshop_sku) === String(variant.sku)
            ));
            existingMapping = linkedStaleMapping || sameSkuMapping || (availableStaleMappings.length === 1 ? availableStaleMappings[0] : null);
            if (existingMapping) {
              reusedStaleMappingIds.add(Number(existingMapping.id));
              if (!variacao) {
                variacao = roupa.variacoes.find(item => (
                  Number(item.id) === Number(existingMapping.variacao_id)
                  && !usedIds.has(Number(item.id))
                )) || null;
              }
            }
          }
          const remoteStock = managedStock(variant);
          const remoteInfinite = variant?.stock_management === false;
          if (!variacao) {
            variacao = await EstoqueRoupaVariacao.create({
              roupa_id: roupa.id,
              tamanho: labels.tamanho,
              cor: labels.cor,
              quantidade_atual: remoteStock ?? 0,
              quantidade_minima: 0,
              estoque_infinito: remoteInfinite,
            }, { transaction });
            roupa.variacoes.push(variacao);
            summary.variantsCreated += 1;
            if (remoteStock > 0) {
              await EstoqueRoupaMovimento.create({
                empresa_id: empresaId,
                roupa_id: roupa.id,
                variacao_id: variacao.id,
                usuario_id: null,
                tipo: 'entrada',
                quantidade: remoteStock,
                saldo_anterior: 0,
                saldo_posterior: remoteStock,
                motivo: 'Cadastro pela Nuvemshop',
                origem_tipo: 'nuvemshop_sync',
                origem_id: roupa.id,
                data: new Date(),
              }, { transaction });
            }
          } else {
            const tamanhoAtual = String(variacao.tamanho || '').trim();
            const corAtual = variacao.cor == null || String(variacao.cor).trim() === '' ? null : String(variacao.cor).trim();
            const proximoTamanho = String(labels.tamanho || '').trim();
            const proximaCor = labels.cor == null || String(labels.cor).trim() === '' ? null : String(labels.cor).trim();
            if (tamanhoAtual !== proximoTamanho || corAtual !== proximaCor) {
              await variacao.update({ tamanho: proximoTamanho, cor: proximaCor }, { transaction });
            }
          }
          if (variacao && remoteStock != null && (Number(variacao.quantidade_atual) !== remoteStock || variacao.estoque_infinito)) {
            const before = Number(variacao.quantidade_atual);
            await variacao.update({ quantidade_atual: remoteStock, estoque_infinito: false }, { transaction });
            if (remoteStock !== before) {
              await EstoqueRoupaMovimento.create({
                empresa_id: empresaId,
                roupa_id: roupa.id,
                variacao_id: variacao.id,
                usuario_id: null,
                tipo: remoteStock > before ? 'entrada' : 'saida',
                quantidade: Math.abs(remoteStock - before),
                saldo_anterior: before,
                saldo_posterior: remoteStock,
                motivo: 'Sincronização Nuvemshop',
                origem_tipo: 'nuvemshop_sync',
                origem_id: roupa.id,
                data: new Date(),
              }, { transaction });
              summary.managedStocksUpdated += 1;
            }
          } else if (variacao && remoteInfinite) {
            if (!variacao.estoque_infinito) await variacao.update({ estoque_infinito: true }, { transaction });
            summary.unlimitedStocksPreserved += 1;
          }
          usedIds.add(Number(variacao.id));

          const mappingValues = {
            integracao_id: integration.id,
            empresa_id: empresaId,
            roupa_id: roupa.id,
            variacao_id: variacao.id,
            nuvemshop_product_id: product.id,
            nuvemshop_variant_id: variant.id,
            nuvemshop_sku: variant.sku || null,
            tamanho: labels.tamanho,
            cor: labels.cor,
            stock_management: variant.stock_management === true,
            inventory_levels: Array.isArray(variant.inventory_levels) ? variant.inventory_levels : null,
            last_remote_stock: remoteStock,
            last_local_stock: Number(variacao.quantidade_atual),
            last_synced_at: new Date(),
            last_error: null,
          };
          if (existingMapping) await existingMapping.update(mappingValues, { transaction });
          else {
            const created = await NuvemshopProdutoVinculo.create(mappingValues, { transaction });
            mappings.push(created);
          }
          summary.variantsLinked += 1;
          summary.imagesAdded += await syncImages(product, variant, variacao.id, transaction, variantIndex === 0);
        }

        const detailedSizes = new Set(selectedVariants.active
          .filter(entry => normalizarTextoEstoque(entry.labels.cor))
          .map(entry => normalizarTextoEstoque(entry.labels.tamanho)));
        const legacyVariations = roupa.variacoes.filter(variacao => (
          !usedIds.has(Number(variacao.id))
          && !normalizarTextoEstoque(variacao.cor)
          && detailedSizes.has(normalizarTextoEstoque(variacao.tamanho))
        ));
        for (const legacyVariation of legacyVariations) {
          const before = Number(legacyVariation.quantidade_atual || 0);
          if (before === 0 && !legacyVariation.estoque_infinito) continue;
          await legacyVariation.update({ quantidade_atual: 0, estoque_infinito: false }, { transaction });
          if (before > 0) {
            await EstoqueRoupaMovimento.create({
              empresa_id: empresaId,
              roupa_id: roupa.id,
              variacao_id: legacyVariation.id,
              usuario_id: null,
              tipo: 'saida',
              quantidade: before,
              saldo_anterior: before,
              saldo_posterior: 0,
              motivo: 'Substituição de grade Nuvemshop',
              origem_tipo: 'nuvemshop_sync',
              origem_id: roupa.id,
              data: new Date(),
            }, { transaction });
          }
          summary.supersededVariantsReset += 1;
        }
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }
    return summary;
  }

  async pushAll(empresaId) {
    const integration = await getIntegration(empresaId, { write: true });
    const mappings = await NuvemshopProdutoVinculo.findAll({
      where: { integracao_id: integration.id, variacao_id: { [Op.ne]: null } },
      include: [{ model: EstoqueRoupaVariacao, as: 'variacao', required: true }],
      order: [['nuvemshop_product_id', 'ASC'], ['nuvemshop_variant_id', 'ASC']],
    });
    return this.pushMappings(integration, mappings, 'push');
  }

  async pushVariationIds(empresaId, variationIds) {
    const ids = [...new Set((variationIds || []).map(Number).filter(Number.isInteger))];
    if (!ids.length) return { linked: 0, updated: 0, skipped: 0, errors: 0 };
    const integration = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
    if (!integration || !scopeList(integration).includes('write_products')) return { linked: 0, updated: 0, skipped: ids.length, errors: 0 };
    const mappings = await NuvemshopProdutoVinculo.findAll({
      where: { integracao_id: integration.id, variacao_id: { [Op.in]: ids } },
      include: [{ model: EstoqueRoupaVariacao, as: 'variacao', required: true }],
    });
    return this.pushMappings(integration, mappings, 'automatic');
  }

  async deleteLinkedProducts(empresaId, roupaId) {
    const mappings = await NuvemshopProdutoVinculo.findAll({
      where: { empresa_id: empresaId, roupa_id: roupaId },
    });
    const productIds = uniqueRemoteProductIds(mappings);
    if (!productIds.length) return { linked: 0, deleted: 0, alreadyMissing: 0 };

    const integration = await getIntegration(empresaId, { write: true });
    if (mappings.some(mapping => Number(mapping.integracao_id) !== Number(integration.id))) {
      throw new ApiError(409, 'O produto está vinculado a outra conexão da Nuvemshop; reconecte a loja antes de excluir');
    }

    const client = clientFor(integration);
    const summary = { linked: productIds.length, deleted: 0, alreadyMissing: 0 };
    try {
      for (const productId of productIds) {
        try {
          await apiRequest(client, { method: 'delete', url: `/products/${productId}` });
          summary.deleted += 1;
        } catch (error) {
          if (Number(error?.response?.status) === 404) {
            summary.alreadyMissing += 1;
            continue;
          }
          throw error;
        }
      }
      await saveSyncResult(integration, 'delete', summary);
      return summary;
    } catch (error) {
      const message = remoteError(error);
      await saveSyncResult(integration, 'delete', summary, message);
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `Não foi possível excluir o produto na Nuvemshop: ${message}`);
    }
  }

  async pushMappings(integration, mappings, direction) {
    const client = clientFor(integration);
    const summary = { linked: mappings.length, updated: 0, skipped: 0, errors: 0, multiLocationSkipped: 0 };
    const updates = [];
    for (const mapping of mappings) {
      if (!mapping.stock_management || mapping.variacao?.estoque_infinito) { summary.skipped += 1; continue; }
      const levels = Array.isArray(mapping.inventory_levels) ? mapping.inventory_levels : [];
      if (levels.length > 1) {
        summary.skipped += 1;
        summary.multiLocationSkipped += 1;
        await mapping.update({ last_error: 'Variação com múltiplos locais: configure o depósito antes de enviar estoque' });
        continue;
      }
      const quantity = Number(mapping.variacao.quantidade_atual);
      const level = levels[0];
      updates.push({
        mapping,
        productId: String(mapping.nuvemshop_product_id),
        variant: {
          id: Number(mapping.nuvemshop_variant_id),
          inventory_levels: [{ ...(level?.location_id ? { location_id: level.location_id } : {}), stock: quantity }],
        },
        quantity,
      });
    }

    for (let index = 0; index < updates.length; index += 50) {
      const chunk = updates.slice(index, index + 50);
      const grouped = new Map();
      for (const item of chunk) {
        if (!grouped.has(item.productId)) grouped.set(item.productId, []);
        grouped.get(item.productId).push(item.variant);
      }
      const payload = [...grouped.entries()].map(([id, variants]) => ({ id: Number(id), variants }));
      try {
        await apiRequest(client, { method: 'patch', url: '/products/stock-price', data: payload });
        for (const item of chunk) {
          await item.mapping.update({
            last_local_stock: item.quantity,
            last_remote_stock: item.quantity,
            last_synced_at: new Date(),
            last_error: null,
          });
          summary.updated += 1;
        }
      } catch (error) {
        const message = remoteError(error);
        summary.errors += chunk.length;
        await NuvemshopProdutoVinculo.update({ last_error: message }, { where: { id: chunk.map(item => item.mapping.id) } });
      }
    }
    await saveSyncResult(integration, direction, summary, summary.errors ? `${summary.errors} variação(ões) não foram atualizadas` : null);
    if (summary.errors) {
      throw new ApiError(502, `${summary.errors} variação(ões) não puderam ser atualizadas na Nuvemshop`);
    }
    return summary;
  }

  async registerWebhooks(integration, eventsUrl) {
    const client = clientFor(integration);
    const response = await apiRequest(client, { method: 'get', url: '/webhooks', params: { per_page: 200 } });
    const existing = Array.isArray(response.data) ? response.data : [];
    let created = 0;
    for (const event of WEBHOOK_EVENTS) {
      if (existing.some(item => item.event === event && item.url === eventsUrl)) continue;
      await apiRequest(client, { method: 'post', url: '/webhooks', data: { event, url: eventsUrl } });
      created += 1;
    }
    return { created, total: WEBHOOK_EVENTS.length };
  }

  async detachDeletedProduct(storeId, productId) {
    const integration = await NuvemshopIntegracao.findOne({ where: { store_id: storeId } });
    if (!integration) return { removed: 0 };
    const removed = await NuvemshopProdutoVinculo.destroy({
      where: { integracao_id: integration.id, nuvemshop_product_id: productId },
    });
    return { removed };
  }
}

export { managedStock, variantLabels, variantImages, variationKey, localized, scopeList, findLocalProduct, selectProductVariants, uniqueRemoteProductIds };
export default new NuvemshopCatalogSyncService();
