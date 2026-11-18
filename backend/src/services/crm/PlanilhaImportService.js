/**
 * Lê planilhas (.xlsx, .xls, .csv) de prospects e normaliza para o formato do CrmProspect.
 * Aceita cabeçalhos em português com variações comuns (sem exigir nomenclatura exata).
 */
import * as XLSX from 'xlsx';

const MAX_LINHAS = 2000;

// Cada campo do model aceita múltiplos nomes de coluna possíveis (já normalizados: minúsculo, sem acento)
const ALIASES = {
    company_name:     ['empresa', 'nome da empresa', 'nome empresa', 'company_name', 'nome', 'razao social', 'fantasia', 'nome fantasia'],
    responsible_name: ['responsavel', 'nome do responsavel', 'contato', 'responsible_name'],
    phone:            ['telefone', 'fone', 'celular', 'whatsapp', 'phone', 'numero'],
    email:            ['email', 'e-mail', 'e mail'],
    instagram:        ['instagram', 'insta', '@instagram'],
    website:          ['site', 'website', 'url', 'pagina'],
    address:          ['endereco', 'address', 'rua'],
    city:             ['cidade', 'city', 'municipio'],
    state:            ['estado', 'uf', 'state'],
    observations:     ['observacoes', 'obs', 'observations', 'notas'],
};

function normalizarHeader(str) {
    return String(str ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function resolverMapaColunas(headers) {
    const normalizados = headers.map(h => ({ original: h, norm: normalizarHeader(h) }));
    const mapa = {};
    for (const [campo, aliases] of Object.entries(ALIASES)) {
        const encontrado = normalizados.find(h => aliases.includes(h.norm));
        if (encontrado) mapa[campo] = encontrado.original;
    }
    return mapa;
}

/**
 * Parseia o buffer da planilha e retorna { linhas, total, truncado }.
 * `linhas` já vem no formato de campos do CrmProspect (sem campaign_id/empresa_id).
 */
export function parsearPlanilha(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Planilha vazia ou inválida');

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    if (rows.length === 0) throw new Error('Nenhuma linha encontrada na planilha');

    const headers = Object.keys(rows[0]);
    const mapa = resolverMapaColunas(headers);

    if (!mapa.company_name) {
        throw new Error('Não foi possível identificar a coluna de nome da empresa. Use um cabeçalho como "Empresa" ou "Nome da Empresa".');
    }

    const truncado = rows.length > MAX_LINHAS;
    const linhasBrutas = rows.slice(0, MAX_LINHAS);

    const linhas = linhasBrutas
        .map(row => {
            const item = {};
            for (const [campo, coluna] of Object.entries(mapa)) {
                const valor = row[coluna];
                item[campo] = (valor === null || valor === undefined || valor === '') ? null : String(valor).trim();
            }
            return item;
        })
        .filter(item => item.company_name);

    return { linhas, total: rows.length, truncado };
}
