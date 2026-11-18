import crypto from 'node:crypto';
import { Op } from 'sequelize';
import Empresa from '../models/Empresa.js';
import Cliente from '../models/Cliente.js';
import Product from '../models/Product.js';
import Venda from '../models/Venda.js';
import LojaCupom from '../models/LojaCupom.js';
import LojaPremio from '../models/LojaPremio.js';
import LojaRoletaLead from '../models/LojaRoletaLead.js';
import LojaPontosMovimento from '../models/LojaPontosMovimento.js';
import LojaPontosResgate from '../models/LojaPontosResgate.js';
import sequelize from '../config/database.js';
import EmailService from './EmailService.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const VALOR_POR_BLOCO_PONTOS = 25;
const PONTOS_POR_BLOCO = 3;
const normalizarEmail = (valor) => String(valor || '').trim().toLowerCase();
const normalizarTexto = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const slug = (valor) => normalizarTexto(valor).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const codigo = (prefixo) => `${prefixo}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const CUPOM_VALIDO_POR_DIAS = 15;
const STATUS_VENDA_CANCELADA = ['cancelado', 'cancelada'];
const STATUS_PEDIDO_CONFIRMADOS = ['novo', 'separando', 'enviado', 'concluido'];

const whereVendaQueConsumiuCupom = (empresaId, clienteId, cupomId) => ({
  empresa_id: empresaId,
  cliente_id: clienteId,
  loja_cupom_id: cupomId,
  [Op.or]: [
    { status_loja: null },
    { status_loja: { [Op.notIn]: [...STATUS_VENDA_CANCELADA, 'aguardando_pagamento'] } },
  ],
});

const itemProdutoGratis = (cupom, itens = []) => {
  if (cupom.tipo !== 'produto') return null;
  if (cupom.produto_id) return itens.find((item) => Number(item.produto_id) === Number(cupom.produto_id)) || null;
  const unidades = itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
  if (unidades < 2) return null;
  return itens
    .filter((item) => Number(item.quantidade || 0) > 0)
    .sort((a, b) => Number(a.valor_unitario || 0) - Number(b.valor_unitario || 0))[0] || null;
};

const calcularDescontoCupom = (cupom, valorBruto, itens = []) => {
  const itemPremiado = itemProdutoGratis(cupom, itens);
  const valorItemGratis = itemPremiado
    ? Number(itemPremiado.valor_unitario ?? (Number(itemPremiado.valor_total || 0) / Math.max(1, Number(itemPremiado.quantidade || 1))))
    : 0;
  const desconto = cupom.tipo === 'percentual'
    ? valorBruto * Number(cupom.valor || 0) / 100
    : cupom.tipo === 'produto'
      ? valorItemGratis
      : Number(cupom.valor || 0);
  return Number(Math.min(valorBruto, Math.max(0, desconto)).toFixed(2));
};

const premioPublico = (premio) => ({
  id: Number(premio.id), nome: premio.nome, descricao: premio.descricao, tipo: premio.tipo,
  valor: Number(premio.valor || 0), pontos_custo: Number(premio.pontos_custo || 0),
  produto_id: premio.produto_id ? Number(premio.produto_id) : null, chance: Number(premio.chance || 0),
  estoque: premio.estoque == null ? null : Number(premio.estoque), ativo: premio.ativo !== false,
});

const leadPublico = (lead) => ({
  id: Number(lead.id), token: lead.token, nome: lead.nome, email: lead.email, telefone: lead.telefone,
  cidade: lead.cidade, estado: lead.estado, status: lead.status, codigo_premio: lead.codigo_premio,
  premio_email_status: lead.premio_email_status, premio: lead.premio ? premioPublico(lead.premio) : null,
  cliente_id: lead.cliente_id ? Number(lead.cliente_id) : null, created_at: lead.created_at,
});

const garantirPremiosIniciais = async (empresaId) => {
  const quantidade = await LojaPremio.count({ where: { empresa_id: empresaId } });
  if (quantidade > 0) return;
  await LojaPremio.bulkCreate([
    { empresa_id: empresaId, nome: '5% de desconto', descricao: 'Desconto para sua próxima compra na lojinha.', tipo: 'desconto_percentual', valor: 5, pontos_custo: 10, chance: 45, ativo: true },
    { empresa_id: empresaId, nome: '10% de desconto', descricao: 'Desconto especial para sua próxima compra.', tipo: 'desconto_percentual', valor: 10, pontos_custo: 20, chance: 35, ativo: true },
    { empresa_id: empresaId, nome: 'R$ 10 de desconto', descricao: 'Economize R$ 10 em uma próxima compra.', tipo: 'desconto_fixo', valor: 10, pontos_custo: 30, chance: 20, ativo: true },
  ]);
};

const PESO_CHANCE_ESCALA = 10000;
const pesoDaChance = (premio) => Math.max(0, Math.round(Number(premio.chance || 0) * PESO_CHANCE_ESCALA));
const escolherPremio = (premios) => {
  const total = premios.reduce((soma, premio) => soma + pesoDaChance(premio), 0);
  if (!total) return premios[0];
  let alvo = crypto.randomInt(total);
  return premios.find((premio) => (alvo -= pesoDaChance(premio)) < 0) || premios[premios.length - 1];
};

const buscarPremiosDisponiveis = (empresaId) => LojaPremio.findAll({
  where: {
    empresa_id: empresaId,
    ativo: true,
    [Op.or]: [{ estoque: null }, { estoque: { [Op.gt]: 0 } }],
  },
  order: [['id', 'ASC']],
});

class LojaProgramaService {
  async resolverEmpresa(slugEmpresa = 'saude-e-vida') {
    const empresas = await Empresa.findAll({ where: { arquivada_em: null }, attributes: ['id', 'nome', 'configuracoes'] });
    const alvo = normalizarTexto(slugEmpresa);
    const empresa = empresas.find((item) => normalizarTexto(item.configuracoes?.loja_online_slug) === alvo || slug(item.nome) === alvo);
    if (!empresa) throw erro('Loja não encontrada', 404);
    return empresa;
  }

  async iniciarLead(slugEmpresa, dados = {}) {
    const empresa = await this.resolverEmpresa(slugEmpresa);
    await garantirPremiosIniciais(empresa.id);
    const nome = String(dados.nome || '').trim();
    const email = normalizarEmail(dados.email);
    const telefone = String(dados.telefone || '').trim();
    if (nome.length < 3) throw erro('Informe seu nome completo.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw erro('Informe um e-mail válido.');
    if (telefone.length < 8) throw erro('Informe um celular válido.');
    const lead = await LojaRoletaLead.create({
      empresa_id: empresa.id, token: crypto.randomBytes(28).toString('hex'), nome, email, telefone,
      data_nascimento: dados.data_nascimento || null, cep: dados.cep || null, rua: dados.rua || null,
      numero: dados.numero || null, complemento: dados.complemento || null, bairro: dados.bairro || null,
      cidade: dados.cidade || null, estado: dados.estado || null,
    });
    const premios = await buscarPremiosDisponiveis(empresa.id);
    return { token: lead.token, lead: leadPublico(lead), premios: premios.map(premioPublico) };
  }

  async girarRoleta(slugEmpresa, token) {
    const empresa = await this.resolverEmpresa(slugEmpresa);
    await garantirPremiosIniciais(empresa.id);
    const lead = await LojaRoletaLead.findOne({ where: { empresa_id: empresa.id, token }, include: [{ model: LojaPremio, as: 'premio', required: false }] });
    if (!lead) throw erro('Sessão da roleta não encontrada.', 404);
    if (lead.codigo_premio) return { premio: premioPublico(lead.premio), premio_id: Number(lead.premio_id), codigo: lead.codigo_premio, email_status: lead.premio_email_status };
    const premios = await buscarPremiosDisponiveis(empresa.id);
    if (!premios.length) throw erro('A roleta ainda não possui prêmios configurados.', 409);
    const premio = escolherPremio(premios);
    const codigoPremio = codigo('SV');
    const tipoCupom = premio.tipo === 'desconto_fixo' ? 'fixo' : premio.tipo === 'produto' ? 'produto' : 'percentual';
    const cupom = await LojaCupom.create({
      empresa_id: empresa.id, codigo: codigoPremio, titulo: premio.nome, tipo: tipoCupom,
      valor: Number(premio.valor || 0), ativo: true, limite_uso: 1, usos: 0,
      mensagem: 'Prêmio da roleta Saúde e Vida', roleta_lead_id: lead.id, premio_id: premio.id,
      produto_id: premio.produto_id || null, uso_unico_cliente: true,
    });
    await lead.update({ premio_id: premio.id, codigo_premio: codigoPremio, premio_email_status: 'pendente' });
    if (premio.estoque != null) await premio.decrement('estoque');
    let emailStatus = 'enviado';
    try {
      const envio = await EmailService.send({ to: lead.email, subject: `Seu prêmio na Saúde e Vida: ${premio.nome}`, body: `<h2>Parabéns, ${lead.nome}!</h2><p>Você ganhou <strong>${premio.nome}</strong>.</p><p>Use este código uma única vez na lojinha:</p><p style="font-size:24px;letter-spacing:3px"><strong>${codigoPremio}</strong></p><p>Acesse a loja e aplique o código no checkout.</p>` });
      if (envio?.enviado === false) emailStatus = 'pendente';
    } catch (error) {
      emailStatus = 'erro';
      await lead.update({ premio_email_erro: error.message });
    }
    await lead.update({ premio_email_status: emailStatus });
    return { premio: premioPublico(premio), premio_id: Number(premio.id), codigo: codigoPremio, email_status: emailStatus };
  }

  async vincularCuponsDoLead(cliente) {
    if (!cliente?.email) return;
    const leads = await LojaRoletaLead.findAll({ where: { empresa_id: cliente.empresa_id, email: { [Op.iLike]: normalizarEmail(cliente.email) }, cliente_id: null } });
    for (const lead of leads) {
      await lead.update({ cliente_id: cliente.id, status: lead.status === 'pendente' ? 'cadastrado' : lead.status });
      await LojaCupom.update({ cliente_id: cliente.id }, { where: { empresa_id: cliente.empresa_id, roleta_lead_id: lead.id, cliente_id: null } });
    }
  }

  async listarLeads(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw erro('Selecione uma empresa.');
    const leads = await LojaRoletaLead.findAll({ where: { empresa_id: empresaId }, include: [{ model: LojaPremio, as: 'premio', required: false }], order: [['created_at', 'DESC'], ['id', 'DESC']] });
    return leads.map(leadPublico);
  }

  async decidirCadastro(id, cadastrar, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    const lead = await LojaRoletaLead.findOne({ where: { id, empresa_id: empresaId } });
    if (!lead) throw erro('Lead da roleta não encontrado.', 404);
    if (!cadastrar) { await lead.update({ status: 'ignorado' }); return leadPublico(lead); }
    let cliente = await Cliente.findOne({ where: { empresa_id: empresaId, [Op.or]: [{ email: { [Op.iLike]: lead.email } }, { telefone: lead.telefone }] } });
    if (!cliente) cliente = await Cliente.create({ empresa_id: empresaId, nomeCompleto: lead.nome, telefone: lead.telefone, email: lead.email, data_nascimento: lead.data_nascimento, cep: lead.cep, rua: lead.rua, numero: lead.numero, complemento: lead.complemento, bairro: lead.bairro, cidade: lead.cidade, estado: lead.estado });
    else await cliente.update({ nomeCompleto: lead.nome, email: lead.email, telefone: lead.telefone, data_nascimento: lead.data_nascimento, cep: lead.cep, rua: lead.rua, numero: lead.numero, complemento: lead.complemento, bairro: lead.bairro, cidade: lead.cidade, estado: lead.estado });
    await lead.update({ status: 'cadastrado', cliente_id: cliente.id });
    await LojaCupom.update({ cliente_id: cliente.id }, { where: { empresa_id: empresaId, roleta_lead_id: lead.id } });
    return { ...leadPublico(lead), cliente_id: cliente.id };
  }

  async listarPremios(currentUser) { const empresaId = empresaParaGravar(currentUser); await garantirPremiosIniciais(empresaId); return (await LojaPremio.findAll({ where: { empresa_id: empresaId }, order: [['id', 'ASC']] })).map(premioPublico); }

  async listarProdutosPremios(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    return Product.findAll({ where: { empresa_id: empresaId, is_materia_prima: { [Op.not]: true } }, attributes: ['id', 'name', 'price', 'currentQuantity'], order: [['name', 'ASC']] });
  }

  async validarCupomCaixa(dados = {}, currentUser, transaction = null) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw erro('Selecione uma empresa para validar o cupom.');
    const clienteId = Number(dados.cliente_id);
    const codigoCupom = String(dados.codigo || '').trim().toUpperCase();
    const valorBruto = Number(Math.max(0, Number(dados.valor_bruto || 0)).toFixed(2));
    if (!Number.isInteger(clienteId) || clienteId <= 0) throw erro('Selecione o cliente para usar um cupom.');
    if (!codigoCupom) throw erro('Informe o código do cupom.');
    if (!valorBruto) throw erro('Adicione produtos antes de aplicar o cupom.');
    const cliente = await Cliente.findOne({ where: { id: clienteId, empresa_id: empresaId }, transaction });
    if (!cliente) throw erro('Cliente não encontrado nesta empresa.', 404);
    const cupom = await LojaCupom.findOne({
      where: { empresa_id: empresaId, codigo: codigoCupom, ativo: true },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!cupom) throw erro('Cupom não encontrado ou inativo.');
    if (cupom.cliente_id && Number(cupom.cliente_id) !== clienteId) throw erro('Este cupom está vinculado a outro cliente.');
    const resgatePontos = await LojaPontosResgate.findOne({ where: { empresa_id: empresaId, cupom_id: cupom.id, cliente_id: clienteId }, transaction });
    const agora = Date.now();
    if (cupom.validade_inicio && new Date(cupom.validade_inicio).getTime() > agora) throw erro('Este cupom ainda não está válido.');
    const validadeFim = cupom.validade_fim || (resgatePontos?.created_at ? new Date(new Date(resgatePontos.created_at).getTime() + CUPOM_VALIDO_POR_DIAS * 24 * 60 * 60 * 1000) : null);
    if (validadeFim && new Date(validadeFim).getTime() < agora) throw erro('Este cupom está vencido.');
    if (cupom.limite_uso && Number(cupom.usos) >= Number(cupom.limite_uso)) throw erro('Este cupom já foi utilizado.');
    const vendaAnterior = await Venda.count({ where: whereVendaQueConsumiuCupom(empresaId, clienteId, cupom.id), transaction });
    if (vendaAnterior > 0 || (cupom.uso_unico_cliente && vendaAnterior > 0)) throw erro('Este cupom já foi utilizado por este cliente.');
    const itens = Array.isArray(dados.itens) ? dados.itens : [];
    if (cupom.tipo === 'produto' && !itemProdutoGratis(cupom, itens)) {
      throw erro(cupom.produto_id ? 'Este cupom só pode ser usado com o produto premiado.' : 'Adicione pelo menos dois itens para usar o benefício de produto grátis.');
    }
    const desconto = calcularDescontoCupom(cupom, valorBruto, itens);
    return {
      cupom,
      cupom_id: Number(cupom.id),
      codigo: codigoCupom,
      tipo: cupom.tipo,
      valor: Number(cupom.valor || 0),
      valor_bruto: valorBruto,
      desconto,
      valor_total: Number((valorBruto - desconto).toFixed(2)),
      mensagem: 'Cupom aplicado com sucesso.',
    };
  }

  async consumirCupom(cupomId, empresaId, transaction) {
    if (!cupomId) return;
    const cupom = await LojaCupom.findOne({
      where: { id: cupomId, empresa_id: empresaId, ativo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!cupom) throw erro('Cupom não encontrado ou inativo.');
    if (cupom.limite_uso && Number(cupom.usos) >= Number(cupom.limite_uso)) throw erro('Este cupom já foi utilizado.');
    await cupom.increment('usos', { by: 1, transaction });
  }

  async criarPremio(dados, currentUser, id = null) {
    const empresaId = empresaParaGravar(currentUser);
    const tipo = ['desconto_percentual', 'desconto_fixo', 'produto'].includes(dados.tipo) ? dados.tipo : 'desconto_percentual';
    const payload = { nome: String(dados.nome || '').trim(), descricao: String(dados.descricao || '').trim() || null, tipo, valor: Number(dados.valor || 0), pontos_custo: Math.max(1, Math.trunc(Number(dados.pontos_custo || 1))), produto_id: tipo === 'produto' ? Number(dados.produto_id) || null : null, chance: Math.max(0, Number(dados.chance || 1)), estoque: dados.estoque === '' || dados.estoque == null ? null : Math.max(0, Math.trunc(Number(dados.estoque))), ativo: dados.ativo !== false, empresa_id: empresaId };
    if (!payload.nome) throw erro('Informe o nome do prêmio.');
    if (id) { const premio = await LojaPremio.findOne({ where: { id, empresa_id: empresaId } }); if (!premio) throw erro('Prêmio não encontrado.', 404); await premio.update(payload); return premioPublico(premio); }
    return premioPublico(await LojaPremio.create(payload));
  }

  async excluirPremio(id, currentUser) { const empresaId = empresaParaGravar(currentUser); const premio = await LojaPremio.findOne({ where: { id, empresa_id: empresaId } }); if (!premio) throw erro('Prêmio não encontrado.', 404); await premio.update({ ativo: false }); return premioPublico(premio); }

  async registrarVenda(vendaId, transaction = null) {
    const ownsTransaction = !transaction;
    const currentTransaction = transaction || await sequelize.transaction();
    try {
      const venda = await Venda.findByPk(vendaId, { transaction: currentTransaction });
      if (!venda?.cliente_id || Number(venda.valor_total) <= 0 || venda.status_loja === 'aguardando_pagamento' || ['cancelado', 'cancelada'].includes(venda.status_loja)) {
        if (ownsTransaction) await currentTransaction.commit();
        return 0;
      }
      const movimentoExistente = await LojaPontosMovimento.findOne({ where: { venda_id: venda.id, tipo: 'ganho' }, transaction: currentTransaction });
      if (movimentoExistente) {
        if (ownsTransaction) await currentTransaction.commit();
        return Number(movimentoExistente.pontos || 0);
      }
      const cliente = await Cliente.findOne({ where: { id: venda.cliente_id, empresa_id: venda.empresa_id }, transaction: currentTransaction, lock: currentTransaction.LOCK.UPDATE });
      if (!cliente) {
        if (ownsTransaction) await currentTransaction.commit();
        return 0;
      }
      const totalCompras = Number(await Venda.sum('valor_total', {
        where: {
          empresa_id: venda.empresa_id,
          cliente_id: venda.cliente_id,
          [Op.or]: [
            { origem: 'loja_online', status_loja: { [Op.in]: STATUS_PEDIDO_CONFIRMADOS } },
            { origem: { [Op.ne]: 'loja_online' }, status_loja: null },
          ],
        },
        transaction: currentTransaction,
      }) || 0);
      const pontosEsperados = Math.floor(totalCompras / VALOR_POR_BLOCO_PONTOS) * PONTOS_POR_BLOCO;
      const pontos = Math.max(0, pontosEsperados - Number(cliente.pontos_acumulados || 0));
      if (pontos > 0) {
        await LojaPontosMovimento.create({ empresa_id: venda.empresa_id, cliente_id: venda.cliente_id, venda_id: venda.id, tipo: 'ganho', pontos, descricao: `Compras acumuladas até #${venda.id}` }, { transaction: currentTransaction });
        await cliente.increment({ pontos_saldo: pontos, pontos_acumulados: pontos }, { transaction: currentTransaction });
      }
      if (ownsTransaction) await currentTransaction.commit();
      return pontos;
    } catch (error) {
      if (ownsTransaction) await currentTransaction.rollback();
      throw error;
    }
  }

  async pontosDoCliente(slugEmpresa, cliente) {
    const empresa = await this.resolverEmpresa(slugEmpresa);
    if (!cliente) throw erro('Faça login para consultar seus pontos.', 401);
    await garantirPremiosIniciais(empresa.id);
    const premios = await LojaPremio.findAll({ where: { empresa_id: empresa.id, ativo: true }, order: [['pontos_custo', 'ASC'], ['id', 'ASC']] });
    const resgates = await LojaPontosResgate.findAll({ where: { empresa_id: empresa.id, cliente_id: cliente.id }, order: [['created_at', 'DESC']], limit: 20 });
    const cupomIds = resgates.map((resgate) => Number(resgate.cupom_id)).filter(Boolean);
    const cupons = cupomIds.length ? await LojaCupom.findAll({ where: { empresa_id: empresa.id, id: { [Op.in]: cupomIds } } }) : [];
    const cuponsPorId = new Map(cupons.map((cupom) => [Number(cupom.id), cupom]));
    const agora = Date.now();
    const resgatesPublicos = resgates.map((resgate) => {
      const cupom = cuponsPorId.get(Number(resgate.cupom_id));
      const validadeFim = cupom?.validade_fim || (resgate.created_at ? new Date(new Date(resgate.created_at).getTime() + CUPOM_VALIDO_POR_DIAS * 24 * 60 * 60 * 1000).toISOString() : null);
      const expirado = validadeFim && new Date(validadeFim).getTime() < agora;
      const usado = cupom && cupom.limite_uso && Number(cupom.usos) >= Number(cupom.limite_uso);
      return {
        id: Number(resgate.id), codigo: resgate.codigo, pontos: Number(resgate.pontos), premio_id: Number(resgate.premio_id),
        status: expirado ? 'expirado' : usado ? 'usado' : resgate.status,
        cupom_id: cupom ? Number(cupom.id) : null,
        validade_fim: validadeFim,
        titulo: cupom?.titulo || null,
      };
    });
    return { saldo: Number(cliente.pontos_saldo || 0), acumulados: Number(cliente.pontos_acumulados || 0), pontos_por_real: PONTOS_POR_BLOCO / VALOR_POR_BLOCO_PONTOS, premios: premios.map(premioPublico), resgates: resgatesPublicos };
  }

  async resgatar(slugEmpresa, premioId, cliente) {
    const empresa = await this.resolverEmpresa(slugEmpresa);
    const transaction = await sequelize.transaction();
    try {
      const clienteBloqueado = await Cliente.findOne({ where: { id: cliente.id, empresa_id: empresa.id }, transaction, lock: transaction.LOCK.UPDATE });
      const premio = await LojaPremio.findOne({ where: { id: premioId, empresa_id: empresa.id, ativo: true }, transaction, lock: transaction.LOCK.UPDATE });
      if (!clienteBloqueado || !premio) throw erro('Prêmio não encontrado.');
      if (Number(clienteBloqueado.pontos_saldo || 0) < Number(premio.pontos_custo)) throw erro('Você ainda não possui pontos suficientes.');
      if (premio.estoque != null && Number(premio.estoque) <= 0) throw erro('Este prêmio está esgotado.');
      const codigoResgate = codigo('PTS');
      const validadeInicio = new Date();
      const validadeFim = new Date(validadeInicio.getTime() + CUPOM_VALIDO_POR_DIAS * 24 * 60 * 60 * 1000);
      const cupom = await LojaCupom.create({ empresa_id: empresa.id, codigo: codigoResgate, titulo: premio.nome, tipo: premio.tipo === 'desconto_fixo' ? 'fixo' : premio.tipo === 'produto' ? 'produto' : 'percentual', valor: Number(premio.valor || 0), produto_id: premio.produto_id || null, premio_id: premio.id, cliente_id: cliente.id, uso_unico_cliente: true, limite_uso: 1, usos: 0, ativo: true, validade_inicio: validadeInicio, validade_fim: validadeFim, mensagem: `Resgate de pontos da Saúde e Vida. Válido por ${CUPOM_VALIDO_POR_DIAS} dias.` }, { transaction });
      const resgate = await LojaPontosResgate.create({ empresa_id: empresa.id, cliente_id: cliente.id, premio_id: premio.id, cupom_id: cupom.id, codigo: codigoResgate, pontos: premio.pontos_custo }, { transaction });
      await LojaPontosMovimento.create({ empresa_id: empresa.id, cliente_id: cliente.id, resgate_id: resgate.id, tipo: 'resgate', pontos: -Number(premio.pontos_custo), descricao: `Resgate: ${premio.nome}` }, { transaction });
      await clienteBloqueado.decrement('pontos_saldo', { by: Number(premio.pontos_custo), transaction });
      if (premio.estoque != null) await premio.decrement('estoque', { by: 1, transaction });
      await transaction.commit();
      return { codigo: codigoResgate, premio: premioPublico(premio), pontos_restantes: Number(clienteBloqueado.pontos_saldo || 0) };
    } catch (error) { await transaction.rollback(); throw error; }
  }
}

export default new LojaProgramaService();
