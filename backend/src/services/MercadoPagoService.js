import axios from 'axios';

const mercadoPagoApi = axios.create({
  baseURL: 'https://api.mercadopago.com',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const configuracao = () => {
  const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    const error = new Error('Mercado Pago ainda não foi configurado no ambiente do servidor.');
    error.status = 503;
    throw error;
  }

  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const apiUrl = String(
    process.env.PUBLIC_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'),
  ).replace(/\/$/, '');

  return { accessToken, frontendUrl, apiUrl };
};

const headers = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

const mensagemMercadoPago = (error) => String(
  error.response?.data?.message ||
  error.response?.data?.cause?.[0]?.description ||
  error.response?.data?.error ||
  error.message ||
  'Erro desconhecido no Mercado Pago.',
).trim();

const pixSemChaveHabilitada = (detalhe) => {
  const texto = String(detalhe || '').toLowerCase();
  return texto.includes('collector user without key enabled') ||
    texto.includes('key enabled for qr');
};

const calcularMaxParcelas = (valor) => {
  const centavos = Math.round(Math.max(0, Number(valor) || 0) * 100);
  if (centavos <= 4990) return 1;
  return Math.min(12, 2 + Math.floor((centavos - 4991) / 2500));
};

const normalizarItem = (item) => {
  const quantidade = Number(item.quantidade || 0);
  const valorUnitario = Number(item.valor_unitario || 0);
  const valorTotal = Number(item.valor_total ?? quantidade * valorUnitario);
  const quantidadeInteira = Number.isInteger(quantidade) && quantidade > 0;

  return {
    id: String(item.produto_id || item.id || item.nome_item),
    title: quantidadeInteira ? String(item.nome_item || 'Produto') : `${String(item.nome_item || 'Produto')} (${quantidade.toLocaleString('pt-BR')} kg)`,
    quantity: quantidadeInteira ? quantidade : 1,
    unit_price: Number((quantidadeInteira ? valorUnitario : valorTotal).toFixed(2)),
    currency_id: 'BRL',
  };
};

const separarNome = (nome) => {
  const partes = String(nome || 'Cliente').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: partes.shift() || 'Cliente',
    last_name: partes.join(' ') || 'Saúde e Vida',
  };
};

