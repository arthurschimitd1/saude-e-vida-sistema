import { Op } from 'sequelize';
import Orcamento from '../models/Orcamento.js';
import OrcamentoItem from '../models/OrcamentoItem.js';
import Cliente from '../models/Cliente.js';
import User from '../models/UserModel.js';
import sequelize from '../config/database.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

class OrcamentoService {
    // Gera próximo número sequencial dentro da empresa (ou global se não tiver empresa)
    async proximoNumero(currentUser) {
        const where = {};
        aplicarEmpresaScope(where, currentUser);
        const total = await Orcamento.count({ where });
        return String(total + 1).padStart(4, '0');
    }

    async create(data, currentUser) {
        const t = await sequelize.transaction();
        try {
            const numero = data.numero || await this.proximoNumero(currentUser);

            const orcamento = await Orcamento.create({
                numero,
                cliente_id: data.cliente_id ?? null,
                funcionario_id: data.funcionario_id ?? currentUser?.id ?? null,
                empresa_id: empresaParaGravar(currentUser),
                nome_cliente: data.nome_cliente,
                complemento: data.complemento ?? null,
                funcionario_nome: data.funcionario_nome ?? null,
                data_orcamento: data.data_orcamento ?? new Date(),
                validade_orcamento: data.validade_orcamento ?? null,
                desconto: data.desconto ?? 0,
                desconto_valor: data.desconto_valor ?? 0,
                tipo_desconto: data.tipo_desconto ?? 'percent',
                observacoes: data.observacoes ?? null,
                valor_total: data.valor_total ?? 0
            }, { transaction: t });

            for (const item of (data.itens ?? [])) {
                await OrcamentoItem.create({
                    orcamento_id: orcamento.id,
                    produto_id: item.produto_id ?? null,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    preco: item.preco
                }, { transaction: t });
            }

            await t.commit();
            return await this.getById(orcamento.id, currentUser);
        } catch (error) {
            await t.rollback();
            throw new Error(`Erro ao criar orçamento: ${error.message}`);
        }
    }

    async update(id, data, currentUser) {
        const t = await sequelize.transaction();
        try {
            const where = { id };
            if (currentUser?.empresa_id && currentUser.tipo !== 'MASTER') {
                where.empresa_id = currentUser.empresa_id;
            }
            const orcamento = await Orcamento.findOne({ where, transaction: t });
            if (!orcamento) throw new Error('Orçamento não encontrado');

            await orcamento.update({
                cliente_id: data.cliente_id ?? orcamento.cliente_id,
                nome_cliente: data.nome_cliente ?? orcamento.nome_cliente,
                complemento: data.complemento ?? orcamento.complemento,
                funcionario_nome: data.funcionario_nome ?? orcamento.funcionario_nome,
                data_orcamento: data.data_orcamento ?? orcamento.data_orcamento,
                validade_orcamento: data.validade_orcamento ?? orcamento.validade_orcamento,
                desconto: data.desconto ?? orcamento.desconto,
                desconto_valor: data.desconto_valor ?? orcamento.desconto_valor,
                tipo_desconto: data.tipo_desconto ?? orcamento.tipo_desconto,
                observacoes: data.observacoes ?? orcamento.observacoes,
                valor_total: data.valor_total ?? orcamento.valor_total,
                status: data.status ?? orcamento.status
            }, { transaction: t });

            // Se mandou itens novos, substitui todos
            if (Array.isArray(data.itens)) {
                await OrcamentoItem.destroy({ where: { orcamento_id: id }, transaction: t });
                for (const item of data.itens) {
                    await OrcamentoItem.create({
                        orcamento_id: id,
                        produto_id: item.produto_id ?? null,
                        nome: item.nome,
                        quantidade: item.quantidade,
                        preco: item.preco
                    }, { transaction: t });
                }
            }

            await t.commit();
            return await this.getById(id, currentUser);
        } catch (error) {
            await t.rollback();
            throw new Error(`Erro ao atualizar orçamento: ${error.message}`);
        }
    }

    async getAll(filters = {}, currentUser) {
        const where = {};
        if (filters.cliente_id) where.cliente_id = filters.cliente_id;
        if (filters.nome_cliente) where.nome_cliente = { [Op.iLike]: `%${filters.nome_cliente}%` };
        if (filters.dataInicio || filters.dataFim) {
            where.data_orcamento = {};
            if (filters.dataInicio) where.data_orcamento[Op.gte] = new Date(filters.dataInicio);
            if (filters.dataFim) where.data_orcamento[Op.lte] = new Date(filters.dataFim);
        }
        aplicarEmpresaScope(where, currentUser);

        return await Orcamento.findAll({
            where,
            include: [{ model: OrcamentoItem, as: 'itens' }],
            order: [['data_orcamento', 'DESC']]
        });
    }

    async getById(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const orcamento = await Orcamento.findOne({
            where,
            include: [{ model: OrcamentoItem, as: 'itens' }]
        });
        if (!orcamento) throw new Error('Orçamento não encontrado');
        return orcamento;
    }

    async delete(id, currentUser) {
        const t = await sequelize.transaction();
        try {
            const where = { id };
            if (currentUser?.empresa_id && currentUser.tipo !== 'MASTER') {
                where.empresa_id = currentUser.empresa_id;
            }
            const orcamento = await Orcamento.findOne({ where, transaction: t });
            if (!orcamento) throw new Error('Orçamento não encontrado');

            await OrcamentoItem.destroy({ where: { orcamento_id: id }, transaction: t });
            await Orcamento.destroy({ where: { id }, transaction: t });

            await t.commit();
            return true;
        } catch (error) {
            await t.rollback();
            throw new Error(`Erro ao deletar orçamento: ${error.message}`);
        }
    }
}

export default new OrcamentoService();
