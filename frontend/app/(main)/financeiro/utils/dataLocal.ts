/**
 * Datas de lançamento são civis (sem horário). Não use new Date('YYYY-MM-DD')
 * diretamente no navegador: o JavaScript interpreta esse formato em UTC e,
 * em fusos negativos, exibe o dia anterior.
 */
export const parseDataCivil = (value: string | Date | null | undefined): Date => {
    if (value instanceof Date) return value;
    const texto = String(value ?? '');
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(texto);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatarDataCivil = (value: string | Date | null | undefined): string => {
    const data = parseDataCivil(value);
    return data.toLocaleDateString('pt-BR');
};

export const dataCivilISO = (data: Date = new Date()): string => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};

/** Envia o dia ao backend ao meio-dia UTC para preservar o dia no Brasil. */
export const formatarDataParaApi = (data: Date): string => {
    return `${dataCivilISO(data)}T12:00:00.000Z`;
};
