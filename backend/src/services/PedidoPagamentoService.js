import { col, fn, Op } from 'sequelize';
import sequelize from '../config/database.js';
import Pedido from '../models/Pedido.js';
import PedidoPagamento from '../models/PedidoPagamento.js';
import { aplicarEmpresaScope } from '../utils/empresaScope.js';

const paraCentavos = (valor, campo = 'Valor') => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) throw new Error(`${campo} inválido`);

    const centavos = Math.round(numero * 100);
    if (Math.abs(numero * 100 - centavos) > 0.000001) {
        throw new Error(`${campo} deve possuir no máximo duas casas decimais`);
    }
    return centavos;
};

const deCentavos = (centavos) => Number((centavos / 100).toFixed(2));

const dataIsoValida = (valor) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};

const resumoDoPedido = (pedido, valorPago = 0) => {
    if (pedido.controle_financeiro_ativo !== true) {
        return {
            valor_pago: null,
            saldo_pendente: null,
            status_financeiro: null
        };
    }

    const totalCentavos = paraCentavos(pedido.valor_total ?? 0, 'Valor total');
    const pagoCentavos = Math.max(0, paraCentavos(valorPago ?? 0, 'Valor pago'));
    const saldoCentavos = Math.max(0, totalCentavos - pagoCentavos);

    let statusFinanceiro = 'nao_pago';
    if (saldoCentavos === 0) statusFinanceiro = 'quitado';
    else if (pagoCentavos > 0) statusFinanceiro = 'parcial';

    return {
        valor_pago: deCentavos(pagoCentavos),
        saldo_pendente: deCentavos(saldoCentavos),
        status_financeiro: statusFinanceiro
    };
};

const pedidoParaObjeto = (pedido) => (
    typeof pedido?.toJSON === 'function' ? pedido.toJSON() : { ...pedido }
);

class PedidoPagamentoService {
    async enriquecerPedidos(pedidos) {
        const objetos = pedidos.map(pedidoParaObjeto);
        const idsAtivos = objetos
            .filter(pedido => pedido.controle_financeiro_ativo === true)
            .map(pedido => pedido.id);

        const valoresPorPedido = new Map();
        if (idsAtivos.length) {
            const totais = await PedidoPagamento.findAll({
                attributes: [
                    'pedido_id',
                    [fn('SUM', col('valor')), 'valor_pago']
                ],
                where: { pedido_id: { [Op.in]: idsAtivos } },
                group: ['pedido_id'],
                raw: true
            });
            for (const total of totais) {
                valoresPorPedido.set(Number(total.pedido_id), Number(total.valor_pago) || 0);
            }
        }

        return objetos.map(pedido => ({
            ...pedido,
            ...resumoDoPedido(pedido, valoresPorPedido.get(Number(pedido.id)) ?? 0)
        }));
    }

    async enriquecerPedido(pedido) {
        const [enriquecido] = await this.enriquecerPedidos([pedido]);
        return enriquecido;
    }

    async obterValorPago(pedidoId, empresaId, transaction = null) {
        return Number(await PedidoPagamento.sum('valor', {
            where: {
                pedido_id: pedidoId,
                empresa_id: empresaId
            },
            transaction
        })) || 0;
    }

    async buscarPedido(pedidoId, currentUser, transaction = null, bloquear = false) {
        const id = Number(pedidoId);
        if (!Number.isInteger(id) || id <= 0) throw new Error('ID do pedido inválido');

        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const options = { where, transaction };
        if (bloquear && transaction) options.lock = transaction.LOCK.UPDATE;

        const pedido = await Pedido.findOne(options);
        if (!pedido) throw new Error('Pedido não encontrado');
        return pedido;
    }

    async listar(pedidoId, currentUser) {
        const pedido = await this.buscarPedido(pedidoId, currentUser);
        const pagamentos = await PedidoPagamento.findAll({
            where: {
                pedido_id: pedido.id,
                empresa_id: pedido.empresa_id
            },
            order: [['data_pagamento', 'DESC'], ['created_at', 'DESC']]
        });
        const pedidoComResumo = await this.enriquecerPedido(pedido);

        return {
            pedido_id: pedido.id,
            controle_financeiro_ativo: pedido.controle_financeiro_ativo === true,
            valor_total: Number(pedido.valor_total) || 0,
            valor_pago: pedidoComResumo.valor_pago,
            saldo_pendente: pedidoComResumo.saldo_pendente,
            status_financeiro: pedidoComResumo.status_financeiro,
            pagamentos
        };
    }

    async registrar(pedidoId, data, currentUser) {
        const dados = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        const valorCentavos = paraCentavos(dados.valor, 'Valor do pagamento');
        if (valorCentavos <= 0) throw new Error('Valor do pagamento deve ser maior que zero');

        const dataPagamento = dados.data_pagamento ?? new Date().toISOString().slice(0, 10);
        if (!dataIsoValida(dataPagamento)) {
            throw new Error('Data do pagamento inválida. Utilize o formato AAAA-MM-DD');
        }

        if (dados.observacao != null && typeof dados.observacao !== 'string') {
            throw new Error('Observação do pagamento inválida');
        }
        const observacao = dados.observacao?.trim() || null;

        const transaction = await sequelize.transaction();
        let pedido;
        let pagamento;
        try {
            pedido = await this.buscarPedido(pedidoId, currentUser, transaction, true);
            if (pedido.controle_financeiro_ativo !== true) {
                throw new Error('O controle financeiro não se aplica a este pedido antigo');
            }
            if (pedido.status === 'cancelado') {
                throw new Error('Não é possível registrar pagamento em um pedido cancelado');
            }

            const valorPago = await this.obterValorPago(pedido.id, pedido.empresa_id, transaction);

            const totalCentavos = paraCentavos(pedido.valor_total ?? 0, 'Valor total');
            const pagoCentavos = paraCentavos(valorPago, 'Valor pago');
            const saldoCentavos = Math.max(0, totalCentavos - pagoCentavos);

            if (saldoCentavos === 0) throw new Error('Este pedido já está quitado');
            if (valorCentavos > saldoCentavos) {
                throw new Error(`O pagamento não pode ultrapassar o saldo pendente de R$ ${deCentavos(saldoCentavos).toFixed(2)}`);
            }

            pagamento = await PedidoPagamento.create({
                pedido_id: pedido.id,
                empresa_id: pedido.empresa_id,
                valor: deCentavos(valorCentavos),
                data_pagamento: dataPagamento,
                observacao
            }, { transaction });

            await transaction.commit();
        } catch (error) {
            if (!transaction.finished) await transaction.rollback();
            throw error;
        }

        return {
            pagamento,
            resumo: await this.enriquecerPedido(pedido)
        };
    }
}

export default new PedidoPagamentoService();
