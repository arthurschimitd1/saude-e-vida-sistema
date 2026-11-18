export const STATUS_PAGAMENTO_REALIZADO = ['PAGO', 'PAGO_ATRASADO'];

export function chaveMes(data) {
    const date = new Date(data);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monta a série histórica sem transformar valores previstos em recebimentos
 * repetidos. O custo de folha é uma projeção do mês atual e, por isso, só
 * entra no mês atual até existir um lançamento de pagamento próprio.
 */
export function montarSerieFinanceira({
    meses,
    vendasPorChave = {},
    manualEntradaPorChave = {},
    manualSaidaPorChave = {},
    recorrenciaEntradaPorChave = {},
    recorrenciaSaidaPorChave = {},
    comissoesPorChave = {},
    custoFolha = 0,
    mesAtual,
}) {
    const obterChaveMes = (mes) => mes.key || mes.chave;

    const serieEntradas = meses.map((mes) => (
        (vendasPorChave[obterChaveMes(mes)] || 0) +
        (manualEntradaPorChave[obterChaveMes(mes)] || 0) +
        (recorrenciaEntradaPorChave[obterChaveMes(mes)] || 0)
    ));

    const serieSaidas = meses.map((mes) => (
        (manualSaidaPorChave[obterChaveMes(mes)] || 0) +
        (recorrenciaSaidaPorChave[obterChaveMes(mes)] || 0) +
        (comissoesPorChave[obterChaveMes(mes)] || 0) +
        (obterChaveMes(mes) === mesAtual ? custoFolha : 0)
    ));

    return { serieEntradas, serieSaidas };
}
