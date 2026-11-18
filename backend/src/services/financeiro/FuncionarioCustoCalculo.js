// Mesma fórmula usada no cadastro de funcionários (frontend/app/(main)/uikit/table/page.tsx)
function calcularTotalBeneficios(beneficios) {
    const b = beneficios || {};
    return (b.valeTransporteValor || 0) +
        (b.valeRefeicaoValor || 0) +
        (b.planoSaudeValor || 0) +
        (b.planoOdontologicoValor || 0) +
        (b.outrosValor || 0);
}

function calcularCustoMensalCLT(salarioBruto, nivelRisco, beneficios) {
    const inssPatronal = salarioBruto * 0.20;
    const rat = salarioBruto * ((nivelRisco || 1) / 100);
    const terceiros = salarioBruto * 0.058;
    const fgts = salarioBruto * 0.08;
    const decimoTerceiro = salarioBruto * (1 / 12);
    const ferias = salarioBruto * (1 / 12 + 1 / 36);
    const totalBeneficios = calcularTotalBeneficios(beneficios);

    return salarioBruto + inssPatronal + rat + terceiros + fgts + decimoTerceiro + ferias + totalBeneficios;
}

/**
 * Retorna o custo mensal de um funcionário. Prioriza o valor já calculado e
 * persistido em `custos.custoTotalMensal` (preenchido no cadastro/edição);
 * recalcula via fórmula CLT apenas como fallback para registros legados sem esse campo.
 */
export function obterCustoMensal(funcionario) {
    const custoSalvo = Number(funcionario.custos?.custoTotalMensal);
    if (custoSalvo > 0) return custoSalvo;

    const salarioBruto = Number(funcionario.salarioBruto) || 0;
    if (funcionario.tipoContrato !== 'CLT') {
        return salarioBruto + calcularTotalBeneficios(funcionario.beneficios);
    }
    return calcularCustoMensalCLT(salarioBruto, funcionario.nivelRisco, funcionario.beneficios);
}
