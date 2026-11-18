export const normalizarNomeServico = (nome) => String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const calcularRegraPadrao = (base, tipo, valor) => {
    if (!(base > 0) || !(Number(valor) > 0)) return 0;
    return tipo === 'percent' ? (base * Number(valor)) / 100 : Number(valor);
};

export const calcularComissaoVenda = ({ totalVenda, itens = [], funcionario, regras = [] }) => {
    const tipoPadrao = funcionario?.comissao_tipo;
    const valorPadrao = Number(funcionario?.comissao_valor ?? 0);
    const total = Number(totalVenda ?? 0);

    if (!regras.length) {
        return {
            valor: calcularRegraPadrao(total, tipoPadrao, valorPadrao),
            tipo: tipoPadrao,
            valorOrigem: valorPadrao,
            origem: 'colaborador',
            detalhes: null
        };
    }

    const regrasPorServico = new Map(regras.map(regra => [regra.servico_chave, Number(regra.percentual)]));
    const itensValidos = itens.map(item => ({
        nome: item.nome_item ?? item.nome_servico ?? '',
        chave: normalizarNomeServico(item.nome_item ?? item.nome_servico),
        valor: Math.max(0, Number(item.valor_total ?? (Number(item.valor_unitario) * Number(item.quantidade))) || 0)
    }));
    const somaItens = itensValidos.reduce((soma, item) => soma + item.valor, 0);
    if (!(somaItens > 0)) {
        return {
            valor: calcularRegraPadrao(total, tipoPadrao, valorPadrao),
            tipo: tipoPadrao,
            valorOrigem: valorPadrao,
            origem: 'colaborador',
            detalhes: null
        };
    }

    const fatorTotal = total > 0 ? total / somaItens : 0;
    let basePadrao = 0;
    let valorEspecial = 0;
    const detalhes = [];

    for (const item of itensValidos) {
        const base = item.valor * fatorTotal;
        const percentual = regrasPorServico.get(item.chave);
        if (percentual == null) {
            basePadrao += base;
            continue;
        }
        const valor = (base * percentual) / 100;
        valorEspecial += valor;
        detalhes.push({ servico: item.nome, percentual, base, valor });
    }

    if (!detalhes.length) {
        return {
            valor: calcularRegraPadrao(total, tipoPadrao, valorPadrao),
            tipo: tipoPadrao,
            valorOrigem: valorPadrao,
            origem: 'colaborador',
            detalhes: null
        };
    }

    const valorBase = calcularRegraPadrao(basePadrao, tipoPadrao, valorPadrao);
    return {
        valor: valorBase + valorEspecial,
        tipo: tipoPadrao || 'percent',
        valorOrigem: valorPadrao || null,
        origem: 'servico',
        detalhes: { base_padrao: basePadrao, valor_padrao: valorBase, servicos: detalhes }
    };
};
