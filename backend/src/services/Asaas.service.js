import crypto from 'crypto';
import { Op } from 'sequelize';
import AsaasIntegracao from '../models/AsaasIntegracao.js';
import AsaasCliente from '../models/AsaasCliente.js';
import AsaasCheckout from '../models/AsaasCheckout.js';
import Recorrencia from '../models/Recorrencia.js';
import HistoricoPagamento from '../models/HistoricoPagamento.js';
import Cliente from '../models/Cliente.js';
import RecorrenciaAuditoria from '../models/RecorrenciaAuditoria.js';
import sequelize from '../config/database.js';
import { decryptCredential, encryptCredential } from '../utils/credentialCrypto.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

export const ASAAS_CYCLES = {
  MENSAL: 'MONTHLY',
  TRIMESTRAL: 'QUARTERLY',
  SEMESTRAL: 'SEMIANNUALLY',
  ANUAL: 'YEARLY',
  SEMANAL: 'WEEKLY',
  QUINZENAL: 'BIWEEKLY'
};

const PAYMENT_METHODS = { PIX: 'PIX', BOLETO: 'BOLETO', CARTAO_CREDITO: 'CREDIT_CARD' };
const ACTIVE_CHECKOUT_STATUSES = ['PROCESSANDO', 'PENDENTE_PREENCHIMENTO', 'ASSINATURA_ATIVA'];
const CHECKOUT_EVENTS = ['CHECKOUT_CREATED', 'CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED', 'CHECKOUT_PAID'];
export const PAYMENT_EVENTS = [
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
];

export const SUBSCRIPTION_EVENTS = [
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED'
];
export const LANDING_PLANS = Object.freeze({
  plano1: Object.freeze({
    code: 'pacote1',
    name: 'Plano Essencial',
    monthly: 300,
    annual: 2000,
  }),
  plano2: Object.freeze({
    code: 'pacote2',
    name: 'Plano Inteligência',
    monthly: 400,
    annual: 2750,
  }),
});

function today() { return new Date().toISOString().slice(0, 10); }

function parseDate(value) {
  if (!value) return null;
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function normalizeAsaasError(body, status) {
  const detail = Array.isArray(body?.errors)
    ? body.errors.map((item) => item.description || item.code).filter(Boolean).join('; ')
    : body?.message;
  const credencialRecusada = status === 401 || status === 403;
  const mensagem = credencialRecusada
    ? `O Asaas recusou a API Key. Confira se a chave pertence ao ambiente selecionado (${detail || 'credencial não autorizada'}).`
    : `Asaas (${status}): ${detail || 'não foi possível concluir a operação'}`;
  const error = new Error(mensagem);
  // 401 é reservado para a autenticação do usuário no Lucro+. Uma rejeição do
  // provedor é erro de configuração e não pode encerrar a sessão do operador.
  error.status = credencialRecusada ? 422 : status;
  error.providerStatus = status;
  error.code = body?.errors?.[0]?.code || `HTTP_${status}`;
  return error;
}

function timingSafeTokenEquals(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function publicBaseUrl(value, fallback) {
  const first = String(value || '').split(',')[0].trim().replace(/\/+$/, '');
  return first || fallback;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function checkoutStatusForEvent(event) {
  return {
    CHECKOUT_CREATED: 'PENDENTE_PREENCHIMENTO',
    CHECKOUT_PAID: 'ASSINATURA_ATIVA',
    CHECKOUT_EXPIRED: 'EXPIRADO',
    CHECKOUT_CANCELED: 'CANCELADO'
  }[event] || null;
}

function landingPlan(plan) {
  return LANDING_PLANS[String(plan || '').trim().toLowerCase()] || null;
}

function normalizeLandingText(value, maxLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeLandingDocument(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 14);
}

function normalizeLandingPhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 13);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function asaasCheckoutUrl(result, ambiente) {
  const host = ambiente === 'producao' ? 'asaas.com' : 'sandbox.asaas.com';
  for (const candidate of [result?.link, result?.url, result?.checkoutUrl]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(String(candidate));
      if (parsed.protocol === 'https:' && parsed.hostname === host) return parsed.toString();
    } catch { /* O ID retornado pelo Asaas continua sendo a fonte confiável. */ }
  }
  const id = String(result?.id || result?.checkoutId || '').trim();
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(id)) throw new Error('O Asaas não retornou um link ou identificador válido para o Checkout');
  return ambiente === 'producao'
    ? `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`
    : `https://sandbox.asaas.com/checkoutSession/show/${encodeURIComponent(id)}`;
}
class AsaasService {
  empresaId(user) {
    const empresaId = empresaParaGravar(user);
    if (!empresaId) throw new Error('Selecione uma empresa antes de configurar o Asaas');
    return Number(empresaId);
  }

  async configByEmpresa(empresaId) {
    return AsaasIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
  }

  async publicLandingConfig() {
    const configuredEmpresaId = Number(process.env.PUBLIC_CHECKOUT_EMPRESA_ID || process.env.LANDING_EMPRESA_ID);
    if (Number.isInteger(configuredEmpresaId) && configuredEmpresaId > 0) {
      const config = await this.configByEmpresa(configuredEmpresaId);
      if (!config) throw new Error('O checkout público ainda não está configurado para esta landing');
      return config;
    }

    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      throw new Error('Configure PUBLIC_CHECKOUT_EMPRESA_ID no backend antes de liberar o checkout público');
    }

