export function normalizarSaidasServidor(rows: unknown) {
    if (!Array.isArray(rows)) return [];

    return rows
        .filter((saida: any) => saida?.natureza == null || saida.natureza === 'SAIDA')
        .map((saida: any) => ({
            _kind: 'saida' as const,
            _uid: `saida-${saida.id}`,
            id: Number(saida.id),
            tipo: String(saida.tipo ?? ''),
            descricao: String(saida.descricao ?? ''),
            cliente: null,
            data: saida.data ? new Date(saida.data) : null,
            valor: Number(saida.valor ?? 0),
            criadoEm: saida.createdAt ?? saida.data,
        }))
        .filter(saida => Number.isInteger(saida.id) && saida.id > 0);
}
