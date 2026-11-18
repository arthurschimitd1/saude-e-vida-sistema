import Venda from '../../models/Venda.js';
import VendaItem from '../../models/VendaItem.js';
import Product from '../../models/Product.js';
import Recorrencia from '../../models/Recorrencia.js';
import { Op } from 'sequelize';

// Portado de frontend/app/(main)/uikit/crm/page.tsx (calcRFM) para que o
// WhatsApp CRM (e futuramente a extensão) calculem RFM da mesma forma que a
// tela /uikit/crm já usa — uma única fonte de verdade, sem duplicar a matemática.
// A página /uikit/crm não foi alterada e continua calculando no frontend.

export const RFM_CONFIG_PADRAO = { ativo: 15, risco: 20, inativo: 30, perdido: 60 };

const estimarPagamentosRecorrencia = (r) => {
    const inicio = new Date(r.dataInicio).getTime();
    const fim = r.ultimoPagamento ? new Date(r.ultimoPagamento).getTime() : Date.now();
    if (isNaN(inicio)) return { qtd: 0, total: 0 };
    const diasDecorridos = Math.max(0, Math.floor((fim - inicio) / 86400000));
    const freq = r.tempoRecorrencia;
    const sub = r.subtipoRecorrencia;
    let diasPorCiclo = 30;
    if (freq === 'TRIMESTRAL') diasPorCiclo = 90;
    else if (freq === 'SEMESTRAL') diasPorCiclo = 180;
    else if (freq === 'ANUAL') diasPorCiclo = 365;
    else if (freq === 'PERSONALIZADO') {
        if (sub === 'SEMANAL') diasPorCiclo = 7;
        else if (sub === 'QUINZENAL') diasPorCiclo = 15;
        else if (sub === 'DIARIO') diasPorCiclo = 1;
    }
    const qtd = Math.max(1, Math.floor(diasDecorridos / diasPorCiclo) + 1);
    const total = qtd * Number(r.valorMes ?? 0);
    return { qtd, total };
};

