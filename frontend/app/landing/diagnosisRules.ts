export type DiagnosisAnswers = {
    operation: 'one' | 'team' | 'complex';
    priority: 'operations' | 'management' | 'intelligence' | 'integrations';
    implementation: 'standard' | 'tailored';
};

export type DiagnosisRecommendation = {
    plan: 'plano1' | 'plano2' | 'personalizado';
    title: string;
    reason: string;
    target: string;
};

// A recomendação é uma orientação inicial; não substitui uma avaliação comercial.
export function recommendPlan(answers: DiagnosisAnswers): DiagnosisRecommendation {
    if (answers.operation === 'complex' || answers.priority === 'integrations' || answers.implementation === 'tailored') {
        return {
            plan: 'personalizado', title: 'Plano Sob Medida', target: 'plano-personalizado',
            reason: 'Sua operação pede integrações, múltiplas unidades ou uma implantação específica. Vale desenhar a solução com a equipe.',
        };
    }
    if (answers.priority === 'intelligence' || answers.priority === 'management') {
        return {
            plan: 'plano2', title: 'Plano Inteligência', target: 'plano2',
            reason: 'Você quer combinar a gestão do dia a dia com recursos como estratégia, equipe ou relacionamento com clientes.',
        };
    }
    return {
        plan: 'plano1', title: 'Plano Essencial', target: 'plano1',
        reason: 'Seu foco é organizar estoque, produção, pedidos e financeiro em uma operação com implantação padrão.',
    };
}
