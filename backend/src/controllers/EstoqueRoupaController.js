import crypto from 'crypto';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import nuvemshopTitoFotos from '../data/nuvemshopTitoFotos.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';
import EstoqueRoupaFoto from '../models/EstoqueRoupaFoto.js';
import EstoqueRoupaMovimento from '../models/EstoqueRoupaMovimento.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import { chaveProdutoEstoque, chaveVariacaoEstoque, codigoProdutoNuvemshop, parseEstoqueNuvemshopCsv } from '../utils/estoqueRoupaNuvemshopCsv.js';
import nuvemshopCatalogSyncService from '../services/NuvemshopCatalogSync.service.js';

const ROUPA_FIELDS = ['nome', 'codigo', 'tipo', 'genero', 'marca', 'preco_venda', 'preco_compra', 'fornecedor', 'observacao', 'foto_url'];

const getEmpresaId = (req) => {
  const override = Number(req.user?.empresa_id_override);
  if (Number.isInteger(override) && override > 0) return override;
  const empresaId = Number(req.user?.empresa_id);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
};

const ensureEmpresa = (req, res) => {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    res.status(403).json({ error: 'Selecione uma empresa para acessar o estoque de roupas' });
    return null;
  }
  return empresaId;
};

const cleanBody = (body = {}) => Object.fromEntries(Object.entries(body).map(([key, value]) => [key.trim(), typeof value === 'string' ? value.trim() : value]));

const asNumber = (value, field, { integer = false } = {}) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) throw new Error(`${field} deve ser um número ${integer ? 'inteiro ' : ''}maior ou igual a zero`);
  return number;
};

