import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import NuvemshopIntegracao from '../models/NuvemshopIntegracao.js';
import NuvemshopProdutoVinculo from '../models/NuvemshopProdutoVinculo.js';
import { encryptCredential } from '../utils/credentialCrypto.js';

const APP_ID = String(process.env.NUVEMSHOP_CLIENT_ID || '42516').trim();
const AUTHORIZE_URL = `https://www.nuvemshop.com.br/apps/${APP_ID}/authorize`;
const TOKEN_URL = 'https://www.nuvemshop.com.br/apps/authorize/token';
const OAUTH_PURPOSE = 'nuvemshop-oauth';

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const getPublicApiBase = () => {
  const configured = normalizeUrl(process.env.PUBLIC_API_URL);
  const base = configured || 'https://lucromais-backend-mssolucoes.vercel.app/api';
  return /\/api$/i.test(base) ? base : `${base}/api`;
};

export const getFrontendBase = () => {
  const firstConfigured = String(process.env.FRONTEND_URL || '').split(',')[0];
  return normalizeUrl(firstConfigured) || 'https://lucromais-frontend-mssolucoes.vercel.app';
};

export const getNuvemshopAppUrls = () => {
  const api = getPublicApiBase();
  return {
    site: `${getFrontendBase()}/uikit/estoque-roupas`,
    callback: `${api}/integracoes/nuvemshop/callback`,
    storeRedact: `${api}/integracoes/nuvemshop/webhooks/store-redact`,
    customersRedact: `${api}/integracoes/nuvemshop/webhooks/customers-redact`,
    customersDataRequest: `${api}/integracoes/nuvemshop/webhooks/customers-data-request`,
    events: `${api}/integracoes/nuvemshop/webhooks/events`,
  };
};

export const resolveEmpresaId = (user) => {
  const value = user?.tipo === 'MASTER' ? user?.empresa_id_override : user?.empresa_id;
  const empresaId = Number(value);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new ApiError(403, 'Selecione uma empresa para configurar a Nuvemshop');
  }
  return empresaId;
};

export const canManageIntegration = (user) => (
  user?.tipo === 'MASTER'
  || user?.tipo === 'EMPRESA'
  || ['Dono', 'DONO', 'Gerente', 'GERENTE', 'Administrador', 'ADMINISTRADOR'].includes(user?.cargo)
);

const ensureCanManage = (user) => {
  if (!canManageIntegration(user)) throw new ApiError(403, 'Apenas um administrador pode configurar a integração');
};

const getSecret = () => {
  const secret = String(process.env.NUVEMSHOP_CLIENT_SECRET || '').trim();
  if (!secret) throw new ApiError(503, 'A credencial secreta da Nuvemshop ainda não foi configurada no servidor');
  return secret;
};

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new ApiError(503, 'A autenticação do servidor não está configurada');
  return secret;
};

export const createOauthState = (empresaId) => jwt.sign(
  { purpose: OAUTH_PURPOSE, empresaId },
  getJwtSecret(),
  { expiresIn: '10m', audience: 'nuvemshop', issuer: 'lucromais' },
);

export const verifyOauthState = (state) => {
  try {
    const decoded = jwt.verify(String(state || ''), getJwtSecret(), {
      audience: 'nuvemshop', issuer: 'lucromais',
    });
    if (decoded?.purpose !== OAUTH_PURPOSE) throw new Error('purpose');
    const empresaId = Number(decoded.empresaId);
    if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('empresa');
    return empresaId;
  } catch {
    throw new ApiError(400, 'A autorização da Nuvemshop expirou ou é inválida. Inicie a conexão novamente.');
  }
};

const safeTimingEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || '').trim().toLowerCase(), 'utf8');
  const rightBuffer = Buffer.from(String(right || '').trim().toLowerCase(), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', getSecret()).update(rawBody).digest('hex');
  return safeTimingEqual(signature, expected);
};

