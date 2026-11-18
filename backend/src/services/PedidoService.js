import { Op } from 'sequelize';
import Pedido from '../models/Pedido.js';
import Product from '../models/Product.js';
import RawMaterial from '../models/RawMaterial.js';
import Movimento from '../models/Movimento.js';
import Fornecedor from '../models/Fornecedor.js';
import sequelize from '../config/database.js';
import pedidoPagamentoService from './PedidoPagamentoService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

const numeroPositivo = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
};

class PedidoService {
    async getAll(filters = {}, currentUser) {
        const where = {};
        if (filters.status) where.status = filters.status;
        if (filters.fornecedor) where.fornecedor = { [Op.iLike]: `%${filters.fornecedor}%` };
        if (filters.fornecedor_id) {
            const fornecedorId = Number(filters.fornecedor_id);
            if (!Number.isInteger(fornecedorId) || fornecedorId <= 0) {
                throw new Error('ID do fornecedor inválido');
            }
            where.fornecedor_id = fornecedorId;
        }
        const somentePendentes = filters.somente_pendentes === true || filters.somente_pendentes === 'true';
        const statusFinanceiro = filters.status_financeiro;
        if (statusFinanceiro && !['nao_pago', 'parcial', 'quitado'].includes(statusFinanceiro)) {
            throw new Error('Status financeiro inválido');
        }
        if (somentePendentes || statusFinanceiro) {
            where.controle_financeiro_ativo = true;
        }
        if (somentePendentes) {
            where[Op.and] = [{ status: { [Op.ne]: 'cancelado' } }];
        }
        aplicarEmpresaScope(where, currentUser);

        const pedidos = await Pedido.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
        const pedidosComResumo = await pedidoPagamentoService.enriquecerPedidos(pedidos);

        return pedidosComResumo.filter(pedido => {
            if (somentePendentes && !(pedido.saldo_pendente > 0)) return false;
            if (statusFinanceiro && pedido.status_financeiro !== statusFinanceiro) return false;
            return true;
        });
    }

    async buscarModel(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const pedido = await Pedido.findOne({ where });
        if (!pedido) throw new Error('Pedido não encontrado');
        return pedido;
    }

    async getById(id, currentUser) {
        const pedido = await this.buscarModel(id, currentUser);
        return pedidoPagamentoService.enriquecerPedido(pedido);
    }

    async create(data, currentUser) {
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) throw new Error('Selecione uma empresa para criar o pedido');

        const fornecedorId = Number(data.fornecedor_id);
        if (!Number.isInteger(fornecedorId) || fornecedorId <= 0) {
            throw new Error('Fornecedor é obrigatório');
        }

        const fornecedor = await Fornecedor.findOne({
            where: { id: fornecedorId, empresa_id: empresaId }
        });
        if (!fornecedor) throw new Error('Fornecedor não encontrado para a empresa selecionada');

        if (!Array.isArray(data.itens) || data.itens.length === 0) {
            throw new Error('Adicione pelo menos um produto ao pedido');
        }

