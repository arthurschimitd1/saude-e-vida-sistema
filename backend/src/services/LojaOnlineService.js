import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Empresa from '../models/Empresa.js';
import User from '../models/UserModel.js';
import Product from '../models/Product.js';
import Venda from '../models/Venda.js';
import VendaItem from '../models/VendaItem.js';
import Cliente from '../models/Cliente.js';
import Movimento from '../models/Movimento.js';
import LojaCupom from '../models/LojaCupom.js';
import LojaCupomEnvio from '../models/LojaCupomEnvio.js';
import LojaCategoria from '../models/LojaCategoria.js';
import AutomacaoNotificacao from '../models/AutomacaoNotificacao.js';
import sequelize from '../config/database.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import vendaService from './VendaService.js';
import mercadoPagoService from './MercadoPagoService.js';
import whatsappCrmService from './crm/WhatsappCrmService.js';
import lojaProgramaService from './LojaProgramaService.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const normalizarSlug = (valor = '') => String(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const numero = (valor, fallback = 0) => {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : fallback;
};

const normalizarCep = (valor) => {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : null;
};

const normalizarTexto = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const cidadePermiteEntrega = (cidade, estado) => normalizarTexto(estado) === 'pb'
  && ['campina grande', 'esperanca'].includes(normalizarTexto(cidade));

const erroDeEntrada = (mensagem) => Object.assign(new Error(mensagem), { status: 400 });
const erroComStatus = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const normalizarEmail = (email) => String(email || '').trim().toLowerCase();
const normalizarCupom = (codigo) => String(codigo || '').trim().toUpperCase();
const PRIMEIRA_COMPRA_CUPOM = 'PRIMEIRACOMPRA10';
const PRIMEIRA_COMPRA_PERCENTUAL = 10;
const STATUS_PEDIDO_CONFIRMADOS = ['novo', 'separando', 'enviado', 'concluido'];

// Pedido aguardando pagamento ainda não é uma compra. Já um pedido pago que
// foi cancelado continua contando: o cupom de primeira compra não volta a ser
// liberado para a mesma conta depois de ter sido efetivamente utilizado.
const whereCompraConsumada = (empresaId, clienteId) => ({
  origem: 'loja_online',
  empresa_id: empresaId,
  cliente_id: clienteId,
  [Op.or]: [
    { status_loja: { [Op.in]: STATUS_PEDIDO_CONFIRMADOS } },
    {
      status_loja: 'cancelado',
      [Op.or]: [
        { mercado_pago_payment_id: { [Op.ne]: null } },
        { mercado_pago_status: { [Op.ne]: null } },
      ],
    },
  ],
});

const mensagemRecusaMercadoPago = (detalhe, formaPagamento) => {
  const codigo = String(detalhe || '').trim().toLowerCase();
  if (formaPagamento === 'pix') {
    return 'O Pix não foi aprovado. Gere um novo código e conclua o pagamento pelo aplicativo do seu banco.';
  }
  const mensagens = {
    cc_rejected_high_risk: 'O Mercado Pago recusou este cartão na análise de segurança. Tente outro cartão ou escolha Pix.',
    cc_rejected_blacklist: 'Este cartão foi recusado pelo Mercado Pago. Tente outro cartão ou escolha Pix.',
    cc_rejected_insufficient_amount: 'O cartão não tem limite ou saldo suficiente para esta compra. Tente outro cartão.',
    cc_rejected_bad_filled_card_number: 'Confira o número do cartão e tente novamente.',
    cc_rejected_bad_filled_date: 'Confira a validade do cartão e tente novamente.',
    cc_rejected_bad_filled_security_code: 'Confira o código de segurança do cartão e tente novamente.',
    cc_rejected_call_for_authorize: 'O banco emissor pediu autorização para esta compra. Autorize-a ou tente outro cartão.',
    cc_rejected_card_disabled: 'Este cartão está desabilitado para compras online. Tente outro cartão.',
    cc_rejected_invalid_installments: 'A quantidade de parcelas não foi aceita para este cartão. Tente pagar em 1x ou escolha outro cartão.',
    cc_rejected_max_attempts: 'O limite de tentativas deste cartão foi atingido. Tente outro cartão.',
    cc_rejected_duplicated_payment: 'Esta compra parece duplicada. Aguarde alguns instantes e tente novamente.',
    cc_rejected_other_reason: 'O banco ou o Mercado Pago recusou este pagamento. Tente outro cartão ou escolha Pix.',
  };
  return mensagens[codigo] || 'O pagamento foi recusado pelo Mercado Pago. Tente outro cartão ou escolha Pix.';
};

const clientePublico = (cliente) => ({
  id: Number(cliente.id),
  nome: cliente.nomeCompleto,
  email: cliente.email,
  telefone: cliente.telefone,
  cep: cliente.cep,
  rua: cliente.rua,
  numero: cliente.numero,
  complemento: cliente.complemento,
  bairro: cliente.bairro,
  cidade: cliente.cidade,
  estado: cliente.estado,
  pontos_saldo: Number(cliente.pontos_saldo || 0),
  pontos_acumulados: Number(cliente.pontos_acumulados || 0),
});

const cupomPublico = (cupom) => ({
  id: Number(cupom.id),
  codigo: cupom.codigo,
  titulo: cupom.titulo,
  tipo: cupom.tipo,
  valor: Number(cupom.valor),
  validade_inicio: cupom.validade_inicio,
  validade_fim: cupom.validade_fim,
  limite_uso: cupom.limite_uso,
  usos: cupom.usos,
  ativo: cupom.ativo,
  mensagem: cupom.mensagem,
});

const categoriaPublica = (categoria, extras = {}) => ({
  id: Number(categoria.id),
  nome: categoria.nome,
  slug: categoria.slug,
  ordem: Number(categoria.ordem || 0),
  ativo: categoria.ativo !== false,
  ...extras,
});

const categoriaEspecial = { id: 0, nome: 'Granel', slug: 'granel', ordem: -1, ativo: true, sistema: true };
const categoriasIniciaisLoja = [
  { nome: 'Alimentação saudável', slug: 'alimentacao-saudavel', ordem: 0 },
  { nome: 'Autocuidado', slug: 'autocuidado', ordem: 1 },
  { nome: 'Cápsulas e suplementos', slug: 'capsulas-e-suplementos', ordem: 2 },
  { nome: 'Chás e infusões', slug: 'chas-e-infusoes', ordem: 3 },
];

const garantirCategoriasIniciais = async (empresaId) => {
  const quantidade = await LojaCategoria.count({ where: { empresa_id: empresaId } });
  if (quantidade > 0) return;
  await LojaCategoria.bulkCreate(categoriasIniciaisLoja.map((categoria) => ({ ...categoria, empresa_id: empresaId, ativo: true })));
};