export function calcularRfm(vendasCliente, recorrsCliente, config = RFM_CONFIG_PADRAO) {
    const hoje = Date.now();
    const temRecorrAtiva = recorrsCliente.some(r => r.ativo === true);

    const datasVendas = vendasCliente.map(v => new Date(v.data ?? v.createdAt).getTime());
    const datasRecorr = recorrsCliente
        .map(r => r.ultimoPagamento)
        .filter(Boolean)
        .map(d => new Date(d).getTime());
    const todasDatas = [...datasVendas, ...datasRecorr].filter(d => !isNaN(d)).sort((a, b) => a - b);

    if (todasDatas.length === 0 && !temRecorrAtiva) {
        return {
            ultimaCompra: null, diasSemComprar: null, totalCompras: 0, totalGasto: 0, ticketMedio: 0,
            frequenciaMedia: null, produtoFavorito: '-', scoreR: 1, scoreF: 1, scoreM: 1,
            classificacao: 'Sem compras', status: 'Sem compras', temRecorrAtiva: false,
        };
    }

    const ultimaCompra = todasDatas.length > 0 ? new Date(Math.max(...todasDatas)) : new Date();
    const diasSemComprar = Math.floor((hoje - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24));

    const totalVendas = vendasCliente.length;
    const gastoVendas = vendasCliente.reduce((s, v) => s + Number(v.valor_total ?? 0), 0);
    const { qtd: qtdRecorr, total: gastoRecorr } = recorrsCliente.reduce(
        (acc, r) => { const p = estimarPagamentosRecorrencia(r); return { qtd: acc.qtd + p.qtd, total: acc.total + p.total }; },
        { qtd: 0, total: 0 }
    );
    const totalCompras = totalVendas + qtdRecorr;
    const totalGasto = gastoVendas + gastoRecorr;
    const ticketMedio = totalCompras > 0 ? totalGasto / totalCompras : 0;

    let frequenciaMedia = null;
    if (todasDatas.length > 1) {
        const intervalos = todasDatas.slice(1).map((d, i) => (d - todasDatas[i]) / 86400000);
        frequenciaMedia = intervalos.reduce((s, v) => s + v, 0) / intervalos.length;
    }

    const contProdutos = {};
    vendasCliente.forEach(v => {
        (v.itens ?? []).forEach(it => {
            const nome = it.Product?.name ?? `#${it.produto_id}`;
            contProdutos[nome] = (contProdutos[nome] ?? 0) + Number(it.quantidade ?? 1);
        });
    });
    recorrsCliente.forEach(r => {
        const nome = r.produto ?? 'Recorrência';
        contProdutos[nome] = (contProdutos[nome] ?? 0) + 1;
    });
    const produtoFavorito = Object.entries(contProdutos).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

    const scoreR = diasSemComprar <= 7 ? 5 : diasSemComprar <= 15 ? 4 : diasSemComprar <= 30 ? 3 : diasSemComprar <= 60 ? 2 : 1;
    const scoreF = totalCompras >= 20 ? 5 : totalCompras >= 10 ? 4 : totalCompras >= 5 ? 3 : totalCompras >= 2 ? 2 : 1;
    const scoreM = ticketMedio >= 500 ? 5 : ticketMedio >= 200 ? 4 : ticketMedio >= 100 ? 3 : ticketMedio >= 50 ? 2 : 1;

    let classificacao;
    if (scoreR >= 4 && scoreF >= 4 && scoreM >= 4) classificacao = 'VIP';
    else if (scoreF >= 3 && scoreR >= 3) classificacao = 'Frequente';
    else if (totalCompras === 1 && diasSemComprar <= 30) classificacao = 'Novo';
    else if (temRecorrAtiva) classificacao = 'Ativo';
    else if (diasSemComprar > config.perdido) classificacao = 'Perdido';
    else if (diasSemComprar > config.inativo) classificacao = 'Inativo';
    else if (diasSemComprar > config.risco) classificacao = 'Em Risco';
    else classificacao = 'Ativo';

    let status;
    if (temRecorrAtiva && diasSemComprar <= config.perdido) status = 'Ativo';
    else if (diasSemComprar <= config.ativo) status = 'Ativo';
    else if (diasSemComprar <= config.risco) status = 'Em Risco';
    else if (diasSemComprar <= config.inativo) status = 'Inativo';
    else if (diasSemComprar <= config.perdido) status = 'Perdido';
    else status = 'Perdido';

    return { ultimaCompra, diasSemComprar, totalCompras, totalGasto, ticketMedio, frequenciaMedia, produtoFavorito, scoreR, scoreF, scoreM, classificacao, status, temRecorrAtiva };
}

export async function calcularRfmDoCliente(clienteId, empresaId, config = RFM_CONFIG_PADRAO) {
    const whereVenda = {
        cliente_id: clienteId,
        // Cancelamentos da loja permanecem no banco, mas não contam como
        // compra, faturamento, recência ou produto favorito no RFM.
        [Op.or]: [
            { status_loja: { [Op.is]: null } },
            { status_loja: { [Op.notIn]: ['cancelado', 'cancelada'] } },
        ],
    };
    const whereRecorr = { cliente_id: clienteId };
    if (empresaId) {
        whereVenda.empresa_id = empresaId;
        whereRecorr.empresa_id = empresaId;
    }

    const [vendasCliente, recorrsCliente] = await Promise.all([
        Venda.findAll({
            where: whereVenda,
            include: [{ model: VendaItem, as: 'itens', include: [{ model: Product }], required: false }],
        }),
        Recorrencia.findAll({ where: whereRecorr }),
    ]);

    return calcularRfm(
        vendasCliente.map(v => v.toJSON()),
        recorrsCliente.map(r => r.toJSON()),
        config
    );
}