class NuvemshopService {
  async getStatus(user) {
    const empresaId = resolveEmpresaId(user);
    const integration = await NuvemshopIntegracao.findOne({
      where: { empresa_id: empresaId, ativo: true },
      attributes: ['id', 'store_id', 'scopes', 'connected_at', 'updated_at', 'last_sync_at', 'last_sync_direction', 'last_sync_summary', 'last_sync_error'],
    });
    const linkedVariants = integration
      ? await NuvemshopProdutoVinculo.count({ where: { integracao_id: integration.id } })
      : 0;
    return {
      connected: Boolean(integration),
      storeId: integration?.store_id ? String(integration.store_id) : null,
      scopes: integration?.scopes ? String(integration.scopes).split(/[\s,]+/).map(item => item.trim()).filter(Boolean) : [],
      connectedAt: integration?.connected_at ?? null,
      linkedVariants,
      lastSyncAt: integration?.last_sync_at ?? null,
      lastSyncDirection: integration?.last_sync_direction ?? null,
      lastSyncSummary: integration?.last_sync_summary ?? null,
      lastSyncError: integration?.last_sync_error ?? null,
      urls: getNuvemshopAppUrls(),
    };
  }

  async startConnection(user) {
    ensureCanManage(user);
    getSecret();
    const empresaId = resolveEmpresaId(user);
    const state = createOauthState(empresaId);
    return { authorizationUrl: `${AUTHORIZE_URL}?state=${encodeURIComponent(state)}` };
  }