class MercadoPagoService {
  async criarPagamento({ venda, empresaId, cliente, pagamento, valorTotal }) {
    const { accessToken, apiUrl } = configuracao();
    const tipo = String(pagamento?.tipo || '').toLowerCase() === 'pix' ? 'pix' : 'cartao';
    const cpf = String(pagamento?.cpf || pagamento?.identification_number || '').replace(/\D/g, '');
    const tipoIdentificacao = String(pagamento?.identification_type || 'CPF').toUpperCase();
    const tamanhoIdentificacao = tipoIdentificacao === 'CNPJ' ? 14 : 11;
    if (tipo === 'cartao' && cpf.length !== tamanhoIdentificacao) {
      throw new Error(`Informe um ${tipoIdentificacao === 'CNPJ' ? 'CNPJ' : 'CPF'} válido com ${tamanhoIdentificacao} dígitos.`);
    }
    const nome = separarNome(pagamento?.cardholder_name || cliente?.nomeCompleto);
    const payer = {
      ...nome,
      email: String(cliente?.email || '').trim(),
    };
    if (!payer.email) throw new Error('Informe um e-mail válido para concluir o pagamento.');
    if (cpf.length >= 11) {
      payer.identification = {
        type: tipoIdentificacao,
        number: cpf,
      };
    }

    const externalReference = `loja:${empresaId}:pedido:${venda.id}`;
    const payload = {
      transaction_amount: Number(Number(valorTotal).toFixed(2)),
      description: `Pedido #${venda.id} - Saúde e Vida`,
      payer,
      external_reference: externalReference,
      notification_url: `${apiUrl}/api/loja/mercado-pago/webhook`,
      metadata: { empresa_id: empresaId, venda_id: venda.id },
      payment_method_id: tipo === 'pix' ? 'pix' : String(pagamento?.payment_method_id || '').trim(),
    };

    if (tipo === 'pix') {
      // Mantém o QR válido por 24 horas, conforme o fluxo de pagamentos Pix.
      payload.date_of_expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    if (tipo === 'cartao') {
      if (!String(pagamento?.token || '').trim() || !payload.payment_method_id) {
        throw new Error('Preencha os dados do cartão para concluir o pagamento.');
      }
      payload.token = String(pagamento.token).trim();
      const parcelas = Number.parseInt(String(pagamento.installments || '1'), 10);
      const maxParcelas = calcularMaxParcelas(valorTotal);
      payload.installments = Math.min(
        maxParcelas,
        Number.isInteger(parcelas) && parcelas > 0 ? parcelas : 1,
      );
      const emissor = Number(pagamento.issuer_id);
      if (Number.isInteger(emissor) && emissor > 0) payload.issuer_id = emissor;
    }

    try {
      const opcoesPagamento = {
        headers: {
          ...headers(accessToken),
          'X-Idempotency-Key': `loja-pedido-${venda.id}-pagamento`,
        },
      };
      let response;
      try {
        response = await mercadoPagoApi.post('/v1/payments', payload, opcoesPagamento);
      } catch (error) {
        const detalhe = mensagemMercadoPago(error).toLowerCase();
        // Algumas bandeiras/bancos não aceitam a quantidade escolhida. Como a
        // primeira tentativa foi rejeitada, 1x é uma alternativa segura para
        // concluir a compra sem criar uma cobrança duplicada.
        if (tipo === 'cartao' && payload.installments !== 1 && detalhe.includes('invalid installments')) {
          response = await mercadoPagoApi.post('/v1/payments', { ...payload, installments: 1 }, opcoesPagamento);
        } else {
          throw error;
        }
      }
      const data = response.data || {};
      const transactionData = data.point_of_interaction?.transaction_data || {};
      return {
        id: data.id,
        status: data.status || 'pending',
        status_detail: data.status_detail || null,
        payment_method_id: data.payment_method_id || payload.payment_method_id,
        external_reference: externalReference,
        pix: tipo === 'pix' ? {
          qr_code: transactionData.qr_code || null,
          qr_code_base64: transactionData.qr_code_base64 || null,
          ticket_url: transactionData.ticket_url || null,
        } : null,
      };
    } catch (error) {
      const detalhe = mensagemMercadoPago(error);
      if (tipo === 'cartao' && /invalid\s+card[_ ]token[_ ]id/i.test(detalhe)) {
        const wrapped = new Error(
          'Não foi possível validar este cartão. Atualize a página e preencha os dados do cartão novamente.',
        );
        wrapped.code = 'MERCADOPAGO_INVALID_CARD_TOKEN';
        wrapped.status = 422;
        throw wrapped;
      }
      if (tipo === 'pix' && pixSemChaveHabilitada(detalhe)) {
        const wrapped = new Error(
          'O Pix ainda não está habilitado na conta do Mercado Pago. Cadastre uma chave Pix e habilite o recebimento por QR Code na conta usada pelas credenciais de produção, depois tente novamente.',
        );
        wrapped.code = 'MERCADOPAGO_PIX_NOT_ENABLED';
        wrapped.status = 422;
        throw wrapped;
      }
      const wrapped = new Error(`Não foi possível processar o pagamento: ${detalhe}`);
      wrapped.status = error.response?.status >= 400 && error.response.status < 500 ? 422 : 502;
      throw wrapped;
    }
  }

  async criarPreferencia({ venda, empresaId, cliente, itens }) {
    const { accessToken, frontendUrl, apiUrl } = configuracao();
    const externalReference = `loja:${empresaId}:pedido:${venda.id}`;
    const payload = {
      items: itens.map(normalizarItem),
      payer: {
        name: cliente?.nomeCompleto || undefined,
        email: cliente?.email || undefined,
      },
      external_reference: externalReference,
      notification_url: `${apiUrl}/api/loja/mercado-pago/webhook`,
      back_urls: {
        success: `${frontendUrl}/loja?pagamento=sucesso&pedido=${venda.id}`,
        failure: `${frontendUrl}/loja?pagamento=falhou&pedido=${venda.id}`,
        pending: `${frontendUrl}/loja?pagamento=pendente&pedido=${venda.id}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'SAUDE E VIDA',
      metadata: { empresa_id: empresaId, venda_id: venda.id },
    };

    try {
      const response = await mercadoPagoApi.post('/checkout/preferences', payload, { headers: headers(accessToken) });
      return {
        id: response.data.id,
        init_point: response.data.init_point,
        sandbox_init_point: response.data.sandbox_init_point,
        external_reference: externalReference,
      };
    } catch (error) {
      const detalhe = error.response?.data?.message || error.response?.data?.error || error.message;
      const wrapped = new Error(`Não foi possível criar o checkout do Mercado Pago: ${detalhe}`);
      wrapped.status = error.response?.status >= 400 && error.response.status < 500 ? 422 : 502;
      throw wrapped;
    }
  }

  async consultarPagamento(paymentId) {
    const { accessToken } = configuracao();
    try {
      const response = await mercadoPagoApi.get(`/v1/payments/${encodeURIComponent(paymentId)}`, { headers: headers(accessToken) });
      return response.data;
    } catch (error) {
      const wrapped = new Error('Não foi possível consultar o pagamento no Mercado Pago.');
      wrapped.status = error.response?.status >= 400 && error.response.status < 500 ? 422 : 502;
      throw wrapped;
    }
  }

  async reembolsarPagamento(paymentId, idempotencyKey) {
    const { accessToken } = configuracao();
    const key = String(idempotencyKey || '').trim();
    if (!key) throw new Error('A chave de idempotência do reembolso não foi informada.');
    try {
      const response = await mercadoPagoApi.post(
        `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
        {},
        { headers: { ...headers(accessToken), 'X-Idempotency-Key': key } },
      );
      return response.data;
    } catch (error) {
      const detalhe = error.response?.data?.message || error.response?.data?.error || error.message;
      const wrapped = new Error(`Não foi possível solicitar o reembolso no Mercado Pago: ${detalhe}`);
      wrapped.status = error.response?.status >= 400 && error.response.status < 500 ? 422 : 502;
      throw wrapped;
    }
  }
}

export default new MercadoPagoService();