    const configs = await AsaasIntegracao.findAll({ where: { ativo: true }, order: [['updated_at', 'DESC']] });
    // Em produção, prioriza a integração de produção. Em desenvolvimento, a
    // integração sandbox continua sendo usada automaticamente quando for a única disponível.
    return configs.find((config) => config.ambiente === 'producao') || configs[0] || null;
  }

  async request(config, path, options = {}) {
    const apiKey = decryptCredential(config.api_key_encrypted);
    const base = config.ambiente === 'producao'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
    const timeoutMs = Number(process.env.ASAAS_HTTP_TIMEOUT_MS || 15000);
    const signal = AbortSignal.timeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000);
    const response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': `LucroMais/${process.env.npm_package_version || '1.0.0'} (${config.ambiente})`,
        access_token: apiKey,
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
    if (!response.ok) throw normalizeAsaasError(body, response.status);
    return body;
  }

  async getConfig(user) {
    const empresaId = this.empresaId(user);
    const config = await this.configByEmpresa(empresaId);
    if (!config) return { configurado: false, ambiente: 'sandbox', webhookConfigurado: false };
    return {
      configurado: true,
      ambiente: config.ambiente,
      webhookConfigurado: Boolean(config.webhook_id),
      webhookUrl: config.webhook_url || null,
      ativo: config.ativo
    };
  }

  async saveConfig(data, user) {
    const empresaId = this.empresaId(user);
    const ambiente = data?.ambiente === 'producao' ? 'producao' : 'sandbox';
    const current = await AsaasIntegracao.findOne({ where: { empresa_id: empresaId } });
    const apiKey = String(data?.apiKey || '').trim();
    if (!current && !apiKey) throw new Error('Informe a API Key do Asaas');
    if (apiKey && apiKey.length < 10) throw new Error('A API Key do Asaas parece inválida');

    const config = current || AsaasIntegracao.build({ empresa_id: empresaId });
    const ambienteMudou = Boolean(current && current.ambiente !== ambiente);
    config.ambiente = ambiente;
    config.ativo = true;
    config.public_id = config.public_id || crypto.randomBytes(24).toString('hex');
    if (apiKey) config.api_key_encrypted = encryptCredential(apiKey);
    if (ambienteMudou) {
      config.webhook_id = null;
      config.webhook_url = null;
      config.webhook_auth_token_encrypted = null;
    }

    // Valida a chave candidata antes de persistir ou criar o webhook.
    await this.request(config, '/myAccount');
    await config.save();
    await this.ensureWebhook(config, empresaId, user);
    return this.getConfig(user);
  }

  async ensureWebhook(config, empresaId, user) {
    const publicApi = publicBaseUrl(process.env.PUBLIC_API_URL, '');
    config.public_id = config.public_id || crypto.randomBytes(24).toString('hex');
    const webhookUrl = publicApi ? `${publicApi}/api/asaas/webhook/public/${config.public_id}` : null;
    if (!webhookUrl) {
      await config.save();
      return config;
    }

    const events = [...CHECKOUT_EVENTS, ...PAYMENT_EVENTS, ...SUBSCRIPTION_EVENTS];
    const authToken = config.webhook_auth_token_encrypted
      ? decryptCredential(config.webhook_auth_token_encrypted)
      : crypto.randomBytes(48).toString('hex');

    if (config.webhook_id) {
      // Configurações antigas podem ter a URL legada. Tenta atualizar sem invalidar a integração caso o endpoint esteja indisponível.
      if (config.webhook_url !== webhookUrl) {
        try {
          await this.request(config, `/webhooks/${config.webhook_id}`, {
            method: 'PUT',
            body: { name: `Lucro+ empresa ${empresaId}`, url: webhookUrl, enabled: true, interrupted: false, authToken, sendType: 'SEQUENTIALLY', events }
          });
          config.webhook_url = webhookUrl;
        } catch (error) {
          console.warn('[Asaas] Não foi possível atualizar webhook existente:', error.code || error.message);
        }
      }
      await config.save();
      return config;
    }

    const email = process.env.ASAAS_WEBHOOK_EMAIL || user?.email || 'suporte@lucromais.com.br';
    const result = await this.request(config, '/webhooks', {
      method: 'POST',
      body: { name: `Lucro+ empresa ${empresaId}`, url: webhookUrl, email, enabled: true, interrupted: false, authToken, sendType: 'SEQUENTIALLY', events }
    });
    config.webhook_id = result.id || null;
    config.webhook_url = webhookUrl;
    config.webhook_auth_token_encrypted = encryptCredential(authToken);
    await config.save();
    return config;
  }

  async getRecorrencia(id, user) {
    const empresaId = this.empresaId(user);
    const recorrencia = await Recorrencia.findOne({
      where: { id, empresa_id: empresaId },
      include: [{ model: Cliente, as: 'cliente', required: false, where: { empresa_id: empresaId } }]
    });
    if (!recorrencia) throw new Error('Recorrência não encontrada para a empresa selecionada');
    return { recorrencia, empresaId };
  }

  billingType(recorrencia) {
    const billingType = PAYMENT_METHODS[recorrencia.formaPagamento];
    if (!billingType) throw new Error('Para usar o Asaas, escolha Pix, boleto ou cartão de crédito');
    return billingType;
  }

  cycle(recorrencia) {
    const key = recorrencia.tempoRecorrencia === 'PERSONALIZADO' ? recorrencia.subtipoRecorrencia : recorrencia.tempoRecorrencia;
    if (!ASAAS_CYCLES[key]) throw new Error('A periodicidade diária não é aceita pelo Checkout recorrente do Asaas');
    return ASAAS_CYCLES[key];
  }

  async ensureCustomer(config, empresaId, recorrencia) {
    if (!recorrencia.cliente_id || !recorrencia.cliente) throw new Error('Vincule um cliente cadastrado antes de usar o Asaas');
    const existing = await AsaasCliente.findOne({ where: { empresa_id: empresaId, cliente_id: recorrencia.cliente_id } });
    if (existing) return existing.asaas_customer_id;
    const cliente = recorrencia.cliente;
    const cpfCnpj = cliente.cpf || cliente.cnpj;
    if (!cpfCnpj) throw new Error('O cliente precisa ter CPF ou CNPJ para ser cadastrado no Asaas');
    const result = await this.request(config, '/customers', {
      method: 'POST',
      body: {
        name: cliente.nomeCompleto,
        cpfCnpj: String(cpfCnpj).replace(/\D/g, ''),
        email: cliente.email || undefined,
        mobilePhone: cliente.telefone ? String(cliente.telefone).replace(/\D/g, '') : undefined,
        postalCode: cliente.cep ? String(cliente.cep).replace(/\D/g, '') : undefined,
        address: cliente.rua || undefined,
        addressNumber: cliente.numero || undefined,
        complement: cliente.complemento || undefined,
        province: cliente.bairro || undefined,
        city: cliente.cidade || undefined,
        externalReference: `lucromais:empresa:${empresaId}:cliente:${cliente.id}`
      }
    });
    await AsaasCliente.create({ empresa_id: empresaId, cliente_id: cliente.id, asaas_customer_id: result.id });
    return result.id;
  }

  // Fluxos antigos preservados para não invalidar recorrências já criadas.
  async createSubscription(id, user) {
    const { recorrencia, empresaId } = await this.getRecorrencia(id, user);
    if (recorrencia.tipoTransacao !== 'ENTRADA') throw new Error('O Asaas só pode ser usado em recorrências de entrada');
    if (recorrencia.asaasSubscriptionId) {
      return { alreadyExists: true, subscription: { id: recorrencia.asaasSubscriptionId, status: recorrencia.asaasStatus }, recorrencia: recorrencia.toJSON() };
    }
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Configure o Asaas para esta empresa antes de criar a assinatura');
    const customer = await this.ensureCustomer(config, empresaId, recorrencia);
    const subscription = await this.request(config, '/subscriptions', {
      method: 'POST',
      body: {
        customer,
        billingType: this.billingType(recorrencia),
        value: Number(recorrencia.valorMes),
        nextDueDate: parseDate(recorrencia.dataInicio) < today() ? today() : parseDate(recorrencia.dataInicio),
        cycle: this.cycle(recorrencia),
        description: `${recorrencia.produto} - ${recorrencia.nomeCliente}`,
        externalReference: `lucromais:recorrencia:${recorrencia.id}:empresa:${empresaId}`
      }
    });
    await recorrencia.update({ asaasCustomerId: customer, asaasSubscriptionId: subscription.id, asaasStatus: subscription.status || 'ACTIVE', asaasSubscriptionStatus: subscription.status || 'ACTIVE', asaasSyncStatus: 'SINCRONIZADO', asaasSyncError: null, asaasLastSyncedAt: new Date(), statusRecorrencia: 'ATIVA', ativo: true });
    return { subscription, recorrencia: recorrencia.toJSON() };
  }

  async subscriptionIdFor(id, user) {
    const { recorrencia, empresaId } = await this.getRecorrencia(id, user);
    const subscriptionId = recorrencia.asaasSubscriptionId;
    if (!subscriptionId) throw new Error('Esta recorrência ainda não possui assinatura no Asaas');
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Asaas não configurado para esta empresa');
    return { recorrencia, empresaId, config, subscriptionId };
  }

  async pauseSubscription(id, user) {
    const { config, subscriptionId } = await this.subscriptionIdFor(id, user);
    return this.request(config, `/subscriptions/${subscriptionId}`, { method: 'PUT', body: { status: 'INACTIVE' } });
  }

  async reactivateSubscription(id, user) {
    const { config, subscriptionId } = await this.subscriptionIdFor(id, user);
    return this.request(config, `/subscriptions/${subscriptionId}`, { method: 'PUT', body: { status: 'ACTIVE' } });
  }

  async cancelSubscription(id, user) {
    const { config, subscriptionId } = await this.subscriptionIdFor(id, user);
    return this.request(config, `/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  async refundPayment(paymentId, data = {}, user) {
    const empresaId = this.empresaId(user);
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Asaas não configurado para esta empresa');
    const body = {};
    if (data.value !== undefined && data.value !== null && data.value !== '') body.value = Number(data.value);
    if (data.reason) body.description = String(data.reason).slice(0, 255);
    return this.request(config, `/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body });
  }

  async createPaymentLink(id, user, options = {}) {
    const { recorrencia, empresaId } = await this.getRecorrencia(id, user);
    if (recorrencia.tipoTransacao !== 'ENTRADA') throw new Error('O Asaas só pode ser usado em recorrências de entrada');
    if (recorrencia.asaasPaymentLinkId) return { alreadyExists: true, link: { id: recorrencia.asaasPaymentLinkId, url: recorrencia.asaasPaymentLinkUrl }, recorrencia: recorrencia.toJSON() };
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Configure o Asaas para esta empresa antes de criar um link');
    const dueDateLimitDays = Number(options.dueDateLimitDays ?? 5);
    if (!Number.isInteger(dueDateLimitDays) || dueDateLimitDays < 1 || dueDateLimitDays > 365) {
      throw new Error('Informe entre 1 e 365 dias úteis para o vencimento da cobrança');
    }
    const link = await this.request(config, '/paymentLinks', {
      method: 'POST',
      body: { name: `${recorrencia.produto} - ${recorrencia.nomeCliente}`, description: `Plano ${recorrencia.produto}`, value: Number(recorrencia.valorMes), billingType: this.billingType(recorrencia), chargeType: 'RECURRENT', subscriptionCycle: this.cycle(recorrencia), dueDateLimitDays, externalReference: `lucromais:recorrencia:${recorrencia.id}:empresa:${empresaId}`, notificationEnabled: true }
    });
    await recorrencia.update({ asaasPaymentLinkId: link.id, asaasPaymentLinkUrl: link.url, asaasSyncStatus: 'SINCRONIZADO', asaasSyncError: null, asaasLastSyncedAt: new Date() });
    return { link, recorrencia: recorrencia.toJSON() };
  }

  async createCheckout(id, user, requestId) {
    const { recorrencia, empresaId } = await this.getRecorrencia(id, user);
    if (recorrencia.tipoTransacao !== 'ENTRADA') throw new Error('O Checkout Asaas só pode ser usado em recorrências de entrada');
    if (!recorrencia.ativo && recorrencia.statusRecorrencia !== 'PENDENTE_CHECKOUT') {
      throw new Error('Ative a recorrência antes de gerar o Checkout');
    }
    if (Number(recorrencia.valorMes) <= 0) throw new Error('O valor da recorrência precisa ser maior que zero');
    if (recorrencia.formaPagamento !== 'CARTAO_CREDITO') throw new Error('O Checkout recorrente exige forma de pagamento Cartão de crédito');
    const cycle = this.cycle(recorrencia);
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Configure a chave do Asaas para esta empresa antes de gerar o Checkout');

    const latest = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, recorrencia_id: id }, order: [['created_at', 'DESC']] });
    if (latest && ACTIVE_CHECKOUT_STATUSES.includes(latest.checkout_status)) return { alreadyExists: true, checkout: latest.toJSON() };

    const intent = String(requestId || crypto.randomUUID()).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120) || crypto.randomUUID();
    const existingIntent = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, recorrencia_id: id, request_id: intent } });
    if (existingIntent) return { alreadyExists: true, checkout: existingIntent.toJSON() };

    const minutesToExpire = Math.min(1440, Math.max(10, Number(process.env.ASAAS_CHECKOUT_EXPIRATION_MINUTES || 1440)));
    const nextDueDate = parseDate(recorrencia.dataInicio);
    if (!nextDueDate) throw new Error('A data inicial da recorrência é inválida');
    const endDate = parseDate(recorrencia.dataFim);
    if (endDate && endDate < nextDueDate) throw new Error('A data final não pode ser anterior à data inicial');
    const checkoutPublicId = crypto.randomBytes(24).toString('hex');
    const externalReference = `lucromais:checkout:${checkoutPublicId}:recorrencia:${id}:empresa:${empresaId}`.slice(0, 200);
    const checkout = await AsaasCheckout.create({
      public_id: checkoutPublicId,
      empresa_id: empresaId,
      recorrencia_id: id,
      integration_id: config.id,
      external_reference: externalReference,
      checkout_status: 'PROCESSANDO',
      cycle,
      value: Number(recorrencia.valorMes),
      next_due_date: nextDueDate,
      end_date: endDate,
      expires_at: addDays(new Date(), minutesToExpire / 1440),
      request_id: intent,
      created_by: user?.id || null
    });

    try {
      const customer = await this.ensureCustomer(config, empresaId, recorrencia);
      const publicApi = publicBaseUrl(process.env.PUBLIC_API_URL, 'http://localhost:3001');
      const callbackBase = publicBaseUrl(process.env.ASAAS_CHECKOUT_CALLBACK_BASE_URL, publicApi);
      const result = await this.request(config, '/checkouts', {
        method: 'POST',
        body: {
          billingTypes: ['CREDIT_CARD'],
          chargeTypes: ['RECURRENT'],
          minutesToExpire,
          externalReference,
          callback: {
            successUrl: `${callbackBase}/api/asaas/checkout/callback/success`,
            cancelUrl: `${callbackBase}/api/asaas/checkout/callback/cancel`,
            expiredUrl: `${callbackBase}/api/asaas/checkout/callback/expired`
          },
          items: [{ name: recorrencia.produto, description: `Recorrência de ${recorrencia.nomeCliente}`, quantity: 1, value: Number(recorrencia.valorMes) }],
          customerData: {
            name: recorrencia.cliente.nomeCompleto,
            cpfCnpj: String(recorrencia.cliente.cpf || recorrencia.cliente.cnpj).replace(/\D/g, ''),
            email: recorrencia.cliente.email || undefined,
            phone: recorrencia.cliente.telefone ? String(recorrencia.cliente.telefone).replace(/\D/g, '') : undefined
          },
          subscription: { cycle, nextDueDate, ...(endDate ? { endDate } : {}) }
        }
      });
      await checkout.update({
        asaas_checkout_id: result.id || result.checkoutId,
        asaas_customer_id: customer,
        asaas_subscription_id: result.subscription?.id || null,
        checkout_url: asaasCheckoutUrl(result, config.ambiente),
        checkout_status: 'PENDENTE_PREENCHIMENTO',
        subscription_status: result.subscription?.status || null,
        last_error_code: null
      });
      await recorrencia.update({ asaasCustomerId: customer, asaasSubscriptionId: result.subscription?.id || recorrencia.asaasSubscriptionId, asaasSubscriptionStatus: result.subscription?.status || recorrencia.asaasSubscriptionStatus, asaasSyncStatus: 'SINCRONIZADO', asaasSyncError: null, asaasLastSyncedAt: new Date() });
      return { checkout: checkout.toJSON() };
    } catch (error) {
      await checkout.update({ checkout_status: 'FALHA', last_error_code: String(error.code || error.status || 'ASAAS_ERROR').slice(0, 120) });
      await recorrencia.update({ asaasSyncStatus: 'ERRO', asaasSyncError: String(error.message || 'Falha no Asaas').slice(0, 500), asaasLastSyncedAt: new Date() });
      throw error;
    }
  }

  async createPublicLandingCheckout(data = {}, requestId) {
    const plan = landingPlan(data.plan);
    const billing = String(data.billing || '').trim().toLowerCase();
    const nome = normalizeLandingText(data.nome, 160);
    const email = normalizeLandingText(data.email, 200).toLowerCase();
    const telefone = normalizeLandingPhone(data.telefone);
    const documento = normalizeLandingDocument(data.documento);

    if (!plan) throw new Error('Plano inválido');
    if (!['mensal', 'anual'].includes(billing)) throw new Error('Periodicidade inválida');
    if (nome.length < 3) throw new Error('Informe seu nome completo');
    if (!validEmail(email)) throw new Error('Informe um e-mail válido');
    if (telefone.length < 10) throw new Error('Informe um telefone válido');
    if (![11, 14].includes(documento.length)) throw new Error('Informe um CPF ou CNPJ válido');

    const config = await this.publicLandingConfig();
    if (!config) throw new Error('O checkout ainda não está disponível. Fale com nosso time comercial.');

    const intent = String(requestId || crypto.randomUUID()).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120) || crypto.randomUUID();
    const existing = await AsaasCheckout.findOne({
      where: { integration_id: config.id, request_id: intent },
      order: [['created_at', 'DESC']]
    });
    if (existing?.checkout_url) {
      return { checkoutUrl: existing.checkout_url, checkoutStatus: existing.checkout_status, plan: plan.name, billing };
    }

    const hoje = today();
    const valor = billing === 'anual' ? plan.annual : plan.monthly;
    const ciclo = billing === 'anual' ? 'ANUAL' : 'MENSAL';
    const nomePlano = `${plan.name} — ${billing === 'anual' ? 'Plano anual' : 'Plano mensal'}`;
    const documentoField = documento.length === 14 ? { cnpj: documento } : { cpf: documento };
    const transaction = await sequelize.transaction();
    let cliente;
    let recorrencia;

    try {
      cliente = await Cliente.create({
        nomeCompleto: nome,
        ...documentoField,
        telefone,
        email,
        empresa_id: config.empresa_id,
      }, { transaction });

      recorrencia = await Recorrencia.create({
        cliente_id: cliente.id,
        nomeCliente: nome,
        produto: nomePlano,
        tipoTransacao: 'ENTRADA',
        tempoRecorrencia: ciclo,
        valorMes: valor,
        formaPagamento: 'CARTAO_CREDITO',
        dataInicio: hoje,
        proximoVencimento: hoje,
        // A assinatura só fica ativa após o webhook do Asaas. Um formulário
        // iniciado na landing não deve inflar assinantes nem valores previstos.
        ativo: false,
        statusRecorrencia: 'PENDENTE_CHECKOUT',
        asaasSyncStatus: 'NAO_CONFIGURADO',
        observacoes: `Origem: landing Lucro+. Plano ${plan.code}. Código comercial: ${intent}`,
        empresa_id: config.empresa_id,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    try {
      const checkout = await this.createCheckout(
        recorrencia.id,
        { tipo: 'MASTER', empresa_id_override: config.empresa_id },
        intent
      );
      return {
        checkoutUrl: checkout.checkout?.checkout_url || null,
        checkoutStatus: checkout.checkout?.checkout_status || null,
        plan: plan.name,
        billing,
        value: valor,
      };
    } catch (error) {
      await recorrencia.update({ ativo: false, statusRecorrencia: 'PAUSADA', asaasSyncStatus: 'ERRO', asaasSyncError: String(error.message || 'Falha ao criar checkout').slice(0, 500) });
      throw error;
    }
  }

  async createPublicLandingCheckout(data = {}, requestId) {
    const plan = landingPlan(data.plan);
    const billing = String(data.billing || '').trim().toLowerCase();
    const nome = normalizeLandingText(data.nome, 160);
    const email = normalizeLandingText(data.email, 200).toLowerCase();
    const telefone = normalizeLandingPhone(data.telefone);
    const documento = normalizeLandingDocument(data.documento);

    if (!plan) throw new Error('Plano inválido');
    if (!['mensal', 'anual'].includes(billing)) throw new Error('Periodicidade inválida');
    if (nome.length < 3) throw new Error('Informe seu nome completo');
    if (!validEmail(email)) throw new Error('Informe um e-mail válido');
    if (telefone.length < 10) throw new Error('Informe um telefone válido');
    if (![11, 14].includes(documento.length)) throw new Error('Informe um CPF ou CNPJ válido');

    const config = await this.publicLandingConfig();
    if (!config) throw new Error('O checkout ainda não está disponível. Fale com nosso time comercial.');

    const intent = String(requestId || crypto.randomUUID()).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120) || crypto.randomUUID();
    const existing = await AsaasCheckout.findOne({
      where: { integration_id: config.id, request_id: intent },
      order: [['created_at', 'DESC']]
    });
    if (existing?.checkout_url) {
      return { checkoutUrl: existing.checkout_url, checkoutStatus: existing.checkout_status, plan: plan.name, billing };
    }

    const hoje = today();
    const valor = billing === 'anual' ? plan.annual : plan.monthly;
    const ciclo = billing === 'anual' ? 'ANUAL' : 'MENSAL';
    const nomePlano = `${plan.name} — ${billing === 'anual' ? 'Plano anual' : 'Plano mensal'}`;
    const documentoField = documento.length === 14 ? { cnpj: documento } : { cpf: documento };
    const transaction = await sequelize.transaction();
    let cliente;
    let recorrencia;

    try {
      cliente = await Cliente.create({
        nomeCompleto: nome,
        ...documentoField,
        telefone,
        email,
        empresa_id: config.empresa_id,
      }, { transaction });

      recorrencia = await Recorrencia.create({
        cliente_id: cliente.id,
        nomeCliente: nome,
        produto: nomePlano,
        tipoTransacao: 'ENTRADA',
        tempoRecorrencia: ciclo,
        valorMes: valor,
        formaPagamento: 'CARTAO_CREDITO',
        dataInicio: hoje,
        proximoVencimento: hoje,
        ativo: true,
        statusRecorrencia: 'ATIVA',
        asaasSyncStatus: 'NAO_CONFIGURADO',
        observacoes: `Origem: landing Lucro+. Plano ${plan.code}. Código comercial: ${intent}`,
        empresa_id: config.empresa_id,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    try {
      const checkout = await this.createCheckout(
        recorrencia.id,
        { tipo: 'MASTER', empresa_id_override: config.empresa_id },
        intent
      );
      return {
        checkoutUrl: checkout.checkout?.checkout_url || null,
        checkoutStatus: checkout.checkout?.checkout_status || null,
        plan: plan.name,
        billing,
        value: valor,
      };
    } catch (error) {
      await recorrencia.update({ ativo: false, statusRecorrencia: 'PAUSADA', asaasSyncStatus: 'ERRO', asaasSyncError: String(error.message || 'Falha ao criar checkout').slice(0, 500) });
      throw error;
    }
  }

  async getCheckout(id, user) {
    const { empresaId } = await this.getRecorrencia(id, user);
    const checkout = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, recorrencia_id: id }, order: [['created_at', 'DESC']] });
    return checkout ? checkout.toJSON() : null;
  }

  async regenerateCheckout(id, user, requestId) {
    const { empresaId } = await this.getRecorrencia(id, user);
    const latest = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, recorrencia_id: id }, order: [['created_at', 'DESC']] });
    if (latest && !['EXPIRADO', 'CANCELADO', 'FALHA'].includes(latest.checkout_status)) throw new Error('O Checkout atual ainda está ativo e não precisa ser substituído');
    return this.createCheckout(id, user, requestId || crypto.randomUUID());
  }

  async listPayments(id, user) {
    const { recorrencia, empresaId } = await this.getRecorrencia(id, user);
    const config = await this.configByEmpresa(empresaId);
    if (!config) throw new Error('Asaas não configurado para esta empresa');
    const checkout = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, recorrencia_id: id }, order: [['created_at', 'DESC']] });
    const subscriptionId = recorrencia.asaasSubscriptionId || checkout?.asaas_subscription_id;
    if (!subscriptionId) return [];
    const result = await this.request(config, `/subscriptions/${subscriptionId}/payments`);
    return (result?.data || []).map((payment) => ({ id: payment.id, status: payment.status, value: payment.value, dueDate: payment.dueDate, paymentDate: payment.paymentDate, invoiceUrl: payment.invoiceUrl, bankSlipUrl: payment.bankSlipUrl, billingType: payment.billingType, refundedValue: payment.refundedValue, refundStatus: payment.refundStatus }));
  }

  async processWebhookForConfig(config, req) {
    if (!config?.webhook_auth_token_encrypted) throw new Error('Webhook Asaas não configurado');
    const receivedToken = req.header('asaas-access-token');
    if (!timingSafeTokenEquals(receivedToken, decryptCredential(config.webhook_auth_token_encrypted))) throw new Error('Webhook Asaas não autorizado');

    const payload = req.body || {};
    const payment = payload.payment || {};
    const checkoutPayload = payload.checkout || payload.resource || {};
    const subscription = payload.subscription || payload.resource || {};
    const resource = payload.event?.startsWith('CHECKOUT_')
      ? checkoutPayload
      : SUBSCRIPTION_EVENTS.includes(payload.event)
        ? subscription
        : payment;
    const eventId = String(payload.id || `${payload.event || 'EVENT'}:${resource.id || 'none'}:${resource.updatedDate || Date.now()}`).slice(0, 120);
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query('INSERT INTO asaas_webhook_eventos (empresa_id, evento_id, evento, integration_id, tipo_evento, resource_id, processamento_status, payload, processado_em) VALUES (:empresaId, :eventId, :evento, :integrationId, :tipoEvento, :resourceId, :status, :payload, NOW())', {
        replacements: { empresaId: config.empresa_id, eventId, evento: payload.event || 'UNKNOWN', integrationId: config.id, tipoEvento: payload.event || 'UNKNOWN', resourceId: resource.id || null, status: 'PROCESSADO', payload: JSON.stringify(payload) },
        transaction
      });
    } catch (error) {
      await transaction.rollback();
      if (error?.original?.code === '23505') return { duplicate: true };
      throw error;
    }

    try {
      const empresaId = config.empresa_id;
      const externalReference = String(resource.externalReference || '');
      const checkoutReference = externalReference.match(/lucromais:checkout:([a-f0-9]+):recorrencia:(\d+):empresa:(\d+)/i);
      let checkout = null;
      if (checkoutPayload.id || checkoutReference) {
        const where = [{ empresa_id: empresaId }];
        if (checkoutPayload.id) where.push({ asaas_checkout_id: checkoutPayload.id });
        if (checkoutReference) where.push({ recorrencia_id: Number(checkoutReference[2]) });
        checkout = await AsaasCheckout.findOne({ where: { empresa_id: empresaId, [Op.or]: where.slice(1) }, order: [['created_at', 'DESC']], transaction });
      }

      const checkoutStatus = checkoutStatusForEvent(payload.event);
      if (checkout && checkoutStatus) {
        const updates = { checkout_status: checkoutStatus, last_error_code: null };
        if (payload.event === 'CHECKOUT_PAID') {
          updates.paid_at = new Date();
          updates.asaas_subscription_id = checkoutPayload.subscription?.id || checkout.asaas_subscription_id;
          updates.subscription_status = checkoutPayload.subscription?.status || 'ACTIVE';
        }
        if (payload.event === 'CHECKOUT_CANCELED') updates.canceled_at = new Date();
        await checkout.update(updates, { transaction });
        if (payload.event === 'CHECKOUT_PAID') {
          const checkoutRecorrencia = await Recorrencia.findOne({ where: { id: checkout.recorrencia_id, empresa_id: empresaId }, transaction });
          if (checkoutRecorrencia) {
            await checkoutRecorrencia.update({
              asaasSubscriptionId: updates.asaas_subscription_id,
              asaasStatus: updates.subscription_status,
              asaasLastSyncedAt: new Date()
            }, { transaction });
          }
        }
      }

      if (SUBSCRIPTION_EVENTS.includes(payload.event)) {
        const subscriptionReference = externalReference.match(/lucromais:recorrencia:(\d+):empresa:(\d+)/i);
        const subscriptionWhere = [{ empresa_id: empresaId }];
        if (resource.id) subscriptionWhere.push({ asaas_subscription_id: resource.id });
        if (subscriptionReference) subscriptionWhere.push({ id: Number(subscriptionReference[1]) });
        const subscriptionRecorrencia = await Recorrencia.findOne({ where: { empresa_id: empresaId, [Op.or]: subscriptionWhere.slice(1) }, transaction });
        if (subscriptionRecorrencia) {
          const statusAsaas = resource.status || payload.event;
          const statusRecorrencia = payload.event === 'SUBSCRIPTION_DELETED' || statusAsaas === 'DELETED'
            ? 'CANCELADA'
            : statusAsaas === 'INACTIVE' ? 'PAUSADA' : 'ATIVA';
          const statusAnterior = subscriptionRecorrencia.statusRecorrencia || (subscriptionRecorrencia.ativo ? 'ATIVA' : 'PAUSADA');
          await subscriptionRecorrencia.update({
            asaasStatus: statusAsaas,
            asaasSubscriptionStatus: statusAsaas,
            asaasSyncStatus: 'SINCRONIZADO',
            asaasSyncError: null,
            asaasLastSyncedAt: new Date(),
            statusRecorrencia,
            ativo: statusRecorrencia === 'ATIVA'
          }, { transaction });
          await RecorrenciaAuditoria.create({
            empresa_id: empresaId,
            recorrencia_id: subscriptionRecorrencia.id,
            acao: 'WEBHOOK_ASSINATURA',
            statusAnterior,
            statusNovo: statusRecorrencia,
            eventoAsaas: payload.event,
            respostaAsaas: resource
          }, { transaction });
        }
        await transaction.commit();
        return { processed: Boolean(subscriptionRecorrencia) };
      }

      if (!PAYMENT_EVENTS.includes(payload.event)) {
        await transaction.commit();
        return checkout ? { processed: true, checkoutStatus: checkoutStatus || checkout.checkout_status } : { ignored: true };
      }

      const reference = externalReference;
      const match = reference.match(/lucromais:(?:recorrencia|checkout):(?:[a-f0-9]+:)?(?:recorrencia:)?(\d+):empresa:(\d+)/i);
      const conditions = [];
      if (payment.subscription) conditions.push({ asaas_subscription_id: payment.subscription });
      if (match) conditions.push({ id: Number(match[1]) });
      if (checkout) conditions.push({ id: checkout.recorrencia_id });
      if (!conditions.length) {
        await transaction.commit();
        return { ignored: true };
      }
      const recorrencia = await Recorrencia.findOne({ where: { empresa_id: empresaId, [Op.or]: conditions }, transaction });
      if (!recorrencia) {
        await transaction.commit();
        return { ignored: true };
      }

      const status = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(payload.event)
        ? 'PAGO'
        : payload.event === 'PAYMENT_OVERDUE' ? 'ATRASADO'
          : payload.event === 'PAYMENT_REFUND_IN_PROGRESS' ? 'ESTORNO_EM_PROCESSAMENTO'
            : payload.event === 'PAYMENT_PARTIALLY_REFUNDED' ? 'ESTORNADO_PARCIAL'
              : payload.event === 'PAYMENT_REFUNDED' ? 'ESTORNADO'
                : payload.event === 'PAYMENT_DELETED' ? 'CANCELADO'
                  : payload.event.startsWith('PAYMENT_CHARGEBACK') ? 'ESTORNO_EM_PROCESSAMENTO'
                    : 'PENDENTE';
      const asaasStatus = payment.status || payload.event;
      await recorrencia.update({ asaasStatus, asaasSyncStatus: 'SINCRONIZADO', asaasSyncError: null, asaasLastSyncedAt: new Date() }, { transaction });
      if (!payment.id) {
        await transaction.commit();
        return { processed: true };
      }

      const vencimento = parseDate(payment.dueDate) || today();
      let historico = await HistoricoPagamento.findOne({ where: { empresa_id: empresaId, asaas_payment_id: payment.id }, transaction });
      if (!historico) historico = await HistoricoPagamento.findOne({ where: { empresa_id: empresaId, recorrencia_id: recorrencia.id, dataVencimento: vencimento }, transaction });
      const statusAnterior = historico?.status || null;
      const pagamento = ['PAGO', 'PAGO_ATRASADO'].includes(status) ? parseDate(payment.paymentDate) || today() : null;
      const values = {
        status,
        dataPagamento: pagamento,
        asaasPaymentId: payment.id,
        asaasStatus,
        asaasInvoiceUrl: payment.invoiceUrl || null,
        asaasRefundStatus: payment.refundStatus || (status.startsWith('ESTORNO') || status === 'ESTORNADO' ? status : null),
        asaasRefundedValue: payment.refundedValue ?? payment.refundValue ?? null,
        asaasBillingType: payment.billingType || null,
        asaasPaymentPayload: payment,
        valor: Number(payment.value || recorrencia.valorMes)
      };
      if (!historico) {
        historico = await HistoricoPagamento.create({ recorrencia_id: recorrencia.id, empresa_id: empresaId, dataVencimento: vencimento, dataPagamento: pagamento, valor: values.valor, mesReferencia: vencimento.slice(0, 7), ...values }, { transaction });
      } else {
        await historico.update(values, { transaction });
      }
      await RecorrenciaAuditoria.create({
        empresa_id: empresaId,
        recorrencia_id: recorrencia.id,
        historico_pagamento_id: historico.id,
        acao: 'WEBHOOK_PAGAMENTO',
        statusAnterior,
        statusNovo: status,
        eventoAsaas: payload.event,
        respostaAsaas: payment
      }, { transaction });
      await transaction.commit();
      return { processed: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async processWebhook(empresaId, req) {
    const config = await AsaasIntegracao.findOne({ where: { empresa_id: empresaId, ativo: true } });
    return this.processWebhookForConfig(config, req);
  }

  async processWebhookByPublicId(publicId, req) {
    const config = await AsaasIntegracao.findOne({ where: { public_id: publicId, ativo: true } });
    return this.processWebhookForConfig(config, req);
  }

  checkoutCallback(status, res) {
    const messages = { success: 'Checkout concluído. O status financeiro será confirmado pelo Asaas.', cancel: 'Checkout cancelado pelo cliente.', expired: 'Este Checkout expirou. Gere um novo link no LucroMais.' };
    res.status(200).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Asaas - LucroMais</title><body style="font-family:Arial,sans-serif;padding:40px;color:#26364d"><h2>${messages[status] || messages.success}</h2><p>Você pode fechar esta página.</p></body></html>`);
  }
}

export default new AsaasService();