  async finishConnection({ code, state }) {
    if (!code) throw new ApiError(400, 'A Nuvemshop não enviou o código de autorização');
    const empresaId = verifyOauthState(state);
    let payload;
    try {
      const response = await axios.post(TOKEN_URL, {
        client_id: APP_ID,
        client_secret: getSecret(),
        grant_type: 'authorization_code',
        code: String(code),
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
      payload = response.data;
    } catch (error) {
      console.error('[Nuvemshop] Falha ao trocar código OAuth:', error?.response?.status || error.message);
      throw new ApiError(502, 'A Nuvemshop não concluiu a autorização. Tente conectar novamente.');
    }

    const storeId = Number(payload?.user_id);
    const accessToken = String(payload?.access_token || '').trim();
    if (!Number.isSafeInteger(storeId) || storeId <= 0 || !accessToken) {
      throw new ApiError(502, 'A Nuvemshop retornou uma autorização incompleta');
    }

    const anotherCompany = await NuvemshopIntegracao.findOne({ where: { store_id: storeId } });
    if (anotherCompany && Number(anotherCompany.empresa_id) !== empresaId) {
      throw new ApiError(409, 'Esta loja Nuvemshop já está vinculada a outra empresa no Lucro+');
    }

    const current = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId } });
    const values = {
      empresa_id: empresaId,
      store_id: storeId,
      access_token_encrypted: encryptCredential(accessToken),
      scopes: String(payload?.scope || ''),
      ativo: true,
      connected_at: new Date(),
      disconnected_at: null,
    };
    const integration = current ? await current.update(values) : await NuvemshopIntegracao.create(values);
    try {
      const { default: syncService } = await import('./NuvemshopCatalogSync.service.js');
      await syncService.registerWebhooks(integration, getNuvemshopAppUrls().events);
    } catch (error) {
      console.error('[Nuvemshop] Loja conectada, mas os webhooks não foram registrados:', error?.response?.status || error.message);
      await integration.update({ last_sync_error: 'Loja conectada; registre novamente os webhooks pela sincronização' });
    }
    return { empresaId, storeId };
  }

  async disconnect(user) {
    ensureCanManage(user);
    const empresaId = resolveEmpresaId(user);
    const integration = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
    if (!integration) return { disconnected: false };
    // Remover a linha apaga também o token criptografado. Manter uma credencial
    // revogada não traz benefício e contraria a minimização de dados da LGPD.
    await integration.destroy();
    return { disconnected: true };
  }

  async handleRequiredWebhook(req, kind) {
    if (!verifyWebhookSignature(req.rawBody, req.header('x-linkedstore-hmac-sha256'))) {
      throw new ApiError(401, 'Assinatura de webhook inválida');
    }
    const storeId = Number(req.body?.store_id);
    if (!Number.isSafeInteger(storeId) || storeId <= 0) throw new ApiError(400, 'Loja inválida');

    if (kind === 'store-redact') {
      const integration = await NuvemshopIntegracao.findOne({ where: { store_id: storeId } });
      if (integration) await integration.destroy();
    }
    // O Lucro+ não solicita clientes/pedidos neste escopo e não armazena
    // dados pessoais vindos da Nuvemshop. Os dois webhooks de cliente são
    // confirmados sem tocar nos cadastros locais, que têm origem própria.
    return { received: true };
  }

  async pullCatalog(user, options = {}) {
    ensureCanManage(user);
    const empresaId = resolveEmpresaId(user);
    const { default: syncService } = await import('./NuvemshopCatalogSync.service.js');
    const summary = await syncService.pullPage(empresaId, options);
    const integration = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
    try {
      const webhooks = integration && !summary.hasMore
        ? await syncService.registerWebhooks(integration, getNuvemshopAppUrls().events)
        : { created: 0, total: 0 };
      return { ...summary, webhooksRegistered: summary.hasMore ? null : true, webhooksCreated: webhooks.created };
    } catch (error) {
      console.error('[Nuvemshop] Estoque sincronizado, mas os webhooks falharam:', error?.response?.status || error.message);
      if (integration) await integration.update({ last_sync_error: 'Estoque sincronizado, mas os avisos automáticos da Nuvemshop não foram registrados' });
      return { ...summary, webhooksRegistered: false, webhooksCreated: 0 };
    }
  }

  async pushCatalog(user) {
    ensureCanManage(user);
    const empresaId = resolveEmpresaId(user);
    const { default: syncService } = await import('./NuvemshopCatalogSync.service.js');
    return syncService.pushAll(empresaId);
  }

  async registerWebhooks(user) {
    ensureCanManage(user);
    const empresaId = resolveEmpresaId(user);
    const integration = await NuvemshopIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
    if (!integration) throw new ApiError(409, 'Conecte a loja Nuvemshop antes de registrar webhooks');
    const { default: syncService } = await import('./NuvemshopCatalogSync.service.js');
    return syncService.registerWebhooks(integration, getNuvemshopAppUrls().events);
  }

  async handleEventWebhook(req) {
    if (!verifyWebhookSignature(req.rawBody, req.header('x-linkedstore-hmac-sha256'))) {
      throw new ApiError(401, 'Assinatura de webhook inválida');
    }
    const storeId = Number(req.body?.store_id);
    const resourceId = Number(req.body?.id);
    const event = String(req.body?.event || '');
    if (!Number.isSafeInteger(storeId) || storeId <= 0 || !event) throw new ApiError(400, 'Evento Nuvemshop inválido');
    const integration = await NuvemshopIntegracao.findOne({ where: { store_id: storeId } });
    if (!integration) return { received: true, ignored: true };
    const { default: syncService } = await import('./NuvemshopCatalogSync.service.js');
    if (event === 'app/uninstalled') {
      await integration.destroy();
      return { received: true, disconnected: true };
    }
    if (event === 'app/suspended') {
      await integration.update({ ativo: false, disconnected_at: new Date(), last_sync_error: 'Aplicativo suspenso na Nuvemshop' });
      return { received: true, suspended: true };
    }
    if (event === 'app/resumed') {
      await integration.update({ ativo: true, disconnected_at: null, last_sync_error: null });
      return { received: true, resumed: true };
    }
    if (event === 'product/deleted' && Number.isSafeInteger(resourceId)) {
      return { received: true, ...(await syncService.detachDeletedProduct(storeId, resourceId)) };
    }
    if (['product/created', 'product/updated'].includes(event) && Number.isSafeInteger(resourceId)) {
      return { received: true, ...(await syncService.pullOneByStore(storeId, resourceId)) };
    }
    return { received: true, ignored: true };
  }
}

export default new NuvemshopService();