        const ids = [...new Set(data.itens.map(item => Number(item.produto_id)))];
        if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
            throw new Error('Produto inválido no pedido');
        }

        const produtos = await Product.findAll({
            where: {
                id: { [Op.in]: ids },
                empresa_id: empresaId,
                fornecedor_id: fornecedorId
            }
        });
        if (produtos.length !== ids.length) {
            throw new Error('Todos os produtos devem pertencer ao fornecedor selecionado');
        }

        const produtosPorId = new Map(produtos.map(produto => [Number(produto.id), produto]));
        const itens = data.itens.map(item => {
            const produto = produtosPorId.get(Number(item.produto_id));
            const quantidade = numeroPositivo(item.quantidade);
            const valorUnitario = Number(item.valor_unitario);
            if (!quantidade) throw new Error(`Quantidade inválida para o produto ${produto.name}`);
            if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
                throw new Error(`Valor unitário inválido para o produto ${produto.name}`);
            }

            return {
                produto_id: produto.id,
                produto: produto.name,
                codigo: produto.code ?? null,
                quantidade,
                valor_unitario: valorUnitario,
                unidade_medida: produto.unidade_medida ?? null,
                tipo: 'produto'
            };
        });

        const t = await sequelize.transaction();
        let pedido;
        try {
            // Gera número do pedido automaticamente
            const count = await Pedido.count({ where: { empresa_id: empresaId }, transaction: t });
            const numero = `PED-${String(count + 1).padStart(4, '0')}`;

            const valor_total = itens.reduce(
                (acc, item) => acc + (item.quantidade * item.valor_unitario),
                0
            );

            pedido = await Pedido.create({
                fornecedor_id: fornecedor.id,
                fornecedor: fornecedor.nomeCompleto,
                status: data.status ?? 'pendente',
                data_pedido: data.data_pedido,
                data_previsao: data.data_previsao ?? null,
                observacao: data.observacao ?? null,
                itens,
                numero,
                valor_total,
                controle_financeiro_ativo: true,
                empresa_id: empresaId
            }, { transaction: t });

            await t.commit();
        } catch (error) {
            if (!t.finished) await t.rollback();
            throw error;
        }

        return pedidoPagamentoService.enriquecerPedido(pedido);
    }

    async update(id, data, currentUser) {
        const pedido = await this.buscarModel(id, currentUser);
        const statusAnterior = pedido.status;
        // Salva os itens do BD ANTES do update, para dar entrada correta no estoque
        const itensBD = Array.isArray(pedido.itens) ? [...pedido.itens] : [];
        const dadosAtualizacao = { ...data };

        // Campos financeiros são controlados exclusivamente pelo backend.
        delete dadosAtualizacao.controle_financeiro_ativo;
        delete dadosAtualizacao.valor_pago;
        delete dadosAtualizacao.saldo_pendente;
        delete dadosAtualizacao.status_financeiro;
        delete dadosAtualizacao.valor_total;

        // Recalcula valor total se itens foram atualizados
        if (dadosAtualizacao.itens) {
            dadosAtualizacao.valor_total = dadosAtualizacao.itens.reduce(
                (acc, item) => acc + (item.quantidade * item.valor_unitario),
                0
            );
            if (pedido.controle_financeiro_ativo === true) {
                const valorPago = await pedidoPagamentoService.obterValorPago(pedido.id, pedido.empresa_id);
                if (Number(dadosAtualizacao.valor_total) < valorPago) {
                    throw new Error('O valor total do pedido não pode ficar abaixo do valor já pago');
                }
            }
        }

        await pedido.update(dadosAtualizacao);

        // Ao marcar como recebido, dá entrada no estoque de cada item
        if (dadosAtualizacao.status === 'recebido' && statusAnterior !== 'recebido') {
            for (const item of itensBD) {
                try {
                    const qtd = Number(item.quantidade) || 0;
                    if (qtd <= 0) continue;

                    // ── Item de Matéria-Prima: atualiza RawMaterial + Product espelho por nome ──
                    if (item.tipo === 'materia_prima') {
                        const mp = await RawMaterial.findByPk(item.produto_id).catch(() => null);
                        if (!mp) continue;
                        const novaQtd = (Number(mp.currentQuantity) || 0) + qtd;
                        await mp.update({ currentQuantity: novaQtd });
                        // Atualiza o espelho no Estoque (por raw_material_id se disponível, senão por nome)
                        let produtoEspelho = null;
                        const [updatedCount] = await Product.update(
                            { currentQuantity: novaQtd },
                            { where: { raw_material_id: mp.id } }
                        ).catch(() => [0]);
                        if (!updatedCount) {
                            await Product.update(
                                { currentQuantity: novaQtd },
                                { where: { name: mp.name, is_materia_prima: true, empresa_id: pedido.empresa_id } }
                            ).catch(() => {});
                        }
                        produtoEspelho = await Product.findOne({
                            where: { raw_material_id: mp.id }
                        }).catch(() => null) || await Product.findOne({
                            where: { name: mp.name, is_materia_prima: true, empresa_id: pedido.empresa_id }
                        }).catch(() => null);
                        if (produtoEspelho) {
                            await Movimento.create({
                                produto_id: produtoEspelho.id,
                                tipo: 'entrada',
                                quantidade: qtd,
                                motivo: `Recebimento do pedido ${pedido.numero}`,
                                origem_tipo: 'pedido',
                                origem_id: pedido.id,
                                empresa_id: pedido.empresa_id,
                                data: new Date()
                            }).catch(e => console.log('[PedidoService] Erro ao criar Movimento MP:', e.message));
                        }
                        continue;
                    }

                    // ── Item de Produto normal: atualiza Product ──
                    let produto = null;
                    if (item.produto_id) {
                        produto = await Product.findByPk(item.produto_id).catch(() => null);
                    }
                    if (!produto && item.produto) {
                        produto = await Product.findOne({
                            where: { name: item.produto, empresa_id: pedido.empresa_id, is_materia_prima: false }
                        }).catch(() => null);
                    }
                    if (!produto) continue;

                    const novaQtd = (Number(produto.currentQuantity) || 0) + qtd;
                    await produto.update({ currentQuantity: novaQtd });
                    if (produto.raw_material_id) {
                        await RawMaterial.update(
                            { currentQuantity: novaQtd },
                            { where: { id: produto.raw_material_id, empresa_id: pedido.empresa_id } }
                        );
                    }

                    await Movimento.create({
                        produto_id: produto.id,
                        tipo: 'entrada',
                        quantidade: qtd,
                        motivo: `Recebimento do pedido ${pedido.numero}`,
                        origem_tipo: 'pedido',
                        origem_id: pedido.id,
                        empresa_id: pedido.empresa_id,
                        data: new Date()
                    }).catch(e => console.log('[PedidoService] Erro ao criar Movimento:', e.message));
                } catch (e) {
                    console.log('[PedidoService] Erro ao processar item do pedido:', e.message);
                }
            }
        }

        return pedidoPagamentoService.enriquecerPedido(pedido);
    }

    async delete(id, currentUser) {
        const pedido = await this.buscarModel(id, currentUser);
        if (pedido.controle_financeiro_ativo === true) {
            const valorPago = await pedidoPagamentoService.obterValorPago(pedido.id, pedido.empresa_id);
            if (valorPago > 0) {
                throw new Error('Pedido com pagamentos registrados não pode ser excluído');
            }
        }
        await pedido.destroy();
        return true;
    }
}

export default new PedidoService();