class LojaOnlineService {
  gerarTokenCliente(cliente, empresa) {
    return jwt.sign(
      { id: cliente.id, email: cliente.email, empresa_id: empresa.id, tipo: 'CLIENTE_LOJA' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
    );
  }

  async cadastrarCliente(slug, dados = {}) {
    const empresa = await this.resolverEmpresa(slug);
    const nome = String(dados.nome || '').trim();
    const email = normalizarEmail(dados.email);
    const telefone = String(dados.telefone || '').trim();
    const senha = String(dados.senha || '');
    if (nome.length < 3) throw erroDeEntrada('Informe seu nome completo');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw erroDeEntrada('Informe um e-mail válido');
    if (telefone.length < 8) throw erroDeEntrada('Informe um telefone válido');
    if (senha.length < 6) throw erroDeEntrada('A senha deve ter pelo menos 6 caracteres');

    const usuarioSistema = await User.findOne({
      where: {
        email: { [Op.iLike]: email },
        [Op.or]: [
          { empresa_id: empresa.id },
          { empresa_id: null, tipo: 'MASTER' },
        ],
      },
    });
    if (usuarioSistema) throw erroComStatus(409, 'Este e-mail pertence a uma conta do sistema. Use o acesso administrativo.');

    const existente = await Cliente.findOne({
      where: { empresa_id: empresa.id, email: { [Op.iLike]: email } },
      order: [['created_at', 'DESC']],
    });
    if (existente?.loja_senha_hash) throw erroComStatus(409, 'Já existe uma conta com este e-mail. Faça login para continuar.');

    const senhaHash = await bcrypt.hash(senha, 12);
    const cliente = existente || await Cliente.create({ empresa_id: empresa.id, nomeCompleto: nome, email, telefone });
    await cliente.update({ nomeCompleto: nome, email, telefone, loja_senha_hash: senhaHash, loja_ultimo_login: new Date() });
    await lojaProgramaService.vincularCuponsDoLead(cliente);
    return { tipo: 'CLIENTE_LOJA', token: this.gerarTokenCliente(cliente, empresa), cliente: clientePublico(cliente) };
  }

  async loginCliente(slug, dados = {}) {
    const empresa = await this.resolverEmpresa(slug);
    const email = normalizarEmail(dados.email);
    const senha = String(dados.senha || '');
    if (!email || !senha) throw erroDeEntrada('Informe e-mail e senha');

    const usuariosDoSistema = await User.scope('withPassword').findAll({
      where: {
        email: { [Op.iLike]: email },
        [Op.or]: [
          { empresa_id: empresa.id },
          { empresa_id: null, tipo: 'MASTER' },
        ],
      },
      order: [['created_at', 'DESC']],
    });
    for (const usuario of usuariosDoSistema) {
      if (usuario.status === 'ativo' && usuario.senha && await bcrypt.compare(senha, usuario.senha)) {
        return {
          tipo: 'SISTEMA',
          mensagem: 'Esta é uma conta do sistema. Use o acesso administrativo para entrar no painel.',
        };
      }
    }

    const candidatos = await Cliente.findAll({
      where: { empresa_id: empresa.id, email: { [Op.iLike]: email } },
      order: [['created_at', 'DESC']],
    });
    let cliente = null;
    for (const candidato of candidatos) {
      if (candidato.loja_senha_hash && await bcrypt.compare(senha, candidato.loja_senha_hash)) {
        cliente = candidato;
        break;
      }
    }
    if (!cliente && usuariosDoSistema.length > 0) {
      throw erroComStatus(401, 'E-mail ou senha inválidos. Esta conta pertence ao sistema administrativo.');
    }
    if (!cliente) {
      const clienteSemAcesso = candidatos.find((candidato) => !candidato.loja_senha_hash);
      if (clienteSemAcesso) {
        const senhaHash = await bcrypt.hash(senha, 12);
        await clienteSemAcesso.update({ loja_senha_hash: senhaHash, loja_ultimo_login: new Date() });
        cliente = clienteSemAcesso;
      }
    }
    if (!cliente) {
      const nomeGerado = String(dados.nome || email.split('@')[0] || 'Cliente da loja')
        .replace(/[._-]+/g, ' ')
        .trim();
      const nome = nomeGerado.length >= 3 ? nomeGerado : 'Cliente da loja';
      const telefone = String(dados.telefone || 'Não informado').trim();
      const senhaHash = await bcrypt.hash(senha, 12);
      cliente = await Cliente.create({
        empresa_id: empresa.id,
        nomeCompleto: nome,
        email,
        telefone,
        loja_senha_hash: senhaHash,
        loja_ultimo_login: new Date(),
      });
    }
    if (!cliente) throw erroComStatus(401, 'E-mail ou senha inválidos. Se ainda não possui acesso, crie sua conta na loja.');
    await cliente.update({ loja_ultimo_login: new Date() });
    await lojaProgramaService.vincularCuponsDoLead(cliente);
    return { tipo: 'CLIENTE_LOJA', token: this.gerarTokenCliente(cliente, empresa), cliente: clientePublico(cliente) };
  }

  async clienteAtual(slug, cliente) {
    await this.resolverEmpresa(slug);
    return { cliente: clientePublico(cliente) };
  }

  async listarPedidosCliente(slug, cliente) {
    const empresa = await this.resolverEmpresa(slug);
    const pedidos = await Venda.findAll({
      where: { origem: 'loja_online', empresa_id: empresa.id, cliente_id: cliente.id },
      include: [
        { model: VendaItem, as: 'itens', include: [{ model: Product, attributes: ['id', 'name', 'currentQuantity', 'unidade_medida'] }] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    // Uma falha antes de abrir o checkout cria uma venda técnica para obter o
    // ID usado na referência do Mercado Pago. Sem pagamento, ela não deve
    // aparecer no histórico do cliente como se tivesse sido uma compra.
    return pedidos.filter((pedido) => {
      const semPagamento = !pedido.mercado_pago_payment_id && !pedido.mercado_pago_status;
      return !(pedido.status_loja === 'cancelado' && semPagamento);
    });
  }

  async resolverEmpresa(slug = 'saude-e-vida') {
    const empresas = await Empresa.findAll({
      where: { arquivada_em: null },
      attributes: ['id', 'nome', 'configuracoes'],
      order: [['id', 'ASC']],
    });
    const encontrada = empresas.find((empresa) => {
      const configuracoes = empresa.configuracoes && typeof empresa.configuracoes === 'object'
        ? empresa.configuracoes
        : {};
      return configuracoes.loja_online_slug === slug || normalizarSlug(empresa.nome) === slug;
    });
    if (!encontrada) throw new Error('Loja não encontrada');
    return encontrada;
  }

  async catalogo(slug = 'saude-e-vida') {
    const empresa = await this.resolverEmpresa(slug);
    await garantirCategoriasIniciais(empresa.id);
    const produtos = await Product.findAll({
      where: {
        empresa_id: empresa.id,
        is_materia_prima: { [Op.not]: true },
        loja_online_ativo: true,
        currentQuantity: { [Op.gt]: 0 },
      },
      attributes: ['id', 'name', 'loja_online_nome', 'code', 'category', 'price', 'loja_online_preco', 'loja_online_preco_original', 'loja_online_granel', 'loja_online_preco_kg', 'loja_online_categoria', 'loja_online_descricao', 'loja_online_foto_url', 'loja_online_secoes', 'loja_online_ordem', 'loja_online_destaque', 'loja_online_promocao', 'currentQuantity', 'unidade_medida', 'fabricante'],
      order: [['loja_online_ordem', 'ASC'], ['name', 'ASC']],
    });
    const categoriasConfiguradas = await LojaCategoria.findAll({
      where: { empresa_id: empresa.id, ativo: true },
      order: [['ordem', 'ASC'], ['nome', 'ASC']],
    });
    const categoriasPorSlug = new Map(categoriasConfiguradas.map((categoria) => [normalizarSlug(categoria.nome), categoria.nome]));
    const produtosPublicados = produtos
      .map((produto) => {
        const secoes = Array.isArray(produto.loja_online_secoes) ? produto.loja_online_secoes : [];
        const categoriaInformada = produto.loja_online_categoria;
        const aGranel = Boolean(produto.loja_online_granel) || normalizarSlug(categoriaInformada) === 'granel';
        const categoria = aGranel ? 'Granel' : (categoriasPorSlug.get(normalizarSlug(categoriaInformada)) || categoriaInformada);
        // Categorias de estoque não são categorias da loja. O produto só é
        // publicado quando usa uma categoria criada na configuração da loja
        // ou a categoria especial Granel.
        if (!categoria || (!aGranel && !categoriasPorSlug.has(normalizarSlug(categoriaInformada)))) return null;
        return {
          id: produto.id,
          nome: produto.loja_online_nome || produto.name,
          codigo: produto.code,
          categoria,
          descricao: produto.loja_online_descricao,
          foto_url: produto.loja_online_foto_url,
          fabricante: produto.fabricante,
          preco: numero(aGranel ? (produto.loja_online_preco_kg ?? produto.loja_online_preco ?? produto.price) : (produto.loja_online_preco ?? produto.price)),
          a_granel: aGranel,
          preco_kg: aGranel ? numero(produto.loja_online_preco_kg ?? produto.loja_online_preco ?? produto.price) : null,
          estoque: Math.max(0, numero(produto.currentQuantity)),
          unidade: produto.unidade_medida || 'UN',
          disponivel: numero(produto.currentQuantity) > 0,
          secoes,
          ordem: numero(produto.loja_online_ordem),
          destaque: Boolean(produto.loja_online_destaque),
          promocao: Boolean(produto.loja_online_promocao),
          preco_original: produto.loja_online_preco_original == null ? null : numero(produto.loja_online_preco_original),
          vendidos: 0,
        };
      })
      // Publicação exige apenas que o produto tenha sido adicionado à loja
      // e categorizado. Destaques e promoções são vitrines opcionais: se o
      // usuário remover todas as seções, o produto continua em "Todos".
      .filter(Boolean);

    // A navegação da loja mostra todas as categorias criadas, mesmo quando
    // alguma ainda está sem produto publicado.
    const categorias = [
      categoriaEspecial,
      ...categoriasConfiguradas
        .filter((categoria) => normalizarSlug(categoria.nome) !== 'granel')
        .map((categoria) => categoriaPublica(categoria)),
    ];

    return {
      empresa: { id: empresa.id, nome: empresa.nome, slug },
      categorias,
      produtos: produtosPublicados,
    };
  }

  async listarCategorias(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para configurar as categorias da lojinha');
    await garantirCategoriasIniciais(empresaId);
    const [categorias, produtos] = await Promise.all([
      LojaCategoria.findAll({ where: { empresa_id: empresaId }, order: [['ordem', 'ASC'], ['nome', 'ASC']] }),
      Product.findAll({ where: { empresa_id: empresaId }, attributes: ['loja_online_categoria', 'loja_online_granel'], raw: true }),
    ]);
    const nomes = new Set(produtos.map((produto) => Boolean(produto.loja_online_granel) ? 'Granel' : produto.loja_online_categoria).filter(Boolean));
    const categoriasMapeadas = categorias
      .filter((categoria) => normalizarSlug(categoria.nome) !== 'granel')
      .map((categoria) => categoriaPublica(categoria, { em_uso: nomes.has(categoria.nome) }));
    categoriasMapeadas.sort((a, b) => Number(a.ordem) - Number(b.ordem) || a.nome.localeCompare(b.nome));
    return [categoriaEspecial, ...categoriasMapeadas];
  }

  async criarCategoria(dados, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para criar categorias');
    const nome = String(dados.nome || '').trim().replace(/\s+/g, ' ');
    if (nome.length < 2 || nome.length > 120) throw erroDeEntrada('A categoria deve ter entre 2 e 120 caracteres');
    if (normalizarSlug(nome) === 'granel') throw erroDeEntrada('Granel já é uma categoria especial da loja');
    const existente = await LojaCategoria.findOne({ where: { empresa_id: empresaId, nome: { [Op.iLike]: nome } } });
    if (existente) throw erroComStatus(409, 'Já existe uma categoria com esse nome');
    try {
      const categoria = await LojaCategoria.create({ empresa_id: empresaId, nome, slug: normalizarSlug(nome), ordem: Math.max(0, Math.trunc(numero(dados.ordem))) });
      return categoriaPublica(categoria);
    } catch (error) {
      if (error?.name === 'SequelizeUniqueConstraintError') throw erroComStatus(409, 'Já existe uma categoria com esse nome');
      throw error;
    }
  }

  async atualizarCategoria(id, dados, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para editar categorias');
    const categoriaId = Number(id);
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) throw erroDeEntrada('Categoria inválida');
    const categoria = await LojaCategoria.findOne({ where: { id: categoriaId, empresa_id: empresaId } });
    if (!categoria) throw erroComStatus(404, 'Categoria não encontrada');
    const nome = String(dados.nome || '').trim().replace(/\s+/g, ' ');
    if (nome.length < 2 || nome.length > 120) throw erroDeEntrada('A categoria deve ter entre 2 e 120 caracteres');
    if (normalizarSlug(nome) === 'granel') throw erroDeEntrada('Granel é uma categoria especial da loja');
    const existente = await LojaCategoria.findOne({ where: { empresa_id: empresaId, id: { [Op.ne]: categoria.id }, nome: { [Op.iLike]: nome } } });
    if (existente) throw erroComStatus(409, 'Já existe uma categoria com esse nome');
    const transaction = await sequelize.transaction();
    try {
      await Product.update({ loja_online_categoria: nome }, { where: { empresa_id: empresaId, loja_online_categoria: categoria.nome }, transaction });
      await categoria.update({ nome, slug: normalizarSlug(nome), ordem: Math.max(0, Math.trunc(numero(dados.ordem, categoria.ordem))), ativo: dados.ativo !== false }, { transaction });
      await transaction.commit();
      return categoriaPublica(categoria);
    } catch (error) {
      await transaction.rollback();
      if (error?.name === 'SequelizeUniqueConstraintError') throw erroComStatus(409, 'Já existe uma categoria com esse nome');
      throw error;
    }
  }

  async excluirCategoria(id, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para excluir categorias');
    const categoriaId = Number(id);
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) throw erroDeEntrada('Esta categoria não pode ser excluída');
    const categoria = await LojaCategoria.findOne({ where: { id: categoriaId, empresa_id: empresaId } });
    if (!categoria) throw erroComStatus(404, 'Categoria não encontrada');
    const produtosEmUso = await Product.count({ where: { empresa_id: empresaId, loja_online_categoria: categoria.nome } });
    if (produtosEmUso > 0) throw erroComStatus(409, 'Remova esta categoria dos produtos antes de excluí-la');
    await categoria.destroy();
    return { id: categoriaId, removida: true };
  }

  async listarConfiguracao(currentUser) {
    // Só os produtos adicionados à loja aparecem aqui. Os demais continuam
    // disponíveis no botão "Adicionar do estoque".
    return this.listarEstoqueConfiguracao(currentUser, true);
  }

  async listarEstoqueConfiguracao(currentUser, apenasConfigurados = false) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para configurar a lojinha');
    const where = { empresa_id: empresaId, is_materia_prima: { [Op.not]: true } };
    if (apenasConfigurados) where.loja_online_configurado = true;
    const produtos = await Product.findAll({
      where,
      attributes: ['id', 'name', 'loja_online_nome', 'code', 'category', 'price', 'currentQuantity', 'unidade_medida', 'loja_online_ativo', 'loja_online_configurado', 'loja_online_preco', 'loja_online_preco_original', 'loja_online_granel', 'loja_online_preco_kg', 'loja_online_categoria', 'loja_online_descricao', 'loja_online_foto_url', 'loja_online_secoes', 'loja_online_ordem', 'loja_online_destaque', 'loja_online_promocao'],
      order: [['loja_online_ordem', 'ASC'], ['name', 'ASC']],
    });
    return produtos.map((produto) => {
      const aGranel = Boolean(produto.loja_online_granel) || normalizarSlug(produto.loja_online_categoria) === 'granel';
      return {
      categoria: aGranel ? 'Granel' : (produto.loja_online_categoria || ''),
      secoes: Array.isArray(produto.loja_online_secoes) ? produto.loja_online_secoes : [],
      id: produto.id,
      nome: produto.loja_online_nome || produto.name,
      nome_original: produto.name,
      nome_loja: produto.loja_online_nome || null,
      codigo: produto.code,
      categoria_estoque: produto.category,
      preco_estoque: numero(produto.price),
      estoque: Math.max(0, numero(produto.currentQuantity)),
      unidade: produto.unidade_medida || 'UN',
      ativo: Boolean(produto.loja_online_ativo),
      configurado: Boolean(produto.loja_online_configurado),
      preco: aGranel ? numero(produto.loja_online_preco_kg ?? produto.loja_online_preco ?? produto.price) : (produto.loja_online_preco == null ? numero(produto.price) : numero(produto.loja_online_preco)),
      a_granel: aGranel,
      preco_kg: aGranel ? numero(produto.loja_online_preco_kg ?? produto.loja_online_preco ?? produto.price) : null,
      descricao: produto.loja_online_descricao || '',
      foto_url: produto.loja_online_foto_url || null,
      ordem: numero(produto.loja_online_ordem),
      destaque: Boolean(produto.loja_online_destaque),
      promocao: Boolean(produto.loja_online_promocao),
      preco_original: produto.loja_online_preco_original == null ? null : numero(produto.loja_online_preco_original),
      vendidos: 0,
    }; });
  }

  async atualizarConfiguracao(id, dados, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    const produto = await Product.findOne({ where: { id, empresa_id: empresaId, is_materia_prima: { [Op.not]: true } } });
    if (!produto) throw new Error('Produto não encontrado para esta empresa');
    const preco = dados.preco === '' || dados.preco == null ? Number(produto.price) : numero(dados.preco, -1);
    if (preco < 0) throw new Error('O preço da loja deve ser maior ou igual a zero');
    const categoria = String(dados.categoria || '').trim() || null;
    const aGranel = Boolean(dados.a_granel) || normalizarSlug(categoria) === 'granel';
    const precoKg = dados.preco_kg === '' || dados.preco_kg == null ? preco : numero(dados.preco_kg, -1);
    if (aGranel && precoKg <= 0) throw new Error('Informe um preço por kg maior que zero para produtos a granel');
    const secoes = Array.isArray(dados.secoes) ? dados.secoes.map((secao) => String(secao)).filter(Boolean) : [];
    const nomeLoja = dados.nome_loja === undefined
      ? produto.loja_online_nome
      : String(dados.nome_loja || '').trim().slice(0, 200) || null;
    await produto.update({
      loja_online_configurado: true,
      // Estar na loja é diferente de estar em uma vitrine. Sem seções
      // especiais, o produto continua em "Todos".
      loja_online_ativo: Boolean(dados.ativo) && Boolean(categoria),
      loja_online_preco: aGranel ? precoKg : preco,
      loja_online_nome: nomeLoja,
      loja_online_granel: aGranel,
      loja_online_preco_kg: aGranel ? precoKg : null,
      loja_online_preco_original: dados.preco_original === '' || dados.preco_original == null ? null : numero(dados.preco_original, preco),
      loja_online_categoria: categoria,
      loja_online_descricao: String(dados.descricao || '').trim() || null,
      loja_online_secoes: secoes,
      loja_online_ordem: Math.max(0, Math.trunc(numero(dados.ordem))),
      loja_online_destaque: Boolean(dados.destaque),
      loja_online_promocao: Boolean(dados.promocao),
    });
    return this.listarConfiguracao(currentUser);
  }

  async atualizarFoto(id, arquivo, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!arquivo) throw new Error('Selecione uma imagem');
    const produto = await Product.findOne({ where: { id, empresa_id: empresaId, is_materia_prima: { [Op.not]: true } } });
    if (!produto) throw new Error('Produto não encontrado para esta empresa');
    const cloudinaryConfigurado = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET
    );

    const salvarComoDataUrl = async () => {
      const fotoUrl = `data:${arquivo.mimetype};base64,${arquivo.buffer.toString('base64')}`;
      await produto.update({ loja_online_foto_url: fotoUrl, loja_online_foto_public_id: null, loja_online_configurado: true });
      return { id: produto.id, foto_url: fotoUrl };
    };

    if (!cloudinaryConfigurado) return salvarComoDataUrl();

    try {
      const resultado = await CloudinaryService.uploadFile(arquivo.buffer, arquivo.originalname, 'saude-e-vida/loja');
      if (produto.loja_online_foto_public_id) {
        await CloudinaryService.deleteFile(produto.loja_online_foto_public_id, 'image').catch(() => {});
      }
      await produto.update({ loja_online_foto_url: resultado.secure_url, loja_online_foto_public_id: resultado.public_id, loja_online_configurado: true });
      return { id: produto.id, foto_url: produto.loja_online_foto_url };
    } catch (error) {
      console.error('[LojaOnline] Cloudinary indisponível; salvando a foto no cadastro do produto:', error.message);
      return salvarComoDataUrl();
    }
  }

