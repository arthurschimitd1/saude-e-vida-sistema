// Ambiente isolado do Saúde e Vida. Não apontar para o backend do projeto de referência.
// Em macOS, localhost pode resolver primeiro para ::1 e atingir outra
// instância local. O backend do projeto escuta no IPv4 127.0.0.1:3001.
const DEFAULT_API_URL = 'http://127.0.0.1:3001/api';
const DEFAULT_PRODUCTION_API_URL = 'https://saude-e-vida-api.vercel.app/api';

function sanitizeApiUrl(value: string) {
    let url = value.trim();

    url = url.replace(/^NEXT_PUBLIC_API_URL\s*=\s*/i, '');
    url = url.replace(/^['"]|['"]$/g, '').trim();

    // Builds locais da Vercel podem substituir variáveis sensíveis por este
    // marcador. Ele nunca é uma URL válida e deve acionar o fallback seguro.
    if (/^\[SENSITIVE\]$/i.test(url)) {
        return '';
    }

    if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }

    return url.replace(/\/+$/, '');
}

export function getApiUrl() {
    const isLocalBrowser = typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const fallbackUrl = isLocalBrowser
        ? DEFAULT_API_URL
        : process.env.NODE_ENV === 'production'
        ? DEFAULT_PRODUCTION_API_URL
        : DEFAULT_API_URL;
    const normalizedUrl = sanitizeApiUrl(String(process.env.NEXT_PUBLIC_API_URL || fallbackUrl));

    try {
        const parsed = new URL(normalizedUrl);
        const baseUrl = parsed.toString().replace(/\/+$/, '');
        return parsed.pathname.replace(/\/+$/, '').endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    } catch {
        return fallbackUrl;
    }
}
