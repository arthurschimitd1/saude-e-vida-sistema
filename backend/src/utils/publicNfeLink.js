import jwt from 'jsonwebtoken';

const PUBLIC_NFE_PURPOSE = 'public-nfe-danfe';
const PUBLIC_NFE_TTL = '180d';

function publicNfeSecret() {
  return process.env.PUBLIC_NFE_SECRET || process.env.JWT_SECRET || '';
}
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function apiOriginFromRequest(req) {
  const forwardedProtocol = req?.get?.('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req?.get?.('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || req?.protocol || 'http';
  const host = forwardedHost || req?.get?.('host');

  return host ? `${protocol}://${host}` : '';
}

export function createPublicNfeToken(notaId) {
  const secret = publicNfeSecret();
  if (!secret) {
    throw new Error('JWT_SECRET ou PUBLIC_NFE_SECRET não configurado');
  }

  return jwt.sign(
    {
      purpose: PUBLIC_NFE_PURPOSE,
      notaId: Number(notaId),
      tipo: 'NFE'
    },
    secret,
    { expiresIn: PUBLIC_NFE_TTL }
  );
}

export function verifyPublicNfeToken(token) {
  const secret = publicNfeSecret();
  if (!secret) {
    throw new Error('JWT_SECRET ou PUBLIC_NFE_SECRET não configurado');
  }

  const payload = jwt.verify(token, secret);
  if (
    payload?.purpose !== PUBLIC_NFE_PURPOSE ||
    payload?.tipo !== 'NFE' ||
    !Number.isInteger(Number(payload?.notaId)) ||
    Number(payload.notaId) <= 0
  ) {
    throw new Error('Token público de NF-e inválido');
  }

  return { notaId: Number(payload.notaId) };
}

export function buildPublicNfeUrl(req, notaId) {
  const configuredBase = trimTrailingSlash(process.env.PUBLIC_API_URL);
  const base = configuredBase
    ? /\/api$/i.test(configuredBase)
      ? configuredBase
      : `${configuredBase}/api`
    : `${trimTrailingSlash(apiOriginFromRequest(req))}/api`;

  if (!base || !notaId) return null;

  return `${base}/public/nfe/${encodeURIComponent(createPublicNfeToken(notaId))}`;
}
