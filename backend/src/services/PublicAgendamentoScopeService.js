import Empresa from '../models/Empresa.js';
import AgendamentoUnidade from '../models/AgendamentoUnidade.js';

const DOM_FERRAZ_COMPANIES = Object.freeze({
    manaira: 'Dom Ferraz - Manaíra',
    miramar: 'Dom Ferraz - Miramar',
    sape: 'Dom Ferraz - Sapé',
});

const normalizeKey = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const normalizeCompanyName = (value) => normalizeKey(value);

export const selecionarUnidadePublica = (unidades = []) => [...unidades]
    .filter((unidade) => unidade?.ativa !== false)
    .sort((a, b) => {
        const principal = Number(Boolean(b?.principal)) - Number(Boolean(a?.principal));
        if (principal !== 0) return principal;
        return Number(a?.id ?? 0) - Number(b?.id ?? 0);
    })[0] ?? null;

export class PublicAgendamentoScopeError extends Error {
    constructor(message, status = 404) {
        super(message);
        this.name = 'PublicAgendamentoScopeError';
        this.status = status;
    }
}

/**
 * Resolve o card público para uma empresa real sem aceitar empresa_id do cliente.
 * Os três nomes são tenants distintos no Lucro+, embora compartilhem a marca.
 */
export async function resolveDomFerrazScope(slug) {
    const key = normalizeKey(slug);
    const expectedName = DOM_FERRAZ_COMPANIES[key];

    if (!expectedName) {
        throw new PublicAgendamentoScopeError('Unidade de agendamento não encontrada.');
    }

    const companies = await Empresa.findAll({
        attributes: ['id', 'nome', 'arquivada_em'],
        where: { arquivada_em: null },
    });
    const matches = companies.filter((company) =>
        normalizeCompanyName(company.nome) === normalizeCompanyName(expectedName)
    );

    if (matches.length === 0) {
        throw new PublicAgendamentoScopeError('Esta unidade ainda não está configurada para agendamentos.');
    }
    if (matches.length > 1) {
        throw new PublicAgendamentoScopeError('A unidade de agendamento está configurada de forma ambígua.', 409);
    }

    const empresaId = Number(matches[0].id);
    const unidades = await AgendamentoUnidade.findAll({
        attributes: ['id', 'ativa', 'principal'],
        where: { empresa_id: empresaId, ativa: true },
    });
    const unidade = selecionarUnidadePublica(unidades);
    return {
        slug: key,
        empresaId,
        // Cada Dom Ferraz é um tenant próprio, mas o catálogo público continua
        // sendo controlado pela unidade principal. Sem este escopo, a landing
        // recebia todos os serviços ativos da empresa, inclusive os não
        // publicados nessa unidade.
        unidadeId: unidade ? Number(unidade.id) : null,
        empresaNome: matches[0].nome,
        // Contexto interno confiável; nunca vem do body ou query string do visitante.
        user: {
            id: null,
            tipo: 'PUBLIC_BOOKING',
            empresa_id: empresaId,
            empresa_id_override: null,
            permissoes: [],
        },
    };
}

const SKY_BARBEARIA_UNITS = Object.freeze({
    principal: 'principal',
    sky: 'principal',
    suzane: 'suzane',
});

/**
 * Sky Barbearia é um único tenant com dois fluxos públicos. A unidade é
 * resolvida pelo slug no servidor para impedir que o visitante troque o
 * destino do agendamento pelo body/query string.
 */
export async function resolveSkyBarbeariaScope(slug) {
    const unidadeKey = normalizeKey(slug || 'principal');
    const alvo = SKY_BARBEARIA_UNITS[unidadeKey];
    if (!alvo) throw new PublicAgendamentoScopeError('Unidade de agendamento não encontrada.');

    const companies = await Empresa.findAll({
        attributes: ['id', 'nome', 'arquivada_em'],
        where: { arquivada_em: null },
    });
    const matches = companies.filter((company) => normalizeCompanyName(company.nome) === normalizeCompanyName('Sky Barbearia'));
    if (matches.length === 0) throw new PublicAgendamentoScopeError('Esta unidade ainda não está configurada para agendamentos.');
    if (matches.length > 1) throw new PublicAgendamentoScopeError('A empresa da agenda está configurada de forma ambígua.', 409);

    const empresaId = Number(matches[0].id);
    const unidades = await AgendamentoUnidade.findAll({ where: { empresa_id: empresaId, ativa: true } });
    const unidade = alvo === 'suzane'
        ? unidades.find((item) => normalizeCompanyName(item.nome).includes('suzane'))
        : unidades.find((item) => item.principal) || unidades[0];
    if (!unidade) throw new PublicAgendamentoScopeError('A unidade da agenda ainda não está configurada.');

    return {
        slug: unidadeKey,
        empresaId,
        unidadeId: Number(unidade.id),
        empresaNome: matches[0].nome,
        unidadeNome: unidade.nome,
        user: {
            id: null,
            tipo: 'PUBLIC_BOOKING',
            empresa_id: empresaId,
            empresa_id_override: null,
            permissoes: [],
        },
    };
}

export default { resolveDomFerrazScope, resolveSkyBarbeariaScope };