  async listarCupons(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para configurar cupons');
    const cupons = await LojaCupom.findAll({ where: { empresa_id: empresaId }, order: [['created_at', 'DESC'], ['id', 'DESC']] });
    return cupons.map(cupomPublico);
  }

  async listarClientesParaCupons(currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para configurar cupons');
    const clientes = await Cliente.findAll({
      where: { empresa_id: empresaId },
      attributes: ['id', 'nomeCompleto', 'telefone', 'email'],
      order: [['nomeCompleto', 'ASC'], ['id', 'ASC']],
    });
    return clientes;
  }

  async validarCupom(slug, dados = {}, clienteAutenticado = null) {
    const empresa = await this.resolverEmpresa(slug);
    if (!clienteAutenticado) throw erroComStatus(401, 'Faça login para aplicar um cupom');
    const codigoCupom = normalizarCupom(dados.codigo);
    const valorBruto = Number(Math.max(0, numero(dados.valor_bruto)).toFixed(2));
    if (!codigoCupom) throw erroDeEntrada('Informe o código do cupom');
    if (!valorBruto) throw erroDeEntrada('Adicione um produto ao carrinho antes de aplicar o cupom');

    let cupom = null;
    let tipo = 'percentual';
    let valor = PRIMEIRA_COMPRA_PERCENTUAL;
    if (codigoCupom === PRIMEIRA_COMPRA_CUPOM) {
      const comprasAnteriores = await Venda.count({ where: whereCompraConsumada(empresa.id, clienteAutenticado.id) });
      if (comprasAnteriores > 0) throw erroDeEntrada('O desconto de primeira compra já foi utilizado por este cliente.');
    } else {
      cupom = await LojaCupom.findOne({ where: { empresa_id: empresa.id, codigo: codigoCupom, ativo: true } });
      if (!cupom) throw erroDeEntrada('Cupom não encontrado ou inativo');
      if (cupom.cliente_id && Number(cupom.cliente_id) !== Number(clienteAutenticado.id)) throw erroDeEntrada('Este cupom está vinculado a outro cliente.');
      const agora = Date.now();
      if (cupom.validade_inicio && new Date(cupom.validade_inicio).getTime() > agora) throw erroDeEntrada('Este cupom ainda não está válido');
      if (cupom.validade_fim && new Date(cupom.validade_fim).getTime() < agora) throw erroDeEntrada('Este cupom está vencido');
      if (cupom.limite_uso && Number(cupom.usos) >= Number(cupom.limite_uso)) throw erroDeEntrada('Este cupom já atingiu o limite de uso');
      if (cupom.uso_unico_cliente) {
        const usado = await Venda.count({ where: { empresa_id: empresa.id, cliente_id: clienteAutenticado.id, loja_cupom_id: cupom.id, status_loja: { [Op.ne]: 'cancelado' } } });
        if (usado > 0) throw erroDeEntrada('Este cupom já foi utilizado por este cliente.');
      }
      const itensCupom = Array.isArray(dados.itens) ? dados.itens : [];
      if (cupom.tipo === 'produto') {
        const produtoSelecionado = cupom.produto_id
          ? itensCupom.find((item) => Number(item.produto_id) === Number(cupom.produto_id))
          : itensCupom
            .filter((item) => Number(item.quantidade || 0) > 0)
            .sort((a, b) => Number(a.valor_unitario || 0) - Number(b.valor_unitario || 0))[0];
        const unidades = itensCupom.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
        if (!produtoSelecionado || (!cupom.produto_id && unidades < 2)) {
          throw erroDeEntrada(cupom.produto_id ? 'Este cupom só pode ser usado com o produto premiado.' : 'Adicione pelo menos dois itens para usar o benefício de produto grátis.');
        }
        tipo = cupom.tipo;
        valor = Number(produtoSelecionado.valor_unitario || 0);
      }
      tipo = cupom.tipo;
      if (cupom.tipo !== 'produto') valor = Number(cupom.valor);
    }

    const desconto = Number(Math.min(valorBruto, Math.max(0, tipo === 'percentual' ? valorBruto * valor / 100 : valor)).toFixed(2));
    return {
      codigo: codigoCupom,
      tipo,
      valor,
      valor_bruto: valorBruto,
      desconto,
      valor_total: Number((valorBruto - desconto).toFixed(2)),
      mensagem: codigoCupom === PRIMEIRA_COMPRA_CUPOM ? 'Desconto de primeira compra aplicado.' : 'Cupom aplicado com sucesso.',
    };
  }