const parseVariacoes = (raw) => {
  if (raw == null || raw === '') return [];
  let values = raw;
  if (typeof raw === 'string') {
    try { values = JSON.parse(raw); } catch { throw new Error('Variações inválidas'); }
  }
  if (!Array.isArray(values)) throw new Error('Variações inválidas');
  const seen = new Set();
  const seenIds = new Set();
  return values.map((variation, index) => {
    const idInformado = variation?.id == null || variation.id === '' ? null : Number(variation.id);
    if (idInformado != null && (!Number.isInteger(idInformado) || idInformado <= 0)) {
      throw new Error(`A variação ${index + 1} possui um identificador inválido`);
    }
    if (idInformado != null && seenIds.has(idInformado)) {
      throw new Error(`A variação ${index + 1} foi enviada mais de uma vez`);
    }
    if (idInformado != null) seenIds.add(idInformado);
    const tamanho = String(variation?.tamanho ?? '').trim();
    const cor = String(variation?.cor ?? '').trim();
    if (!tamanho) throw new Error(`Informe o tamanho da variação ${index + 1}`);
    const key = `${tamanho.toLocaleLowerCase('pt-BR')}|${cor.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) throw new Error(`A variação ${tamanho}${cor ? ` / ${cor}` : ''} está duplicada`);
    seen.add(key);
    return {
      ...(idInformado != null ? { id: idInformado } : {}),
      cor: cor || null,
      tamanho,
      quantidade_atual: asNumber(variation?.quantidade_atual, 'Quantidade atual', { integer: true }),
      quantidade_minima: asNumber(variation?.quantidade_minima, 'Quantidade mínima', { integer: true }),
      estoque_infinito: variation?.estoque_infinito === true || String(variation?.estoque_infinito).toLowerCase() === 'true',
    };
  });
};

const roupaData = (body, empresaId, fallback = {}) => {
  const data = {};
  for (const field of ROUPA_FIELDS) if (field in body) data[field] = body[field]; else if (fallback[field] !== undefined) data[field] = fallback[field];
  if (!String(data.nome ?? '').trim()) throw new Error('Informe o nome da peça');
  if (!String(data.tipo ?? '').trim()) throw new Error('Informe o tipo da peça');
  data.nome = String(data.nome).trim();
  data.tipo = String(data.tipo).trim();
  for (const field of ['codigo', 'genero', 'marca', 'fornecedor', 'observacao', 'foto_url']) if (data[field] != null) data[field] = String(data[field]).trim() || null;
  data.preco_venda = asNumber(data.preco_venda, 'Preço de venda');
  data.preco_compra = asNumber(data.preco_compra, 'Preço de compra');
  data.empresa_id = empresaId;
  return data;
};

const includeVariacoes = [{ model: EstoqueRoupaVariacao, as: 'variacoes', include: [{ model: EstoqueRoupaFoto, as: 'fotos', order: [['ordem', 'ASC']] }] }];
const findRoupa = (id, empresaId, options = {}) => EstoqueRoupa.findOne({ where: { id, empresa_id: empresaId }, ...options });
const slugsNuvemshop = Object.keys(nuvemshopTitoFotos);
const slugPorCodigoNuvemshop = new Map(slugsNuvemshop.map(slug => [codigoProdutoNuvemshop(slug), slug]));
const deleteCloudinaryFiles = async (publicIds) => Promise.allSettled([
  ...new Set(publicIds.filter(id => id && !String(id).startsWith('nuvemshop:'))),
].map((id) => CloudinaryService.deleteFile(id, 'image')));

const slugNuvemshopDaRoupa = (roupa) => {
  const observacao = String(roupa?.observacao ?? '');
  const encontrado = observacao.match(/Origem Nuvemshop:\s*([^\s]+)/i)?.[1];
  if (encontrado && Object.prototype.hasOwnProperty.call(nuvemshopTitoFotos, encontrado)) return encontrado;
  return slugPorCodigoNuvemshop.get(roupa?.codigo) ?? null;
};

const publicIdFotoNuvemshop = (variacaoId, slug, fotoUrl) => {
  const hash = crypto.createHash('sha256').update(`${slug}|${fotoUrl}`).digest('hex').slice(0, 32);
  return `nuvemshop:${variacaoId}:${hash}`;
};

const parseExistingPhotos = (body, index, allowedPhotos) => {
  const raw = body[`fotos_existentes_${index}`];
  if (!raw) return [];
  let photos;
  try { photos = JSON.parse(raw); } catch { throw new Error(`Fotos existentes da variação ${index + 1} inválidas`); }
  if (!Array.isArray(photos)) throw new Error(`Fotos existentes da variação ${index + 1} inválidas`);
  return photos.map((photo, photoIndex) => {
    const existing = allowedPhotos.get(String(photo?.public_id ?? ''));
    if (!existing) throw new Error('Uma foto selecionada não pertence a esta peça');
    return { foto_url: existing.foto_url, public_id: existing.public_id, ordem: Number.isInteger(Number(photo?.ordem)) ? Number(photo.ordem) : photoIndex };
  });
};

const errorResponse = (res, error, fallback) => {
  const message = error instanceof Error ? error.message : fallback;
  const validation = /^(Informe|Envie|O CSV|Coluna|Produto|Existe|Estoque|A variação|Variações|Quantidade|Preço|Fotos|Uma foto|Confirmação)/.test(message);
  return res.status(validation ? 400 : 500).json({ error: validation ? message : fallback });
};

const carregarPlanoNuvemshop = async (req) => {
  const arquivo = req.file;
  if (!arquivo?.buffer) throw new Error('Envie o arquivo CSV da Nuvemshop');
  const importacao = parseEstoqueNuvemshopCsv(arquivo.buffer);
  const atuais = await EstoqueRoupa.findAll({ where: { empresa_id: getEmpresaId(req) }, include: includeVariacoes, order: [['id', 'ASC']] });
  const filas = new Map();
  for (const roupa of atuais) {
    const chave = chaveProdutoEstoque(roupa);
    if (!filas.has(chave)) filas.set(chave, []);
    filas.get(chave).push(roupa);
  }
  const usados = new Set();
  let preservadas = 0;
  let novasSemQuantidade = 0;
  let produtosCorrespondentes = 0;
  const produtos = importacao.produtos.map(produto => {
    let atual = atuais.find(item => item.codigo === produto.codigo && !usados.has(item.id));
    if (!atual) atual = (filas.get(chaveProdutoEstoque(produto)) ?? []).find(item => !usados.has(item.id));
    if (atual) { usados.add(atual.id); produtosCorrespondentes += 1; }
    const variacoesAtuais = new Map((atual?.variacoes ?? []).map(variacao => [chaveVariacaoEstoque(variacao), variacao]));
    const variacoes = produto.variacoes.map(variacao => {
      const existente = variacoesAtuais.get(chaveVariacaoEstoque(variacao));
      if (variacao.quantidade_csv == null && existente) preservadas += 1;
      if (variacao.quantidade_csv == null && !existente) novasSemQuantidade += 1;
      return {
        ...variacao,
        quantidade_atual: variacao.quantidade_csv ?? Number(existente?.quantidade_atual ?? 0),
        quantidade_minima: Number(existente?.quantidade_minima ?? 0),
        estoque_infinito: variacao.quantidade_csv == null,
        existente_id: existente?.id ?? null,
      };
    });
    return { ...produto, atual, variacoes };
  });
  return {
    arquivo: arquivo.originalname,
    atuais,
    produtos,
    resumo: {
      linhasCsv: importacao.linhas,
      produtosAtuais: atuais.length,
      unidadesAtuais: atuais.reduce((total, roupa) => total + (roupa.variacoes ?? []).reduce((soma, v) => soma + Number(v.quantidade_atual ?? 0), 0), 0),
      produtosImportados: produtos.length,
      variacoesImportadas: produtos.reduce((total, produto) => total + produto.variacoes.length, 0),
      unidadesNumericasCsv: produtos.reduce((total, produto) => total + produto.variacoes.reduce((soma, v) => soma + Number(v.quantidade_csv ?? 0), 0), 0),
      variacoesEstoqueInfinito: produtos.reduce((total, produto) => total + produto.variacoes.filter(v => v.quantidade_csv == null).length, 0),
      variacoesComQuantidadePreservada: preservadas,
      variacoesNovasSemQuantidade: novasSemQuantidade,
      produtosCorrespondentes,
      produtosNovos: produtos.length - produtosCorrespondentes,
      produtosRemovidos: atuais.length - usados.size,
    },
  };
};

export const preverImportacaoNuvemshop = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  try {
    const plano = await carregarPlanoNuvemshop(req);
    res.json({
      arquivo: plano.arquivo,
      resumo: plano.resumo,
      backup: plano.atuais.map(item => item.toJSON()),
      regraEstoque: 'Quantidade do CSV prevalece; estoque infinito é marcado como ilimitado e não bloqueia vendas no caixa.',
    });
  } catch (error) { console.error('ERRO PREVER IMPORTAÇÃO NUVEMSHOP:', error); errorResponse(res, error, 'Não foi possível analisar o CSV'); }
};

// Importação aditiva: não altera nem remove cadastros/variações que já estão no estoque.
export const adicionarAusentesNuvemshop = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  let transaction;
  try {
    if (String(req.body?.confirmar ?? '') !== 'ADICIONAR') return res.status(400).json({ error: 'Confirmação da inclusão ausente' });
    const plano = await carregarPlanoNuvemshop(req);
    const candidatos = plano.produtos.filter(item => !item.atual);
    transaction = await sequelize.transaction();
    const atuais = await EstoqueRoupa.findAll({ where: { empresa_id: empresaId }, include: includeVariacoes, transaction });
    const codigos = new Set(atuais.map(item => item.codigo).filter(Boolean));
    const adicionados = [];
    let variacoesAdicionadas = 0;
    let unidadesAdicionadas = 0;

    for (const item of candidatos) {
      if (codigos.has(item.codigo)) continue;
      // O CSV novo traz "Tissot" em relógios Rolex e Tag-Heuer: o nome da peça prevalece.
      const marca = item.nome === 'RELÓGIO ROLEX' ? 'Rolex'
        : item.nome === 'RELÓGIO TAG-HEUER' ? 'Tag Heuer'
        : item.nome === 'RELÓGIO MONT BLANC' ? 'Mont Blanc'
        : item.marca;
      const roupa = await EstoqueRoupa.create({
        empresa_id: empresaId, nome: item.nome, codigo: item.codigo, tipo: item.tipo,
        genero: item.genero, marca, preco_venda: item.preco_venda,
        preco_compra: item.preco_compra, observacao: item.observacao,
      }, { transaction });
      for (const variacao of item.variacoes) {
        const saldo = Number(variacao.quantidade_csv ?? 0);
        const salva = await EstoqueRoupaVariacao.create({
          roupa_id: roupa.id, tamanho: variacao.tamanho, cor: variacao.cor,
          quantidade_atual: saldo, quantidade_minima: 0,
          estoque_infinito: variacao.quantidade_csv == null,
        }, { transaction });
        variacoesAdicionadas += 1;
        unidadesAdicionadas += saldo;
        if (saldo > 0) await EstoqueRoupaMovimento.create({
          empresa_id: empresaId, roupa_id: roupa.id, variacao_id: salva.id, usuario_id: req.user?.id ?? null,
          tipo: 'entrada', quantidade: saldo, saldo_anterior: 0, saldo_posterior: saldo,
          motivo: 'Inclusão CSV Nuvemshop', origem_tipo: 'importacao_nuvemshop', origem_id: roupa.id,
        }, { transaction });
      }
      codigos.add(item.codigo);
      adicionados.push({ codigo: item.codigo, nome: item.nome, slug: item.slug });
    }
    await transaction.commit();
    res.json({
      message: 'Somente os produtos ausentes foram adicionados',
      resumo: { produtosAdicionados: adicionados.length, variacoesAdicionadas, unidadesAdicionadas,
        produtosJaExistentes: plano.produtos.length - adicionados.length },
      adicionados,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('ERRO ADICIONAR PRODUTOS NUVEMSHOP:', error);
    errorResponse(res, error, 'Não foi possível adicionar os produtos ausentes');
  }
};

export const substituirPorNuvemshop = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  let transaction;
  try {
    if (String(req.body?.confirmar ?? '') !== 'SUBSTITUIR') return res.status(400).json({ error: 'Confirmação da substituição ausente' });
    const plano = await carregarPlanoNuvemshop(req);
    transaction = await sequelize.transaction();
    const mantidos = new Set();
    for (const item of plano.produtos) {
      const dadosRoupa = {
        empresa_id: empresaId, nome: item.nome, codigo: item.codigo, tipo: item.tipo,
        genero: item.genero || item.atual?.genero || null,
        marca: item.marca || item.atual?.marca || null,
        preco_venda: item.preco_venda,
        preco_compra: item.preco_compra || Number(item.atual?.preco_compra ?? 0),
        observacao: item.observacao,
      };
      const roupa = item.atual
        ? await item.atual.update(dadosRoupa, { transaction })
        : await EstoqueRoupa.create(dadosRoupa, { transaction });
      mantidos.add(roupa.id);
      const variacoesAntigas = new Map((item.atual?.variacoes ?? []).map(v => [v.id, v]));
      const variacoesMantidas = new Set();
      for (const variacao of item.variacoes) {
        const existente = variacao.existente_id ? variacoesAntigas.get(variacao.existente_id) : null;
        const saldoAnterior = Number(existente?.quantidade_atual ?? 0);
        const dadosVariacao = {
          roupa_id: roupa.id, tamanho: variacao.tamanho, cor: variacao.cor,
          quantidade_atual: variacao.quantidade_atual, quantidade_minima: variacao.quantidade_minima,
          estoque_infinito: Boolean(variacao.estoque_infinito),
        };
        const salva = existente
          ? await existente.update(dadosVariacao, { transaction })
          : await EstoqueRoupaVariacao.create(dadosVariacao, { transaction });
        variacoesMantidas.add(salva.id);
        const diferenca = Number(salva.quantidade_atual) - saldoAnterior;
        if (diferenca !== 0) await EstoqueRoupaMovimento.create({
          empresa_id: empresaId, roupa_id: roupa.id, variacao_id: salva.id, usuario_id: req.user?.id ?? null,
          tipo: diferenca > 0 ? 'entrada' : 'saida', quantidade: Math.abs(diferenca), saldo_anterior: saldoAnterior,
          saldo_posterior: Number(salva.quantidade_atual), motivo: 'Importação CSV Nuvemshop',
          origem_tipo: 'importacao_nuvemshop', origem_id: roupa.id,
        }, { transaction });
      }
      const excluirVariacoes = [...variacoesAntigas.keys()].filter(id => !variacoesMantidas.has(id));
      if (excluirVariacoes.length) {
        await EstoqueRoupaFoto.destroy({ where: { variacao_id: excluirVariacoes }, transaction });
        await EstoqueRoupaVariacao.destroy({ where: { id: excluirVariacoes }, transaction });
      }
    }
    const excluirRoupas = plano.atuais.map(item => item.id).filter(id => !mantidos.has(id));
    if (excluirRoupas.length) {
      const variacoes = await EstoqueRoupaVariacao.findAll({ where: { roupa_id: excluirRoupas }, attributes: ['id'], transaction });
      const idsVariacoes = variacoes.map(item => item.id);
      if (idsVariacoes.length) await EstoqueRoupaFoto.destroy({ where: { variacao_id: idsVariacoes }, transaction });
      await EstoqueRoupaVariacao.destroy({ where: { roupa_id: excluirRoupas }, transaction });
      await EstoqueRoupa.destroy({ where: { id: excluirRoupas, empresa_id: empresaId }, transaction });
    }
    await transaction.commit();
    res.json({ message: 'Estoque substituído pelo CSV da Nuvemshop', resumo: plano.resumo });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('ERRO IMPORTAR NUVEMSHOP:', error); errorResponse(res, error, 'Não foi possível substituir o estoque');
  }
};

export const sincronizarFotosNuvemshop = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  let transaction;
  try {
    const roupas = await EstoqueRoupa.findAll({
      where: { empresa_id: empresaId },
      include: [{ model: EstoqueRoupaVariacao, as: 'variacoes' }],
      order: [['id', 'ASC']],
    });
    const variationIds = roupas.flatMap(roupa => (roupa.variacoes ?? []).map(variacao => variacao.id)).filter(Boolean);
    const novasFotos = [];
    const roupasSemFotos = [];
    const roupasSemCorrespondencia = [];
    let roupasComFotos = 0;
    let variacoesVinculadas = 0;

    for (const roupa of roupas) {
      const slug = slugNuvemshopDaRoupa(roupa);
      if (!slug) { roupasSemCorrespondencia.push({ id: roupa.id, nome: roupa.nome }); continue; }
      const urls = [...new Set((nuvemshopTitoFotos[slug] ?? []).filter(Boolean))];
      if (!urls.length) { roupasSemFotos.push({ id: roupa.id, nome: roupa.nome, slug }); continue; }
      roupasComFotos += 1;
      for (const variacao of roupa.variacoes ?? []) {
        variacoesVinculadas += 1;
        urls.forEach((fotoUrl, ordem) => novasFotos.push({
          variacao_id: variacao.id,
          foto_url: fotoUrl,
          public_id: publicIdFotoNuvemshop(variacao.id, slug, fotoUrl),
          ordem,
        }));
      }
    }

    transaction = await sequelize.transaction();
    if (variationIds.length) await EstoqueRoupaFoto.destroy({
      where: { variacao_id: variationIds, public_id: { [Op.like]: 'nuvemshop:%' } },
      transaction,
    });
    if (novasFotos.length) await EstoqueRoupaFoto.bulkCreate(novasFotos, { transaction });
    for (const roupa of roupas) {
      const slug = slugNuvemshopDaRoupa(roupa);
      const primeiraFoto = slug ? nuvemshopTitoFotos[slug]?.[0] : null;
      if (primeiraFoto) await roupa.update({ foto_url: primeiraFoto }, { transaction });
    }
    await transaction.commit();

    res.json({
      message: 'Fotos da Tito Imports vinculadas ao estoque',
      resumo: {
        produtosNoEstoque: roupas.length,
        produtosComFotos: roupasComFotos,
        produtosSemFotosPublicadas: roupasSemFotos.length,
        produtosSemCorrespondencia: roupasSemCorrespondencia.length,
        variacoesVinculadas,
        vinculosDeFotosCriados: novasFotos.length,
      },
      pendencias: [...roupasSemFotos, ...roupasSemCorrespondencia],
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('ERRO SINCRONIZAR FOTOS NUVEMSHOP:', error);
    errorResponse(res, error, 'Não foi possível vincular as fotos da Nuvemshop');
  }
};

export const listar = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  try {
    const { nome, tipo, genero } = req.query;
    const where = { empresa_id: empresaId };
    if (nome) where.nome = { [Op.iLike]: `%${String(nome).trim()}%` };
    if (tipo) where.tipo = String(tipo).trim();
    if (genero) where.genero = String(genero).trim();
    res.json(await EstoqueRoupa.findAll({ where, include: includeVariacoes, order: [['createdAt', 'DESC']] }));
  } catch (error) { console.error('ERRO LISTAR ROUPAS:', error); errorResponse(res, error, 'Não foi possível carregar o estoque de roupas'); }
};

export const buscar = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  try {
    const roupa = await findRoupa(req.params.id, empresaId, { include: includeVariacoes });
    if (!roupa) return res.status(404).json({ error: 'Peça não encontrada' });
    res.json(roupa);
  } catch (error) { errorResponse(res, error, 'Não foi possível carregar a peça'); }
};

export const criar = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  const uploadedIds = []; let transaction;
  try {
    const body = cleanBody(req.body);
    const variacoes = parseVariacoes(body.variacoes);
    transaction = await sequelize.transaction();
    const roupa = await EstoqueRoupa.create(roupaData(body, empresaId), { transaction });
    const created = variacoes.length ? await EstoqueRoupaVariacao.bulkCreate(variacoes.map(v => ({ ...v, roupa_id: roupa.id })), { transaction, returning: true }) : [];
    for (const variacao of created) {
      if (!variacao.estoque_infinito && Number(variacao.quantidade_atual) > 0) await EstoqueRoupaMovimento.create({
        empresa_id: empresaId, roupa_id: roupa.id, variacao_id: variacao.id, usuario_id: req.user?.id ?? null,
        tipo: 'entrada', quantidade: Number(variacao.quantidade_atual), saldo_anterior: 0,
        saldo_posterior: Number(variacao.quantidade_atual), motivo: 'Cadastro inicial', origem_tipo: 'cadastro', origem_id: roupa.id,
      }, { transaction });
    }
    for (let i = 0; i < created.length; i += 1) {
      const files = req.files?.[`fotos_variacao_${i}`] ?? [];
      for (let j = 0; j < files.length; j += 1) {
        const result = await CloudinaryService.uploadFile(files[j].buffer, files[j].originalname, 'lucromais/estoque/fotos');
        uploadedIds.push(result.public_id);
        await EstoqueRoupaFoto.create({ variacao_id: created[i].id, foto_url: result.secure_url, public_id: result.public_id, ordem: j }, { transaction });
      }
    }
    await transaction.commit();
    res.status(201).json(await findRoupa(roupa.id, empresaId, { include: includeVariacoes }));
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    await deleteCloudinaryFiles(uploadedIds);
    console.error('ERRO CRIAR ROUPA:', error); errorResponse(res, error, 'Não foi possível cadastrar a peça');
  }
};

export const atualizar = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  const uploadedIds = []; let transaction;
  try {
    const body = cleanBody(req.body);
    const roupa = await findRoupa(req.params.id, empresaId, { include: includeVariacoes });
    if (!roupa) return res.status(404).json({ error: 'Peça não encontrada' });
    const oldPhotos = (roupa.variacoes ?? []).flatMap(v => v.fotos ?? []);
    const variacoes = Object.prototype.hasOwnProperty.call(body, 'variacoes')
      ? parseVariacoes(body.variacoes)
      : (roupa.variacoes ?? []).map(v => ({
        id: v.id,
        cor: v.cor ?? null,
        tamanho: v.tamanho,
        quantidade_atual: Number(v.quantidade_atual),
        quantidade_minima: Number(v.quantidade_minima),
        estoque_infinito: Boolean(v.estoque_infinito),
      }));
    const allowedPhotos = new Map(oldPhotos.map(photo => [photo.public_id, photo]));
    const variationKey = v => `${v.tamanho.trim().toLocaleLowerCase('pt-BR')}|${String(v.cor ?? '').trim().toLocaleLowerCase('pt-BR')}`;
    const oldQuantities = new Map((roupa.variacoes ?? []).map(v => [variationKey(v), Number(v.quantidade_atual)]));
    const oldQuantitiesById = new Map((roupa.variacoes ?? []).map(v => [Number(v.id), Number(v.quantidade_atual)]));
    const oldById = new Map((roupa.variacoes ?? []).map(v => [Number(v.id), v]));
    const oldByKey = new Map((roupa.variacoes ?? []).map(v => [variationKey(v), v]));
    for (const variacao of variacoes) {
      if (variacao.id != null && !oldById.has(Number(variacao.id))) {
        throw new Error('A variação informada não pertence a esta peça');
      }
    }
    const photosByVariation = variacoes.map((_, index) => parseExistingPhotos(body, index, allowedPhotos));
    const keptIds = new Set(photosByVariation.flatMap(photos => photos.map(photo => photo.public_id)));
    transaction = await sequelize.transaction();
    await roupa.update(roupaData(body, empresaId, roupa.toJSON()), { transaction });
    const oldVariationIds = (roupa.variacoes ?? []).map(v => v.id).filter(Boolean);
    if (oldVariationIds.length) await EstoqueRoupaFoto.destroy({ where: { variacao_id: oldVariationIds }, transaction });
    const created = [];
    const reusedIds = new Set();
    for (const dadosVariacao of variacoes) {
      const { id: variacaoId, ...dadosAtualizados } = dadosVariacao;
      const existing = variacaoId != null
        ? oldById.get(Number(variacaoId))
        : oldByKey.get(variationKey(dadosAtualizados));
      if (existing) {
        await existing.update(dadosAtualizados, { transaction });
        reusedIds.add(Number(existing.id));
        created.push(existing);
      } else {
        created.push(await EstoqueRoupaVariacao.create({ ...dadosAtualizados, roupa_id: roupa.id }, { transaction }));
      }
    }
    const removedIds = oldVariationIds.filter(id => !reusedIds.has(Number(id)));
    if (removedIds.length) await EstoqueRoupaVariacao.destroy({ where: { id: removedIds }, transaction });
    for (const variacao of created) {
      const key = `${variacao.tamanho.trim().toLocaleLowerCase('pt-BR')}|${String(variacao.cor ?? '').trim().toLocaleLowerCase('pt-BR')}`;
      const saldoAnterior = oldQuantitiesById.get(Number(variacao.id)) ?? oldQuantities.get(key) ?? 0;
      const saldoPosterior = Number(variacao.quantidade_atual);
      const diferenca = saldoPosterior - saldoAnterior;
      if (!variacao.estoque_infinito && diferenca !== 0) await EstoqueRoupaMovimento.create({
        empresa_id: empresaId, roupa_id: roupa.id, variacao_id: variacao.id, usuario_id: req.user?.id ?? null,
        tipo: diferenca > 0 ? 'entrada' : 'saida', quantidade: Math.abs(diferenca), saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior, motivo: 'Ajuste de cadastro', origem_tipo: 'cadastro_atualizado', origem_id: roupa.id,
      }, { transaction });
    }
    for (let i = 0; i < created.length; i += 1) {
      const photos = [...photosByVariation[i]];
      const files = req.files?.[`fotos_variacao_${i}`] ?? [];
      for (let j = 0; j < files.length; j += 1) {
        const result = await CloudinaryService.uploadFile(files[j].buffer, files[j].originalname, 'lucromais/estoque/fotos');
        uploadedIds.push(result.public_id);
        photos.push({ foto_url: result.secure_url, public_id: result.public_id, ordem: photos.length });
      }
      if (photos.length) await EstoqueRoupaFoto.bulkCreate(photos.map(photo => ({ ...photo, variacao_id: created[i].id })), { transaction });
    }
    await transaction.commit();
    try {
      await nuvemshopCatalogSyncService.pushVariationIds(empresaId, created.map(variacao => variacao.id));
    } catch (error) {
      console.error('[Nuvemshop] Falha ao enviar ajuste manual de estoque:', error.message);
    }
    await deleteCloudinaryFiles(oldPhotos.filter(photo => !keptIds.has(photo.public_id)).map(photo => photo.public_id));
    res.json(await findRoupa(roupa.id, empresaId, { include: includeVariacoes }));
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    await deleteCloudinaryFiles(uploadedIds);
    console.error('ERRO ATUALIZAR ROUPA:', error); errorResponse(res, error, 'Não foi possível atualizar a peça');
  }
};

export const deletar = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  let transaction;
  try {
    const roupa = await findRoupa(req.params.id, empresaId, { include: includeVariacoes });
    if (!roupa) return res.status(404).json({ error: 'Peça não encontrada' });
    const excluirNuvemshop = String(req.query.nuvemshop ?? '').toLowerCase() === 'true';
    const nuvemshop = excluirNuvemshop
      ? await nuvemshopCatalogSyncService.deleteLinkedProducts(empresaId, roupa.id)
      : { linked: 0, deleted: 0, alreadyMissing: 0 };
    const publicIds = (roupa.variacoes ?? []).flatMap(v => (v.fotos ?? []).map(photo => photo.public_id));
    transaction = await sequelize.transaction();
    const variationIds = (roupa.variacoes ?? []).map(v => v.id).filter(Boolean);
    if (variationIds.length) await EstoqueRoupaFoto.destroy({ where: { variacao_id: variationIds }, transaction });
    await EstoqueRoupaVariacao.destroy({ where: { roupa_id: roupa.id }, transaction });
    await roupa.destroy({ transaction });
    await transaction.commit();
    await deleteCloudinaryFiles(publicIds);
    res.json({
      message: nuvemshop.deleted || nuvemshop.alreadyMissing
        ? 'Peça excluída no Lucro+ e na Nuvemshop'
        : 'Peça excluída com sucesso',
      nuvemshop,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('ERRO DELETAR ROUPA:', error); errorResponse(res, error, 'Não foi possível excluir a peça');
  }
};

export const deletarFoto = async (req, res) => {
  const empresaId = ensureEmpresa(req, res); if (!empresaId) return;
  try {
    const foto = await EstoqueRoupaFoto.findOne({
      where: { id: req.params.fotoId },
      include: [{ model: EstoqueRoupaVariacao, as: 'variacao', required: true, include: [{ model: EstoqueRoupa, as: 'roupa', required: true, where: { empresa_id: empresaId } }] }],
    });
    if (!foto || Number(foto.variacao?.roupa?.id) !== Number(req.params.id)) return res.status(404).json({ error: 'Foto não encontrada' });
    await foto.destroy();
    await deleteCloudinaryFiles([foto.public_id]);
    res.json({ message: 'Foto deletada com sucesso' });
  } catch (error) { console.error('ERRO DELETAR FOTO:', error); errorResponse(res, error, 'Não foi possível excluir a foto'); }
};
