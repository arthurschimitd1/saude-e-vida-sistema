import axios from 'axios';

const API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE = 'https://api.firecrawl.dev/v1';

// ── Regex ────────────────────────────────────────────────────────────────────

const RX = {
    waMe:     /https?:\/\/wa\.me\/(?:\+?55)?(\d{10,11})/gi,
    waApi:    /https?:\/\/(?:api|web)\.whatsapp\.com\/send[^"'\s]*phone=(?:\+?55)?(\d{10,11})/gi,
    waSend:   /send\?phone=(?:\+?55)?(\d{10,11})/gi,
    celBR:    /(?:\+?55\s?)?(?:\((\d{2})\)|(\d{2}))\s*9\s*(\d{4})[\s.\-]?(\d{4})/g,
    telFixo:  /(?:\+?55\s?)?(?:\((\d{2})\)|(\d{2}))\s*([2-5]\d{3})[\s.\-]?(\d{4})/g,
    email:    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    instagram:/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi,
    facebook: /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.]+)\/?/gi,
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_\-]+)\/?/gi,
    youtube:  /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)([a-zA-Z0-9_\-]+)\/?/gi,
    tiktok:   /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)\/?/gi,
};

// Palavras-chave para priorizar páginas de contato
const PRIORIDADE_ALTA = ['contato', 'contact', 'fale-conosco', 'fale_conosco', 'atendimento', 'unidades', 'localizacao', 'localização', 'reservas', 'agendamento', 'orcamento', 'orçamento'];
const PRIORIDADE_MEDIA = ['sobre', 'quem-somos', 'about', 'quem_somos', 'loja', 'lojas', 'privacidade', 'privacy'];
const IGNORAR = ['blog', 'noticias', 'notícias', 'news', 'post', 'categoria', 'tag', 'carrinho', 'cart', 'checkout', 'login', 'cadastro', 'registro', 'produto', 'product'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizarURL(website) {
    if (!website) return null;
    try {
        const url = website.startsWith('http') ? website : `https://${website}`;
        return new URL(url).href.replace(/\/$/, '');
    } catch {
        return null;
    }
}

function prioridadePagina(url) {
    const u = url.toLowerCase();
    if (IGNORAR.some(p => u.includes(p))) return -1;
    if (PRIORIDADE_ALTA.some(p => u.includes(p))) return 2;
    if (PRIORIDADE_MEDIA.some(p => u.includes(p))) return 1;
    return 0;
}

function extrairWA(texto) {
    // 1. wa.me
    let m = RX.waMe.exec(texto);
    RX.waMe.lastIndex = 0;
    if (m) return { numero: m[1], confianca: 'alta' };

    // 2. api/web.whatsapp.com
    m = RX.waApi.exec(texto);
    RX.waApi.lastIndex = 0;
    if (m) return { numero: m[1], confianca: 'alta' };

    // 3. send?phone=
    m = RX.waSend.exec(texto);
    RX.waSend.lastIndex = 0;
    if (m) return { numero: m[1], confianca: 'alta' };

    // 4. celular BR com 9 dígitos
    m = RX.celBR.exec(texto);
    RX.celBR.lastIndex = 0;
    if (m) {
        const ddd = m[1] || m[2];
        const num = `${ddd}9${m[3]}${m[4]}`;
        return { numero: num, confianca: 'media' };
    }

    return null;
}

function extrairTelFixo(texto) {
    const m = RX.telFixo.exec(texto);
    RX.telFixo.lastIndex = 0;
    if (!m) return null;
    const ddd = m[1] || m[2];
    return `${ddd}${m[3]}${m[4]}`;
}

function extrairEmail(texto) {
    const m = RX.email.exec(texto);
    RX.email.lastIndex = 0;
    if (!m) return null;
    const e = m[0].toLowerCase();
    // Ignora emails genéricos de imagens/CDN
    if (e.includes('.png') || e.includes('.jpg') || e.includes('.svg')) return null;
    return e;
}

function extrairRedeSocial(rx, texto) {
    rx.lastIndex = 0;
    const m = rx.exec(texto);
    rx.lastIndex = 0;
    return m ? m[0] : null;
}

// ── API Firecrawl ─────────────────────────────────────────────────────────────

async function mapearPaginas(baseURL) {
    try {
        const { data } = await axios.post(
            `${BASE}/map`,
            { url: baseURL, limit: 50 },
            { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        return data?.links ?? [];
    } catch {
        return [];
    }
}

async function rasparPagina(url, tentativas = 2) {
    for (let i = 0; i < tentativas; i++) {
        try {
            const { data } = await axios.post(
                `${BASE}/scrape`,
                { url, formats: ['markdown', 'links'], onlyMainContent: false },
                { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
            );
            const markdown = data?.data?.markdown ?? '';
            const links = (data?.data?.links ?? []).join('\n');
            return { texto: `${markdown}\n${links}`, url };
        } catch {
            if (i < tentativas - 1) await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}

// ── Extração principal ────────────────────────────────────────────────────────

function extrairDePagina(texto, url) {
    const resultado = {
        whatsapp: null, whatsapp_confianca: null, whatsapp_fonte: null,
        telefone: null,
        email: null, email_fonte: null,
        instagram: null, facebook: null, linkedin: null, youtube: null, tiktok: null,
    };

    const wa = extrairWA(texto);
    if (wa) {
        resultado.whatsapp = wa.numero;
        resultado.whatsapp_confianca = wa.confianca;
        resultado.whatsapp_fonte = url;
    }

    resultado.telefone = extrairTelFixo(texto);

    const email = extrairEmail(texto);
    if (email) { resultado.email = email; resultado.email_fonte = url; }

    resultado.instagram = extrairRedeSocial(RX.instagram, texto);
    resultado.facebook  = extrairRedeSocial(RX.facebook,  texto);
    resultado.linkedin  = extrairRedeSocial(RX.linkedin,  texto);
    resultado.youtube   = extrairRedeSocial(RX.youtube,   texto);
    resultado.tiktok    = extrairRedeSocial(RX.tiktok,    texto);

    return resultado;
}

function mesclarResultados(acumulado, novo) {
    if (!acumulado.whatsapp && novo.whatsapp) {
        acumulado.whatsapp = novo.whatsapp;
        acumulado.whatsapp_confianca = novo.whatsapp_confianca;
        acumulado.whatsapp_fonte = novo.whatsapp_fonte;
    }
    if (!acumulado.telefone  && novo.telefone)  acumulado.telefone  = novo.telefone;
    if (!acumulado.email     && novo.email)     { acumulado.email = novo.email; acumulado.email_fonte = novo.email_fonte; }
    if (!acumulado.instagram && novo.instagram) acumulado.instagram = novo.instagram;
    if (!acumulado.facebook  && novo.facebook)  acumulado.facebook  = novo.facebook;
    if (!acumulado.linkedin  && novo.linkedin)  acumulado.linkedin  = novo.linkedin;
    if (!acumulado.youtube   && novo.youtube)   acumulado.youtube   = novo.youtube;
    if (!acumulado.tiktok    && novo.tiktok)    acumulado.tiktok    = novo.tiktok;
    return acumulado;
}

function tudoEncontrado(r) {
    return r.whatsapp && r.email && r.instagram;
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function enriquecerComFirecrawl(website) {
    if (!website || !API_KEY) return {};

    const baseURL = normalizarURL(website);
    if (!baseURL) return {};

    const resultado = {
        whatsapp: null, whatsapp_confianca: null, whatsapp_fonte: null,
        telefone: null,
        email: null, email_fonte: null,
        instagram: null, facebook: null, linkedin: null, youtube: null, tiktok: null,
        paginas_analisadas: [],
        status: 'sem_contato',
    };

    try {
        // 1. Mapeia as páginas do domínio
        const todasPaginas = await mapearPaginas(baseURL);

        // 2. Seleciona e prioriza (máx 10 páginas, profundidade 2)
        const baseHost = new URL(baseURL).hostname;
        const paginasFiltradas = todasPaginas
            .filter(url => {
                try { return new URL(url).hostname === baseHost; } catch { return false; }
            })
            .filter(url => prioridadePagina(url) >= 0)
            .sort((a, b) => prioridadePagina(b) - prioridadePagina(a))
            .slice(0, 9); // 9 internas + homepage = 10 total

        // Sempre inclui a homepage como primeira
        const paginas = [baseURL, ...paginasFiltradas.filter(u => u !== baseURL)].slice(0, 10);

        // 3. Raspa cada página e extrai dados
        for (const url of paginas) {
            const pagina = await rasparPagina(url);
            if (!pagina) continue;

            resultado.paginas_analisadas.push(url);
            const extraido = extrairDePagina(pagina.texto, url);
            mesclarResultados(resultado, extraido);

            // Para quando encontrou tudo que precisava
            if (tudoEncontrado(resultado)) break;
        }

        // 4. Define status final
        const temAlgum = resultado.whatsapp || resultado.email || resultado.instagram || resultado.facebook;
        if (tudoEncontrado(resultado)) resultado.status = 'completo';
        else if (temAlgum) resultado.status = 'parcial';
        else resultado.status = 'sem_contato';

    } catch {
        resultado.status = 'erro_firecrawl';
    }

    return resultado;
}
