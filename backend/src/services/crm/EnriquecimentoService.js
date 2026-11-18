/**
 * Serviço de Enriquecimento de Dados
 *
 * Estrutura preparada para integrações futuras:
 *   - SerpAPI (busca Google por nome da empresa)
 *   - DataForSEO (análise de presença digital)
 *   - Apify (scraping de Instagram/LinkedIn)
 *   - Meta Graph API (dados do Facebook/Instagram)
 *
 * Cada provider é um módulo independente com a mesma interface:
 *   enrich(prospect): Promise<Partial<ProspectData>>
 */

async function enrichViaSerpApi(prospect) {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return {};
    // Estrutura preparada — implementar quando a chave estiver disponível
    return {};
}

async function enrichViaApify(prospect) {
    const token = process.env.APIFY_TOKEN;
    if (!token) return {};
    // Estrutura preparada — implementar quando o token estiver disponível
    return {};
}

async function enrichViaMetaGraph(prospect) {
    const token = process.env.META_GRAPH_TOKEN;
    if (!token) return {};
    // Estrutura preparada — implementar quando o token estiver disponível
    return {};
}

/**
 * Tenta enriquecer um prospect usando os providers configurados.
 * Retorna apenas os campos encontrados (merge responsabilidade do ProspectService).
 */
export async function enriquecerProspect(prospect) {
    const results = await Promise.allSettled([
        enrichViaSerpApi(prospect),
        enrichViaApify(prospect),
        enrichViaMetaGraph(prospect),
    ]);

    const merged = {};
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
            Object.assign(merged, r.value);
        }
    }
    return merged;
}

export const provedoresAtivos = () => ({
    serpapi:    !!process.env.SERPAPI_KEY,
    apify:      !!process.env.APIFY_TOKEN,
    meta_graph: !!process.env.META_GRAPH_TOKEN,
});
