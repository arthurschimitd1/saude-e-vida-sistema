import axios from 'axios';
import { enriquecerComFirecrawl } from './FirecrawlService.js';

const SERPER_URL = 'https://google.serper.dev/places';
const API_KEY    = process.env.SERPER_API_KEY;

/** Normaliza resultado Serper → formato prospect */
function normalizar(place, defaultCity, defaultState) {
    return {
        company_name:    place.title ?? null,
        address:         place.address ?? null,
        city:            defaultCity ?? null,
        state:           defaultState ?? null,
        google_place_id: place.cid ?? place.placeId ?? null,
        google_rating:   place.rating ?? null,
        google_reviews:  place.ratingCount ?? 0,
        phone:           place.phoneNumber ?? null,
        website:         place.website ?? null,
        instagram:       null,
        email:           null,
    };
}

function extrairWhatsAppDoTexto(texto) {
    const m1 = texto.match(/wa\.me\/(?:\+?55)?(\d{10,11})/i);
    if (m1) return m1[1];

    const m2 = texto.match(/api\.whatsapp\.com\/send[^"'\s]*phone=(?:\+?55)?(\d{10,11})/i);
    if (m2) return m2[1];

    const m3 = texto.match(/web\.whatsapp\.com\/send[^"'\s]*phone=(?:\+?55)?(\d{10,11})/i);
    if (m3) return m3[1];

    // Número BR explícito: (DDD) + 9XXXX-XXXX
    const m4 = texto.match(/(?:\((\d{2})\)\s*|55(\d{2})\s*)9(\d{4})[\s.\-]?(\d{4})/);
    if (m4) {
        const ddd = m4[1] || m4[2];
        return `${ddd}9${m4[3]}${m4[4]}`;
    }

    // Qualquer sequência de 10-11 dígitos
    const nums = texto.match(/\d[\d\s.\-()\-]{8,14}\d/g);
    if (nums) {
        for (const n of nums) {
            const limpo = n.replace(/\D/g, '');
            if (limpo.length >= 10 && limpo.length <= 11) return limpo;
        }
    }

    return null;
}

async function buscarRedesSociais(nomeEmpresa, cidade, estado) {
    const local = `${cidade}${estado ? ' ' + estado : ''}`;
    const headers = { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' };
    const SEARCH_URL = 'https://google.serper.dev/search';

    try {
        const [resIG, resFB, resWA] = await Promise.all([
            axios.post(SEARCH_URL, { q: `"${nomeEmpresa}" ${local} site:instagram.com`, gl: 'br', hl: 'pt-br', num: 3 }, { headers, timeout: 10000 }),
            axios.post(SEARCH_URL, { q: `"${nomeEmpresa}" ${local} site:facebook.com`, gl: 'br', hl: 'pt-br', num: 3 }, { headers, timeout: 10000 }),
            axios.post(SEARCH_URL, { q: `"${nomeEmpresa}" ${local} whatsapp contato telefone`, gl: 'br', hl: 'pt-br', num: 5 }, { headers, timeout: 10000 }),
        ]);

        // Instagram
        const igLink = resIG.data?.organic?.[0]?.link ?? '';
        const igMatch = igLink.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        const instagram = igMatch ? `@${igMatch[1]}` : null;

        // Facebook
        let facebook = null;
        for (const r of (resFB.data?.organic ?? [])) {
            const match = r.link?.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
            if (match && !['sharer', 'share', 'login', 'profile.php', 'pages', 'watch'].includes(match[1])) {
                facebook = r.link;
                break;
            }
        }

        // WhatsApp — tenta extrair de snippet, link e sitelinks
        let whatsapp = null;
        for (const r of (resWA.data?.organic ?? [])) {
            const partes = [r.snippet ?? '', r.link ?? ''];
            for (const sl of (r.sitelinks ?? [])) {
                partes.push(sl.snippet ?? '', sl.link ?? '');
            }
            const texto = partes.join(' ');
            whatsapp = extrairWhatsAppDoTexto(texto);
            if (whatsapp) break;
        }

        return { instagram, facebook, whatsapp };
    } catch {
        return {};
    }
}

async function processarEmLotes(empresas, city, state, tamLote = 3) {
    const resultado = [];
    for (let i = 0; i < empresas.length; i += tamLote) {
        const lote = empresas.slice(i, i + tamLote);
        const loteResultado = await Promise.all(
            lote.map(async (emp) => {
                const { instagram, facebook, whatsapp } = await buscarRedesSociais(emp.company_name, city, state);

                let phoneFound = emp.phone ?? whatsapp ?? null;

                let emailFound = emp.email ?? null;
                let igFound = instagram ?? emp.instagram ?? null;
                let landlineFound = null;

                let linkedinFound = null;
                let youtubeFound  = null;
                let tiktokFound   = null;

                // Firecrawl só quando tem site e ainda falta algum dado relevante
                if (emp.website && (!phoneFound || !emailFound || !igFound)) {
                    try {
                        const fc = await enriquecerComFirecrawl(emp.website);
                        if (!phoneFound    && fc.whatsapp)  phoneFound    = fc.whatsapp;
                        if (!landlineFound && fc.telefone)  landlineFound = fc.telefone;
                        if (!emailFound    && fc.email)     emailFound    = fc.email;
                        if (!igFound       && fc.instagram) igFound       = fc.instagram;
                        if (fc.linkedin) linkedinFound = fc.linkedin;
                        if (fc.youtube)  youtubeFound  = fc.youtube;
                        if (fc.tiktok)   tiktokFound   = fc.tiktok;
                    } catch { /* ignora */ }
                }

                return {
                    ...emp,
                    instagram: igFound,
                    linkedin:  linkedinFound,
                    youtube:   youtubeFound,
                    tiktok:    tiktokFound,
                    website:   emp.website ?? facebook ?? null,
                    phone:     phoneFound,
                    landline:  landlineFound,
                    email:     emailFound,
                };
            })
        );
        resultado.push(...loteResultado);
        // pequena pausa entre lotes para evitar rate limit
        if (i + tamLote < empresas.length) await new Promise(r => setTimeout(r, 500));
    }
    return resultado;
}

/**
 * Busca empresas via Serper (Google Places).
 * Mantém a mesma interface de GooglePlacesService.
 */
export async function buscarEmpresas({ segment, city, state, radius = 8000, limit = 30 }) {
    const query = `${segment} em ${city}${state ? ` ${state}` : ''}`;
    const requestedLimit = Math.max(10, Math.min(Number(limit) || 30, 50));
    const maxPages = Math.ceil(requestedLimit / 10);
    const places = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages && places.length < requestedLimit; page += 1) {
        const { data } = await axios.post(
            SERPER_URL,
            { q: query, gl: 'br', hl: 'pt-br', page },
            {
                headers: {
                    'X-API-KEY': API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        const pagePlaces = Array.isArray(data?.places) ? data.places : [];
        let newItems = 0;
        for (const place of pagePlaces) {
            const key = String(place.placeId || place.cid || `${place.title}|${place.address}`).toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            places.push(place);
            newItems += 1;
        }
        if (!pagePlaces.length || newItems === 0) break;
    }

    const empresas = places
        .slice(0, requestedLimit)
        .map(p => normalizar(p, city, state))
        .filter(e => e.company_name);

    const automaticEnrichmentLimit = Math.min(empresas.length, 10);
    const empresasEnriquecidas = [
        ...(await processarEmLotes(empresas.slice(0, automaticEnrichmentLimit), city, state, 5)),
        ...empresas.slice(automaticEnrichmentLimit),
    ];

    return { empresas: empresasEnriquecidas, next_page_token: null };
}

/**
 * Serper não oferece endpoint de detalhes por ID,
 * então retorna null para manter compatibilidade.
 */
export async function buscarDetalhes(_placeId) {
    return null;
}
