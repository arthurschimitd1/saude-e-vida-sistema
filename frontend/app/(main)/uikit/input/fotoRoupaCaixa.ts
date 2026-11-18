interface FotoRoupa {
    foto_url?: string | null;
    ordem?: number;
    id?: number;
}

interface RoupaComFotos {
    foto_url?: string | null;
    variacoes?: Array<{ id?: number; fotos?: FotoRoupa[] }>;
}

const urlDeFoto = (valor: unknown): string | null => {
    if (typeof valor !== 'string' || !valor.trim()) return null;
    const url = valor.trim();
    return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : null;
};

// Usa somente fotos vinculadas à própria peça para não misturar produtos com nomes iguais.
export function obterFotoRoupaCaixa(roupa: RoupaComFotos): string | null {
    const fotoPrincipal = urlDeFoto(roupa.foto_url);
    if (fotoPrincipal) return fotoPrincipal;

    const variacoes = Array.isArray(roupa.variacoes) ? [...roupa.variacoes] : [];
    variacoes.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
    for (const variacao of variacoes) {
        const fotos = Array.isArray(variacao.fotos) ? [...variacao.fotos] : [];
        fotos.sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0) || Number(a.id ?? 0) - Number(b.id ?? 0));
        for (const foto of fotos) {
            const url = urlDeFoto(foto.foto_url);
            if (url) return url;
        }
    }
    return null;
}
