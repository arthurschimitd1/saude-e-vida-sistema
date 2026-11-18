import sequelize from '../config/database.js';
import Product from '../models/Product.js';
import ProductLocationStock from '../models/ProductLocationStock.js';
import StockLocation from '../models/StockLocation.js';
import StockTransfer from '../models/StockTransfer.js';
import Movimento from '../models/Movimento.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const TIPOS = new Set(['matriz', 'filial', 'deposito', 'producao']);
const numeroPositivo = (valor, campo = 'quantidade') => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`${campo} deve ser maior que zero`);
  return Number(numero.toFixed(3));
};

class StockLocationService {
  empresaDoUsuario(user) {
    const empresaId = Number(empresaParaGravar(user));
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error('Selecione uma empresa para gerenciar as unidades de estoque');
    }
    return empresaId;
  }

  async garantirPrincipal(empresaId, transaction) {
    let principal = await StockLocation.findOne({ where: { empresa_id: empresaId, principal: true }, transaction });
    if (!principal) {
      principal = await StockLocation.create({
        empresa_id: empresaId, nome: 'Unidade principal', tipo: 'matriz', principal: true, ativo: true
      }, { transaction });
    }
    return principal;
  }

  async listar(user) {
    const empresaId = this.empresaDoUsuario(user);
    const t = await sequelize.transaction();
    try {
      await this.garantirPrincipal(empresaId, t);
      const unidades = await StockLocation.findAll({
        where: { empresa_id: empresaId }, order: [['principal', 'DESC'], ['nome', 'ASC']], transaction: t
      });
      await t.commit();
      return unidades;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async criar(dados, user) {
    const empresaId = this.empresaDoUsuario(user);
    const nome = String(dados.nome || '').trim();
    const tipo = String(dados.tipo || 'filial').trim().toLowerCase();
    if (nome.length < 2 || nome.length > 120) throw new Error('Informe um nome de unidade entre 2 e 120 caracteres');
    if (!TIPOS.has(tipo) || tipo === 'matriz') throw new Error('Tipo de unidade inválido');
    const t = await sequelize.transaction();
    try {
      await this.garantirPrincipal(empresaId, t);
      const unidade = await StockLocation.create({
        empresa_id: empresaId, nome, tipo,
        endereco: String(dados.endereco || '').trim() || null,
        principal: false, ativo: true
      }, { transaction: t });
      await t.commit();
      return unidade;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async atualizar(id, dados, user) {
    const empresaId = this.empresaDoUsuario(user);
    const unidade = await StockLocation.findOne({ where: { id: Number(id), empresa_id: empresaId } });
    if (!unidade) throw new Error('Unidade não encontrada');
    const alteracoes = {};
    if (dados.nome !== undefined) {
      const nome = String(dados.nome).trim();
      if (nome.length < 2 || nome.length > 120) throw new Error('Informe um nome de unidade entre 2 e 120 caracteres');
      alteracoes.nome = nome;
    }
    if (dados.endereco !== undefined) alteracoes.endereco = String(dados.endereco || '').trim() || null;
    if (dados.tipo !== undefined && !unidade.principal) {
      const tipo = String(dados.tipo).trim().toLowerCase();
      if (!TIPOS.has(tipo) || tipo === 'matriz') throw new Error('Tipo de unidade inválido');
      alteracoes.tipo = tipo;
    }
    if (dados.ativo !== undefined) {
      if (unidade.principal && dados.ativo === false) throw new Error('A unidade principal não pode ser desativada');
      if (!dados.ativo && unidade.ativo) {
        const saldo = await ProductLocationStock.sum('quantidade', { where: { unidade_id: unidade.id } });
        if (Number(saldo || 0) > 0) {
          throw new Error('Transfira todo o estoque desta unidade antes de desativá-la');
        }
      }
      alteracoes.ativo = Boolean(dados.ativo);
    }
    await unidade.update(alteracoes);
    return unidade;
  }

  async saldos(user) {
    const empresaId = this.empresaDoUsuario(user);
    const unidades = await this.listar(user);
    const produtos = await Product.findAll({ where: { empresa_id: empresaId }, order: [['name', 'ASC']] });
    const saldos = await ProductLocationStock.findAll({
      where: { unidade_id: unidades.map(u => u.id) }
    });
    const mapa = new Map(saldos.map(s => [`${s.produto_id}:${s.unidade_id}`, Number(s.quantidade)]));
    const principal = unidades.find(u => u.principal);
    return produtos.map(produto => ({
      produto_id: produto.id,
      produto_nome: produto.name,
      produto_codigo: produto.code,
      unidade_medida: produto.unidade_medida,
      saldos: unidades.map(unidade => ({
        unidade_id: unidade.id,
        quantidade: unidade.principal
          ? Number(produto.currentQuantity || 0)
          : Number(mapa.get(`${produto.id}:${unidade.id}`) || 0)
      })),
      total: Number((Number(produto.currentQuantity || 0) + unidades
        .filter(u => !u.principal)
        .reduce((soma, unidade) => soma + Number(mapa.get(`${produto.id}:${unidade.id}`) || 0), 0)).toFixed(3)),
      unidade_principal_id: principal?.id
    }));
  }

  async transferir(dados, user) {
    const empresaId = this.empresaDoUsuario(user);
    const produtoId = Number(dados.produto_id);
    const origemId = Number(dados.unidade_origem_id);
    const destinoId = Number(dados.unidade_destino_id);
    const quantidade = numeroPositivo(dados.quantidade);
    if (![produtoId, origemId, destinoId].every(id => Number.isInteger(id) && id > 0)) {
      throw new Error('Produto, unidade de origem e unidade de destino são obrigatórios');
    }
    if (origemId === destinoId) throw new Error('A unidade de destino deve ser diferente da origem');
    const observacao = String(dados.observacao || '').trim().slice(0, 500) || null;

    const t = await sequelize.transaction();
    try {
      const produto = await Product.findOne({
        where: { id: produtoId, empresa_id: empresaId }, transaction: t, lock: t.LOCK.UPDATE
      });
      if (!produto) throw new Error('Produto não encontrado para a empresa selecionada');
      const unidades = await StockLocation.findAll({
        where: { id: [origemId, destinoId], empresa_id: empresaId, ativo: true },
        transaction: t, lock: t.LOCK.UPDATE
      });
      const origem = unidades.find(u => u.id === origemId);
      const destino = unidades.find(u => u.id === destinoId);
      if (!origem || !destino) throw new Error('Unidade de origem ou destino inválida/inativa');

      const obterSaldo = async unidade => {
        if (unidade.principal) return Number(produto.currentQuantity || 0);
        const [saldo] = await ProductLocationStock.findOrCreate({
          where: { produto_id: produto.id, unidade_id: unidade.id },
          defaults: { quantidade: 0 }, transaction: t
        });
        await saldo.reload({ transaction: t, lock: t.LOCK.UPDATE });
        return Number(saldo.quantidade || 0);
      };
      const definirSaldo = async (unidade, valor) => {
        if (unidade.principal) {
          await produto.update({ currentQuantity: valor }, { transaction: t });
          await ProductLocationStock.upsert({
            produto_id: produto.id, unidade_id: unidade.id, quantidade: valor
          }, { transaction: t });
          return;
        }
        const [saldo] = await ProductLocationStock.findOrCreate({
          where: { produto_id: produto.id, unidade_id: unidade.id }, defaults: { quantidade: 0 }, transaction: t
        });
        await saldo.update({ quantidade: valor }, { transaction: t });
      };

      const saldoOrigem = await obterSaldo(origem);
      const saldoDestino = await obterSaldo(destino);
      if (saldoOrigem < quantidade) {
        throw new Error(`Estoque insuficiente em "${origem.nome}": disponível ${saldoOrigem}, solicitado ${quantidade}`);
      }
      const novoOrigem = Number((saldoOrigem - quantidade).toFixed(3));
      const novoDestino = Number((saldoDestino + quantidade).toFixed(3));
      await definirSaldo(origem, novoOrigem);
      await definirSaldo(destino, novoDestino);

      const transferencia = await StockTransfer.create({
        empresa_id: empresaId, produto_id: produto.id,
        unidade_origem_id: origem.id, unidade_destino_id: destino.id,
        usuario_id: user?.id ?? null, quantidade, observacao
      }, { transaction: t });
      const movimentoBase = {
        produto_id: produto.id, empresa_id: empresaId, usuario_id: user?.id ?? null,
        quantidade, origem_tipo: 'transferencia_unidade', origem_id: transferencia.id, data: new Date()
      };
      await Movimento.bulkCreate([
        { ...movimentoBase, tipo: 'saida', motivo: `Transferência: ${origem.nome} → ${destino.nome}` },
        { ...movimentoBase, tipo: 'entrada', motivo: `Recebimento: ${origem.nome} → ${destino.nome}` }
      ], { transaction: t });
      await t.commit();
      return {
        id: transferencia.id, produto_id: produto.id, quantidade,
        origem: { id: origem.id, nome: origem.nome, saldo: novoOrigem },
        destino: { id: destino.id, nome: destino.nome, saldo: novoDestino }
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

export default new StockLocationService();
