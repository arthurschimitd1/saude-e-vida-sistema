export function instanteHistorico(value: unknown): number {
    if (!value) return 0;
    const time = new Date(value as string).getTime();
    return Number.isFinite(time) ? time : 0;
}

/** Desempate explícito, independente da ordem recebida da API ou do navegador. */
export function compararHistorico(a: any, b: any): number {
    return (b.dataOrdem - a.dataOrdem)
        || (instanteHistorico(b.criadoEm) - instanteHistorico(a.criadoEm))
        || (Number(b.id ?? 0) - Number(a.id ?? 0))
        || (String(a._kind) < String(b._kind) ? -1 : String(a._kind) > String(b._kind) ? 1 : 0);
}

export function prepararHistorico<T extends { _kind: 'venda' | 'saida'; criadoEm: string }>(items: T[]) {
    return items.map((item: any) => ({
        ...item,
        _uid: `${item._kind}-${item.id}`,
        dataOrdem: instanteHistorico(item._kind === 'venda' ? item.dataVenda ?? item.criadoEm : item.data ?? item.criadoEm),
        clienteNome: item._kind === 'venda' ? item.cliente?.nomeCompleto ?? 'Consumidor' : item.tipo ?? '',
        funcionarioNome: item._kind === 'venda' ? item.funcionario?.nome ?? '-' : '-',
        valorOrdem: Number(item._kind === 'venda' ? item.valorTotal ?? 0 : item.valor ?? 0),
    })).sort(compararHistorico) as (T & { _uid: string; dataOrdem: number; clienteNome: string; funcionarioNome: string; valorOrdem: number })[];
}

export function normalizarSaidasServidor(rows: any[]) {
    return rows.filter(s => s.natureza == null || s.natureza === 'SAIDA').map(s => ({
        _kind: 'saida' as const,
        id: Number(s.id),
        tipo: String(s.tipo ?? ''),
        descricao: String(s.descricao ?? ''),
        cliente: s.cliente ?? null,
        data: s.data ? new Date(s.data) : null,
        valor: Number(s.valor ?? 0),
        forma_pagamento: s.forma_pagamento ?? null,
        turno_id: s.turno_id == null ? null : Number(s.turno_id),
        criadoEm: s.createdAt ?? s.data,
    }));
}
