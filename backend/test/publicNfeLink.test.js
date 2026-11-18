import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicNfeUrl,
  createPublicNfeToken,
  verifyPublicNfeToken
} from '../src/utils/publicNfeLink.js';

test('gera e valida token público exclusivo de NF-e', () => {
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'teste-public-nfe';

  try {
    const token = createPublicNfeToken(42);
    assert.deepEqual(verifyPublicNfeToken(token), { notaId: 42 });
  } finally {
    if (anterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = anterior;
  }
});
test('monta URL pública sem duplicar /api', () => {
  const anteriorSecret = process.env.JWT_SECRET;
  const anteriorBase = process.env.PUBLIC_API_URL;
  process.env.JWT_SECRET = 'teste-public-nfe';
  process.env.PUBLIC_API_URL = 'https://lucromais-backend.example/api/';

  try {
    const url = buildPublicNfeUrl(null, 7);
    assert.match(url, /^https:\/\/lucromais-backend\.example\/api\/public\/nfe\/[^/]+$/);
  } finally {
    if (anteriorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = anteriorSecret;
    if (anteriorBase === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = anteriorBase;
  }
});
