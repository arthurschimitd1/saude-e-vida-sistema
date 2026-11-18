export interface ReferenciaVariacaoRoupa {
    roupaId?: number;
    variacaoId?: number;
    codigoEstavel?: string;
}

interface IdentidadeEstavelVariacao {
    codigo?: unknown;
    tamanho?: unknown;
    cor?: unknown;
}

const inteiroPositivo = (valor: unknown) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const normalizarParteIdentidade = (valor: unknown) => String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');

const criarCodigoEstavel = ({ codigo, tamanho, cor }: IdentidadeEstavelVariacao) => {
    const codigoProduto = normalizarParteIdentidade(codigo);
    if (!codigoProduto) return null;
    const chave = `${codigoProduto}|${normalizarParteIdentidade(tamanho)}|${normalizarParteIdentidade(cor)}`;
    let hash = 1469598103934665603n;
    for (const caractere of chave) {
        hash ^= BigInt(caractere.codePointAt(0) ?? 0);
        hash = BigInt.asUintN(64, hash * 1099511628211n);
    }
    return `95${String(hash % 10000000000n).padStart(10, '0')}`;
};

// Mantém o vínculo exato com roupa/variação usando somente números sempre que
// possível. O Code 128 consegue compactar pares numéricos, produzindo menos
// barras e módulos mais largos nas etiquetas térmicas de 33 mm.
export function criarCodigoEtiquetaRoupa(
    roupaIdValor: unknown,
    variacaoIdValor: unknown,
    identidadeEstavel?: IdentidadeEstavelVariacao,
): string {
    const codigoEstavel = identidadeEstavel ? criarCodigoEstavel(identidadeEstavel) : null;
    if (codigoEstavel) return codigoEstavel;
    const roupaId = inteiroPositivo(roupaIdValor);
    const variacaoId = inteiroPositivo(variacaoIdValor);
    if (!roupaId || !variacaoId) return `R${roupaIdValor}V${variacaoIdValor}`;
    // O id da variação é chave primária global e já identifica também a roupa.
    // Seis dígitos geram um Code 128 C muito menos denso que roupa + variação.
    if (variacaoId <= 99999) {
        return `9${String(variacaoId).padStart(5, '0')}`;
    }
    if (variacaoId <= 999999) {
        return `96${String(variacaoId).padStart(6, '0')}`;
    }
    return `R${roupaId}V${variacaoId}`;
}

export function lerCodigoEtiquetaRoupa(valor: string): ReferenciaVariacaoRoupa | null {
    const codigo = String(valor || '').trim();
    const estavel = codigo.match(/^95\d{10}$/);
    if (estavel) return { codigoEstavel: codigo };

    const variacaoCurta5 = codigo.match(/^9(\d{5})$/);
    if (variacaoCurta5) return { variacaoId: Number(variacaoCurta5[1]) };

    const variacaoCurta6 = codigo.match(/^96(\d{6})$/);
    if (variacaoCurta6) return { variacaoId: Number(variacaoCurta6[1]) };

    const compacto4 = codigo.match(/^97(\d{4})(\d{4})$/);
    if (compacto4) return { roupaId: Number(compacto4[1]), variacaoId: Number(compacto4[2]) };

    const compacto5 = codigo.match(/^98(\d{5})(\d{5})$/);
    if (compacto5) return { roupaId: Number(compacto5[1]), variacaoId: Number(compacto5[2]) };

    // Compatibilidade com etiquetas já impressas antes da compactação.
    const legado = codigo.match(/^r(\d+)v(\d+)$/i);
    if (legado) return { roupaId: Number(legado[1]), variacaoId: Number(legado[2]) };
    return null;
}