  async criarCupom(dados, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para configurar cupons');
    const codigo = normalizarCupom(dados.codigo);
    const titulo = String(dados.titulo || '').trim();
    const tipo = ['percentual', 'fixo'].includes(dados.tipo) ? dados.tipo : 'percentual';
    const valor = numero(dados.valor, -1);
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(codigo)) throw erroDeEntrada('Use um código de cupom com pelo menos 3 caracteres, sem espaços');
    if (!titulo) throw erroDeEntrada('Informe um título para o cupom');
    if (valor <= 0 || (tipo === 'percentual' && valor > 100)) throw erroDeEntrada('Informe um valor de desconto válido');
    if (dados.validade_fim && Number.isNaN(new Date(dados.validade_fim).getTime())) throw erroDeEntrada('A validade do cupom é inválida');
    try {
      const cupom = await LojaCupom.create({
        empresa_id: empresaId,
        codigo,
        titulo,
        tipo,
        valor,
        validade_inicio: dados.validade_inicio || null,
        validade_fim: dados.validade_fim || null,
        limite_uso: dados.limite_uso ? Math.max(1, Math.trunc(numero(dados.limite_uso))) : null,
        ativo: dados.ativo !== false,
        mensagem: String(dados.mensagem || '').trim() || null,
      });
      return cupomPublico(cupom);
    } catch (error) {
      if (error?.name === 'SequelizeUniqueConstraintError') throw erroComStatus(409, 'Já existe um cupom com esse código');
      throw error;
    }
  }

  async enviarCupom(cupomId, clienteIds, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para enviar cupons');
    const ids = [...new Set((Array.isArray(clienteIds) ? clienteIds : []).map(Number).filter(Number.isInteger))];
    if (!ids.length) throw erroDeEntrada('Selecione pelo menos um cliente');
    const [cupom, clientes] = await Promise.all([
      LojaCupom.findOne({ where: { id: cupomId, empresa_id: empresaId, ativo: true } }),
      Cliente.findAll({ where: { id: { [Op.in]: ids }, empresa_id: empresaId } }),
    ]);
    if (!cupom) throw erroComStatus(404, 'Cupom não encontrado ou inativo');
    if (clientes.length !== ids.length) throw erroDeEntrada('Um ou mais clientes não pertencem à empresa selecionada');
    const resultados = [];
    for (const cliente of clientes) {
      const mensagemPadrao = `Olá, ${cliente.nomeCompleto}! Você recebeu o cupom ${cupom.codigo} da Saúde e Vida. Aproveite ${cupom.tipo === 'percentual' ? `${Number(cupom.valor)}% de desconto` : `R$ ${Number(cupom.valor).toFixed(2).replace('.', ',')} de desconto`} na lojinha online.${cupom.validade_fim ? ` Válido até ${new Date(cupom.validade_fim).toLocaleDateString('pt-BR')}.` : ''}`;
      const mensagem = String(cupom.mensagem || mensagemPadrao).replaceAll('{{nome}}', cliente.nomeCompleto).replaceAll('{{codigo}}', cupom.codigo);
      try {
        await whatsappCrmService.sendTextToPhone(cliente.telefone, mensagem, currentUser, cliente);
        await LojaCupomEnvio.create({ empresa_id: empresaId, cupom_id: cupom.id, cliente_id: cliente.id, telefone: cliente.telefone, mensagem, status: 'enviado', enviado_em: new Date() });
        resultados.push({ cliente_id: cliente.id, nome: cliente.nomeCompleto, status: 'enviado' });
      } catch (error) {
        await LojaCupomEnvio.create({ empresa_id: empresaId, cupom_id: cupom.id, cliente_id: cliente.id, telefone: cliente.telefone, mensagem, status: 'erro', erro: error.message });
        resultados.push({ cliente_id: cliente.id, nome: cliente.nomeCompleto, status: 'erro', erro: error.message });
      }
    }
    return { cupom: cupomPublico(cupom), resultados, enviados: resultados.filter((item) => item.status === 'enviado').length, erros: resultados.filter((item) => item.status === 'erro').length };
  }

  async localizarOuCriarCliente(dados) {
    const email = String(dados.email || '').trim().toLowerCase() || null;
    const telefone = String(dados.telefone || '').trim();
    const cep = normalizarCep(dados.cep);
    const where = email
      ? { empresa_id: dados.empresa_id, email }
      : { empresa_id: dados.empresa_id, telefone };
    let cliente = await Cliente.findOne({ where });
    const payload = {
      nomeCompleto: String(dados.nome || '').trim(),
      email,
      telefone,
      cep,
      rua: dados.rua || null,
      numero: dados.numero || null,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      empresa_id: dados.empresa_id,
    };
    if (cliente) {
      await cliente.update(payload);
      return cliente;
    }
    cliente = await Cliente.create(payload);
    return cliente;
  }

  async criarPedido(slug, dados, clienteAutenticado = null) {
    const empresa = await this.resolverEmpresa(slug);
    if (!clienteAutenticado) throw erroComStatus(401, 'Faça login para finalizar o pedido');
    const itensRecebidos = Array.isArray(dados.itens) ? dados.itens : [];
    if (!itensRecebidos.length) throw erroDeEntrada('Adicione pelo menos um produto ao carrinho');
    if (!String(dados.nome || '').trim() || !String(dados.telefone || '').trim()) {
      throw erroDeEntrada('Nome e telefone são obrigatórios');
    }

    const ids = [...new Set(itensRecebidos.map((item) => Number(item.produto_id)).filter(Number.isInteger))];
    const produtos = await Product.findAll({
      where: {
        id: { [Op.in]: ids },
        empresa_id: empresa.id,
        loja_online_ativo: true,
        currentQuantity: { [Op.gt]: 0 },
      },
    });
    const porId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
    const itens = itensRecebidos.map((item) => {
      const produto = porId.get(Number(item.produto_id));
      const quantidade = numero(item.quantidade);
      if (!produto) throw erroDeEntrada('Um dos produtos do carrinho não está mais disponível');
      if (quantidade <= 0) throw erroDeEntrada(`Quantidade inválida para ${produto.name}`);
      if (numero(produto.currentQuantity) < quantidade) {
        throw erroDeEntrada(`Estoque insuficiente para ${produto.name}`);
      }
      const aGranel = Boolean(produto.loja_online_granel);
      const valorUnitario = numero(aGranel ? (produto.loja_online_preco_kg ?? produto.loja_online_preco ?? produto.price) : (produto.loja_online_preco ?? produto.price));
      return {
        produto_id: produto.id,
        nome_item: produto.loja_online_nome || produto.name,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: Number((valorUnitario * quantidade).toFixed(2)),
      };
    });
    const valorBruto = Number(itens.reduce((total, item) => total + item.valor_total, 0).toFixed(2));
    let cupom = null;
    let desconto = 0;
    const codigoCupom = normalizarCupom(dados.cupom);
    if (codigoCupom) {
      if (codigoCupom === PRIMEIRA_COMPRA_CUPOM) {
        const comprasAnteriores = await Venda.count({ where: whereCompraConsumada(empresa.id, clienteAutenticado.id) });
        if (comprasAnteriores > 0) throw erroDeEntrada('O desconto de primeira compra já foi utilizado por este cliente.');
        desconto = valorBruto * PRIMEIRA_COMPRA_PERCENTUAL / 100;
      } else {
        cupom = await LojaCupom.findOne({ where: { empresa_id: empresa.id, codigo: codigoCupom, ativo: true } });
        if (!cupom) throw erroDeEntrada('Cupom não encontrado ou inativo');
        if (cupom.cliente_id && Number(cupom.cliente_id) !== Number(clienteAutenticado.id)) throw erroDeEntrada('Este cupom está vinculado a outro cliente.');
        const agora = Date.now();
        if (cupom.validade_inicio && new Date(cupom.validade_inicio).getTime() > agora) throw erroDeEntrada('Este cupom ainda não está válido');
        if (cupom.validade_fim && new Date(cupom.validade_fim).getTime() < agora) throw erroDeEntrada('Este cupom está vencido');
        if (cupom.limite_uso && Number(cupom.usos) >= Number(cupom.limite_uso)) throw erroDeEntrada('Este cupom já atingiu o limite de uso');
        if (cupom.uso_unico_cliente) {
          const usado = await Venda.count({ where: { empresa_id: empresa.id, cliente_id: clienteAutenticado.id, loja_cupom_id: cupom.id, status_loja: { [Op.ne]: 'cancelado' } } });
          if (usado > 0) throw erroDeEntrada('Este cupom já foi utilizado por este cliente.');
        }
        if (cupom.tipo === 'produto') {
          const itemPremiado = cupom.produto_id
            ? itens.find((item) => Number(item.produto_id) === Number(cupom.produto_id))
            : itens.filter((item) => Number(item.quantidade || 0) > 0).sort((a, b) => Number(a.valor_unitario || 0) - Number(b.valor_unitario || 0))[0];
          const unidades = itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
          if (!itemPremiado || (!cupom.produto_id && unidades < 2)) throw erroDeEntrada(cupom.produto_id ? 'Este cupom só pode ser usado com o produto premiado.' : 'Adicione pelo menos dois itens para usar o benefício de produto grátis.');
          desconto = Number(itemPremiado.valor_unitario || 0);
        } else {
          desconto = cupom.tipo === 'percentual' ? valorBruto * Number(cupom.valor) / 100 : Number(cupom.valor);
        }
      }
      desconto = Number(Math.min(valorBruto, Math.max(0, desconto)).toFixed(2));
    }
    const valorTotal = Number((valorBruto - desconto).toFixed(2));
    const cliente = clienteAutenticado;
    const cep = normalizarCep(dados.cep) || normalizarCep(cliente.cep);
    const cidade = String(dados.cidade || cliente.cidade || '').trim();
    const estado = String(dados.estado || cliente.estado || '').trim().toUpperCase();
    const formaEntrega = String(dados.forma_entrega || 'retirada').toLowerCase();
    if (!['entrega', 'retirada'].includes(formaEntrega)) throw erroDeEntrada('Escolha uma forma válida de recebimento.');
    if (formaEntrega === 'entrega' && !cidadePermiteEntrega(cidade, estado)) {
      throw erroDeEntrada('A entrega está disponível somente para Campina Grande e Esperança/PB.');
    }
    await cliente.update({
      nomeCompleto: cliente.nomeCompleto,
      telefone: cliente.telefone,
      email: cliente.email,
      cep,
      rua: dados.rua || cliente.rua || null,
      numero: dados.numero || cliente.numero || null,
      complemento: dados.complemento || cliente.complemento || null,
      bairro: dados.bairro || cliente.bairro || null,
      cidade: cidade || null,
      estado: estado || null,
    });
    const endereco = [dados.rua || cliente.rua, dados.numero || cliente.numero, dados.complemento || cliente.complemento, dados.bairro || cliente.bairro, cidade, estado, cep]
      .filter(Boolean)
      .join(', ');

    // O cliente escolhe cartão ou Pix; os dados seguem pelo pagamento direto do
    // Mercado Pago. Dados brutos do cartão nunca passam pelo nosso servidor.
    const formaPagamento = String(dados.forma_pagamento || 'cartao').toLowerCase() === 'pix' ? 'pix' : 'cartao';
    const venda = await vendaService.create({
      cliente_id: cliente.id,
      forma_pagamento: formaPagamento,
      valor_total: valorTotal,
      desconto,
      loja_cupom_id: cupom?.id || null,
      loja_cupom_codigo: codigoCupom || null,
      taxa_entrega: 0,
      endereco_entrega: endereco || null,
      forma_entrega: formaEntrega,
      observacao: dados.observacao || 'Pedido recebido pela loja online.',
      origem: 'loja_online',
      // A venda é criada provisoriamente para gerar a referência do Mercado
      // Pago, mas só entra na operação depois da confirmação do pagamento.
      status_loja: 'aguardando_pagamento',
      status_loja_atualizado_em: new Date(),
      status_loja_historico: [{ status: 'aguardando_pagamento', em: new Date().toISOString(), origem: 'cliente' }],
      itens,
    }, { id: null, tipo: 'PUBLICO', empresa_id: empresa.id });

    let pagamentoOnline = null;
    if (formaPagamento === 'pix' || formaPagamento === 'cartao') {
      try {
        pagamentoOnline = await mercadoPagoService.criarPagamento({
          venda,
          empresaId: empresa.id,
          cliente,
          pagamento: { ...(dados.pagamento || {}), tipo: formaPagamento },
          valorTotal,
        });
        await Venda.update({
          mercado_pago_payment_id: String(pagamentoOnline.id),
          mercado_pago_status: pagamentoOnline.status,
          pagamentos: [{
            provider: 'mercado_pago',
            payment_id: String(pagamentoOnline.id),
            status: pagamentoOnline.status,
            status_detail: pagamentoOnline.status_detail,
          }],
        }, { where: { id: venda.id, empresa_id: empresa.id } });

        if (['rejected', 'cancelled', 'cancelled_by_collector'].includes(String(pagamentoOnline.status))) {
          throw erroComStatus(
            422,
            mensagemRecusaMercadoPago(pagamentoOnline.status_detail, formaPagamento),
          );
        }

        if (['approved', 'authorized'].includes(String(pagamentoOnline.status).toLowerCase())) {
          await this.atualizarStatus(venda.id, 'novo', { tipo: 'MASTER', empresa_id_override: empresa.id });
          await this.notificarPedido(venda, cliente);
        }
      } catch (error) {
        await this.atualizarStatus(venda.id, 'cancelado', { tipo: 'MASTER', empresa_id_override: empresa.id });
        // Falhas de validação/token ou recusas não são pedidos. Devolve o
        // estoque reservado e remove a venda técnica criada para a referência.
        if (!pagamentoOnline || ['rejected', 'cancelled', 'cancelled_by_collector'].includes(String(pagamentoOnline.status).toLowerCase())) {
          await VendaItem.destroy({ where: { venda_id: venda.id } });
          await Venda.destroy({ where: { id: venda.id, empresa_id: empresa.id, origem: 'loja_online' } });
        }
        throw error;
      }
    }
    // Para Pix pendente, o pedido só será promovido/notificado pelo webhook
    // depois que o Mercado Pago confirmar o pagamento.
    const pagamentoConfirmado = !pagamentoOnline || ['approved', 'authorized'].includes(String(pagamentoOnline.status).toLowerCase());
    if (cupom && pagamentoConfirmado) await cupom.increment('usos');

    return {
      pedido: Number(venda.id),
      status: pagamentoConfirmado ? 'novo' : 'aguardando_pagamento',
      valor_total: valorTotal,
      desconto,
      cupom: codigoCupom || null,
      pagamento_online: pagamentoOnline ? {
        provider: 'mercado_pago',
        payment_id: pagamentoOnline.id,
        status: pagamentoOnline.status,
        status_detail: pagamentoOnline.status_detail,
        pix: pagamentoOnline.pix,
      } : null,
      mensagem: pagamentoConfirmado
        ? 'Pedido recebido! A Saúde e Vida entrará em contato para confirmar a entrega.'
        : 'Pagamento aguardando confirmação. O pedido só será enviado para a loja depois que o pagamento for aprovado.',
    };
  }

  async notificarPedido(venda, cliente = null) {
    await AutomacaoNotificacao.create({
      empresa_id: venda.empresa_id,
      regra_id: null,
      tipo: 'info',
      titulo: 'Novo pedido recebido',
      mensagem: `Pedido #${venda.id} recebido pela lojinha de ${cliente?.nomeCompleto || 'um cliente'}.`,
      lida: false,
    }).catch((error) => {
      console.error('[LojaOnlineService] Não foi possível criar notificação do pedido:', error.message);
    });
  }

  async processarWebhookMercadoPago(payload = {}, query = {}) {
    const tipo = payload.type || payload.topic || query.type || query.topic;
    const paymentId = payload.data?.id || payload.id || query['data.id'] || query.id;
    if (tipo && tipo !== 'payment' && tipo !== 'merchant_order') return { ignored: true, reason: 'event_type' };
    if (!paymentId) return { ignored: true, reason: 'payment_id' };

    const pagamento = await mercadoPagoService.consultarPagamento(paymentId);
    const referencia = String(pagamento.external_reference || '');
    const encontrado = referencia.match(/^loja:(\d+):pedido:(\d+)$/);
    if (!encontrado) return { ignored: true, reason: 'external_reference' };

    const empresaId = Number(encontrado[1]);
    const pedidoId = Number(encontrado[2]);
    const pedido = await Venda.findOne({ where: { id: pedidoId, empresa_id: empresaId, origem: 'loja_online' } });
    if (!pedido) return { ignored: true, reason: 'order_not_found' };

    const status = String(pagamento.status || 'pending');
    await pedido.update({
      mercado_pago_payment_id: String(paymentId),
      mercado_pago_status: status,
      mercado_pago_ultimo_evento_em: new Date(),
      pagamentos: [{
        provider: 'mercado_pago',
        payment_id: String(paymentId),
        preference_id: pedido.mercado_pago_preference_id,
        status,
        status_detail: pagamento.status_detail || null,
        transaction_amount: pagamento.transaction_amount || null,
        atualizado_em: new Date().toISOString(),
      }],
    });

    if (['approved', 'authorized'].includes(status) && pedido.status_loja === 'aguardando_pagamento') {
      await this.atualizarStatus(pedido.id, 'novo', { tipo: 'MASTER', empresa_id_override: empresaId });
      if (pedido.loja_cupom_id) {
        const cupom = await LojaCupom.findOne({ where: { id: pedido.loja_cupom_id, empresa_id: empresaId } });
        if (cupom) await cupom.increment('usos');
      }
      const cliente = pedido.cliente_id
        ? await Cliente.findOne({ where: { id: pedido.cliente_id, empresa_id: empresaId } })
        : null;
      await this.notificarPedido(pedido, cliente);
    }

    const aguardandoPagamento = pedido.status_loja === 'aguardando_pagamento';
    if (['cancelled', 'cancelled_by_collector', 'charged_back', 'rejected', 'refunded'].includes(status) && pedido.status_loja !== 'cancelado') {
      await this.atualizarStatus(pedido.id, 'cancelado', { tipo: 'MASTER', empresa_id_override: empresaId });
      if (aguardandoPagamento) {
        await VendaItem.destroy({ where: { venda_id: pedido.id } });
        await Venda.destroy({ where: { id: pedido.id, empresa_id: empresaId, origem: 'loja_online' } });
      }
    }

    return { processed: true, pedido: pedido.id, status };
  }

  async listarPedidos(currentUser, filters = {}) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para visualizar os pedidos');
    const where = { origem: 'loja_online', empresa_id: empresaId, status_loja: { [Op.notIn]: ['aguardando_pagamento'] } };
    if (filters.status) where.status_loja = filters.status;
    const pedidos = await Venda.findAll({
      where,
      include: [
        { model: VendaItem, as: 'itens', include: [{ model: Product, attributes: ['id', 'name', 'currentQuantity', 'unidade_medida'] }] },
        { model: Cliente, as: 'cliente', attributes: ['id', 'nomeCompleto', 'telefone', 'email', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    return pedidos;
  }

  async cancelarPedido(id, dados = {}, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) throw new Error('Selecione uma empresa para cancelar o pedido');
    const solicitarReembolso = Boolean(dados.reembolsar);

    let pedido = await Venda.findOne({
      where: { id, origem: 'loja_online', empresa_id: empresaId },
      attributes: ['id', 'status_loja', 'mercado_pago_payment_id', 'mercado_pago_status', 'mercado_pago_reembolso_id', 'mercado_pago_reembolso_status', 'pagamentos'],
    });
    if (!pedido) throw erroComStatus(404, 'Pedido não encontrado');

    if (pedido.status_loja !== 'cancelado') {
      pedido = await this.atualizarStatus(id, 'cancelado', currentUser);
    }

    if (!solicitarReembolso) {
      return {
        pedido,
        cancelado: true,
        reembolso: { status: pedido.mercado_pago_reembolso_status || 'nao_solicitado' },
        mensagem: 'Venda cancelada e estoque devolvido.',
      };
    }

    if (pedido.mercado_pago_reembolso_status === 'estornado') {
      return {
        pedido,
        cancelado: true,
        reembolso: { status: 'estornado', id: pedido.mercado_pago_reembolso_id },
        mensagem: 'A venda já foi reembolsada.',
      };
    }

    const paymentId = String(pedido.mercado_pago_payment_id || '').trim();
    if (!paymentId) {
      await pedido.update({ mercado_pago_reembolso_status: 'nao_aplicavel' });
      return {
        pedido,
        cancelado: true,
        reembolso: { status: 'nao_aplicavel' },
        mensagem: 'Venda cancelada. Não há pagamento online do Mercado Pago para estornar; combine a devolução com o cliente.',
      };
    }

    const pagamentoStatus = String(pedido.mercado_pago_status || '').toLowerCase();
    if (!['approved', 'authorized'].includes(pagamentoStatus)) {
      await pedido.update({ mercado_pago_reembolso_status: 'nao_aplicavel' });
      return {
        pedido,
        cancelado: true,
        reembolso: { status: 'nao_aplicavel', pagamento_status: pagamentoStatus || 'desconhecido' },
        mensagem: `Venda cancelada. O pagamento está com status "${pagamentoStatus || 'desconhecido'}" e não pode ser reembolsado automaticamente.`,
      };
    }

    const idempotencyKey = `loja-pedido-${pedido.id}-reembolso-total`;
    await pedido.update({ mercado_pago_reembolso_status: 'processando' });
    try {
      const reembolso = await mercadoPagoService.reembolsarPagamento(paymentId, idempotencyKey);
      const pagamentos = Array.isArray(pedido.pagamentos) ? pedido.pagamentos : [];
      const pagamentosAtualizados = pagamentos.length
        ? pagamentos.map((pagamento) => pagamento.provider === 'mercado_pago'
          ? { ...pagamento, status: 'refunded', refund_id: String(reembolso.id || ''), reembolsado_em: new Date().toISOString() }
          : pagamento)
        : [{ provider: 'mercado_pago', payment_id: paymentId, status: 'refunded', refund_id: String(reembolso.id || '') }];
      await pedido.update({
        mercado_pago_reembolso_id: reembolso.id ? String(reembolso.id) : null,
        mercado_pago_reembolso_status: 'estornado',
        mercado_pago_reembolsado_em: new Date(),
        mercado_pago_status: 'refunded',
        pagamentos: pagamentosAtualizados,
      });
      return {
        pedido,
        cancelado: true,
        reembolso: { status: 'estornado', id: reembolso.id ? String(reembolso.id) : null },
        mensagem: 'Venda cancelada, estoque devolvido e reembolso solicitado ao Mercado Pago.',
      };
    } catch (error) {
      await pedido.update({ mercado_pago_reembolso_status: 'erro' });
      error.reembolsoPendente = true;
      throw error;
    }
  }

  async atualizarStatus(id, status, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    const permitidos = ['novo', 'separando', 'enviado', 'concluido', 'cancelado'];
    if (!permitidos.includes(status)) throw erroDeEntrada('Status de pedido inválido');
    const transaction = await sequelize.transaction();
    try {
      const pedido = await Venda.findOne({
        where: { id, origem: 'loja_online', empresa_id: empresaId },
        include: [{ model: VendaItem, as: 'itens', required: true }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!pedido) throw erroComStatus(404, 'Pedido não encontrado');
      if (pedido.status_loja === 'cancelado' && status !== 'cancelado') {
        throw erroDeEntrada('Um pedido cancelado não pode voltar para o fluxo operacional');
      }
      if (status === 'cancelado' && pedido.status_loja !== 'cancelado') {
        for (const item of pedido.itens || []) {
          if (!item.produto_id) continue;
          const produto = await Product.findOne({ where: { id: item.produto_id, empresa_id: empresaId }, transaction, lock: transaction.LOCK.UPDATE });
          if (!produto) continue;
          const quantidade = numero(item.quantidade);
          const estoquePosterior = numero(produto.currentQuantity) + quantidade;
          await produto.update({ currentQuantity: estoquePosterior }, { transaction });
          await Movimento.create({
            produto_id: produto.id,
            empresa_id: empresaId,
            usuario_id: currentUser?.id ?? null,
            tipo: 'entrada',
            quantidade,
            motivo: 'Cancelamento de pedido da loja online',
            origem_tipo: 'loja_online_cancelamento',
            origem_id: pedido.id,
            data: new Date(),
          }, { transaction });
        }
      }
      const historicoAnterior = Array.isArray(pedido.status_loja_historico) ? pedido.status_loja_historico : [];
      const historico = pedido.status_loja === status
        ? historicoAnterior
        : [...historicoAnterior, { status, em: new Date().toISOString(), origem: 'gestao' }];
      await pedido.update({
        status_loja: status,
        status_loja_atualizado_em: new Date(),
        status_loja_historico: historico,
      }, { transaction });
      await transaction.commit();
      if (['novo', 'separando', 'enviado', 'concluido'].includes(status)) {
        await lojaProgramaService.registrarVenda(pedido.id);
      }
      return pedido;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new LojaOnlineService();
