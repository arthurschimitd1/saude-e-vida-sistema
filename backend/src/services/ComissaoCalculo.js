const dinheiro = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

/**
 * Separa produtos e serviços sem alterar o total histórico da venda.
 * O desconto reduz primeiro os produtos e, se excedê-los, os serviços.
 */
export function calcularComissoesVenda({ itens = [], desconto = 0, totalVenda = null, tipo, valor }) {
    if (!tipo || Number(valor) <= 0) return [];

    const produtos = itens.filter(item => item.tipo !== 'servico');
    const servicos = itens.filter(item => item.tipo === 'servico');
    const totalProdutos = dinheiro(produtos.reduce((soma, item) => soma + Number(item.valor_total || 0), 0));
    const totalServicos = dinheiro(servicos.reduce((soma, item) => soma + Number(item.valor_total || 0), 0));
    const totalItens = dinheiro(totalProdutos + totalServicos);
    const descontoTotal = totalVenda == null
        ? Math.min(totalItens, Math.max(0, dinheiro(desconto)))
        : dinheiro(totalItens - Math.min(totalItens, Math.max(0, dinheiro(totalVenda))));
    const descontoProdutos = Math.min(totalProdutos, descontoTotal);
    const descontoServicos = Math.min(totalServicos, Math.max(0, descontoTotal - descontoProdutos));

    if (tipo === 'valor') {
        const base = dinheiro(totalProdutos + totalServicos - descontoTotal);
        return base > 0 ? [{ origem: 'venda', base_calculo: base, valor: dinheiro(valor) }] : [];
    }

    const percentual = Number(valor);
    const resultado = [];
    const baseProdutos = dinheiro(totalProdutos - descontoProdutos);
    const baseServicos = dinheiro(totalServicos - descontoServicos);
    if (baseProdutos > 0) resultado.push({
        origem: 'venda_produtos',
        base_calculo: baseProdutos,
        valor: dinheiro(baseProdutos * percentual / 100),
        detalhes_calculo: { total_itens: totalProdutos, desconto_aplicado: descontoProdutos }
    });
    if (baseServicos > 0) resultado.push({
        origem: 'venda_servicos',
        base_calculo: baseServicos,
        valor: dinheiro(baseServicos * percentual / 100),
        detalhes_calculo: { total_itens: totalServicos, desconto_aplicado: descontoServicos }
    });
    return resultado;
}

export { dinheiro };
