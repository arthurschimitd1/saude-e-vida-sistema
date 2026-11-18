export function aplicarEmpresaScope(where, currentUser) {
    if (!currentUser) return;
    if (currentUser.tipo === 'MASTER') {
        if (currentUser.empresa_id_override) {
            where.empresa_id = currentUser.empresa_id_override;
        }
        return;
    }
    if (currentUser.empresa_id) {
        where.empresa_id = currentUser.empresa_id;
    }
}

export function empresaParaGravar(currentUser) {
    if (!currentUser) return null;
    if (currentUser.tipo === 'MASTER') {
        return currentUser.empresa_id_override ?? null;
    }
    return currentUser.empresa_id ?? null;
}
