type ContaLogada = { id?: number | string; email?: string } | null;
type IdentidadeFuncionario = { id: number; email?: string };

/** O ID da conta tem precedência; e-mail só é usado em sessões legadas sem ID. */
export function encontrarFuncionarioLogado<T extends IdentidadeFuncionario>(funcionarios: T[], usuario: ContaLogada): T | null {
    if (!usuario) return null;
    if (usuario.id != null) return funcionarios.find(f => Number(f.id) === Number(usuario.id)) ?? null;
    const email = usuario.email?.trim().toLowerCase();
    return email ? funcionarios.find(f => f.email?.trim().toLowerCase() === email) ?? null : null;
}

export function normalizarFuncionariosCaixa(listas: any[][]) {
    const unicos = new Map<number, any>();
    for (const lista of listas) {
        for (const u of lista) {
            const id = Number(u?.id);
            if (!Number.isInteger(id) || id <= 0 || u.tipo === 'MASTER') continue;
            // A lista operacional vem primeiro e tem os dados atuais de comissão.
            // O histórico apenas complementa IDs ausentes; não sobrescreve cadastros.
            if (!unicos.has(id)) unicos.set(id, u);
        }
    }
    return Array.from(unicos.entries())
        .map(([id, u]) => ({
            id,
            nome: String(u.nomeCompleto ?? ''),
            email: String(u.email ?? ''),
            comissao_tipo: u.comissao_tipo ?? null,
            comissao_valor: u.comissao_valor != null ? Number(u.comissao_valor) : null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function precisaAutenticarFuncionario(podePularSenha: boolean, funcionarioId: number, autenticadoId: number | null) {
    return !podePularSenha && funcionarioId !== autenticadoId;
}
