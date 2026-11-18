type VariacaoQuantidadeRoupa = {
    quantidade_atual?: number | string | null;
    estoque_infinito?: boolean | null;
};

export const limitesQuantidadeRoupa = (variacao?: VariacaoQuantidadeRoupa | null) => {
    if (!variacao) return { min: 0, max: 0, disabled: true };
    if (variacao.estoque_infinito) return { min: 1, max: undefined, disabled: false };
    const estoque = Math.max(0, Number(variacao.quantidade_atual ?? 0));
    if (estoque === 0) return { min: 0, max: 0, disabled: true };
    return { min: 1, max: estoque, disabled: false };
};
