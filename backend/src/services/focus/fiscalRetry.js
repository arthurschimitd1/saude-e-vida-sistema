import {
  fiscalDateTime,
  fiscalDateTimeForBusinessDate
} from '../../utils/businessTime.js';

const CAMPOS_FISCAIS_EDITAVEIS = [
  'cfop',
  'codigo_ncm',
  'cest',
  'icms_origem',
  'icms_situacao_tributaria',
  'pis_situacao_tributaria',
  'cofins_situacao_tributaria'
];

const CAMPOS_DESTINATARIO = {
  nome: 'nome_destinatario',
  cpf: 'cpf_destinatario',
  cnpj: 'cnpj_destinatario',
  inscricao_estadual: 'inscricao_estadual_destinatario',
  telefone: 'telefone_destinatario',
  email: 'email_destinatario',
  rua: 'logradouro_destinatario',
  logradouro: 'logradouro_destinatario',
  numero: 'numero_destinatario',
  complemento: 'complemento_destinatario',
  bairro: 'bairro_destinatario',
  cidade: 'municipio_destinatario',
  municipio: 'municipio_destinatario',
  estado: 'uf_destinatario',
  uf: 'uf_destinatario',
  cep: 'cep_destinatario',
  pais: 'pais_destinatario'
};

const MARCADORES_SEM_IE = new Set(['ISENTO', 'ISENTA', 'NAO CONTRIBUINTE', 'NÃO CONTRIBUINTE']);
const inscricaoEstadualValida = (valor) => {
  const texto = String(valor ?? '').trim();
  return texto && !MARCADORES_SEM_IE.has(texto.toUpperCase()) ? texto : '';
};

export async function carregarClienteDaNota(nota) {
  if (!nota?.venda_id) return null;

  const { default: Venda } = await import('../../models/Venda.js');
  const { default: Cliente } = await import('../../models/Cliente.js');

  const venda = await Venda.findOne({
    where: {
      id: Number(nota.venda_id),
      empresa_id: Number(nota.empresa_id)
    },
    attributes: ['cliente_id']
  });

  if (!venda?.cliente_id) return null;

  return Cliente.findOne({
    where: {
      id: Number(venda.cliente_id),
      empresa_id: Number(nota.empresa_id)
    }
  });
}

export function notaPodeSerReemitida(status) {
  const normalizado = String(status || '').trim().toUpperCase();

  return normalizado.includes('ERRO')
    || normalizado.includes('REJEIT')
    || normalizado.includes('DENEG');
}

export function notaTemEmissaoAtiva(status) {
  const normalizado = String(status || '').trim().toUpperCase();

  // `ERRO_AUTORIZACAO` também contém `AUTORIZ`, mas representa uma
  // tentativa encerrada com falha e não deve bloquear uma nova emissão.
  if (
    normalizado.includes('ERRO')
    || normalizado.includes('REJEIT')
    || normalizado.includes('DENEG')
  ) {
    return false;
  }

  return normalizado.includes('AUTORIZ')
    || normalizado.includes('PROCESS')
    || normalizado.includes('PEND')
    || normalizado.includes('ENVIAD');
}

export function prepararPayloadParaReemissao(
  payloadOriginal,
  ajustes = {},
  { cliente = null, agora = new Date() } = {}
) {
  if (!payloadOriginal || typeof payloadOriginal !== 'object') {
    throw new Error('Esta nota não possui o payload original para refazer a emissão');
  }

  const itensOriginais = Array.isArray(payloadOriginal.items)
    ? payloadOriginal.items
    : null;

  if (!itensOriginais) {
    throw new Error('Esta nota não possui itens fiscais salvos para refazer a emissão');
  }

  const payload = { ...payloadOriginal };
  // A reemissão é um novo documento fiscal. Não reutilize o instante UTC da
  // tentativa rejeitada, especialmente em viradas de dia/mês no Brasil.
  payload.data_emissao = ajustes?.data_emissao
    ? fiscalDateTimeForBusinessDate(ajustes.data_emissao, agora)
    : fiscalDateTime(agora);
  const itens = itensOriginais.map(item => ({ ...item }));
  const ajustesItens = Array.isArray(ajustes?.items) ? ajustes.items : [];

  for (const ajuste of ajustesItens) {
    const indice = Number(ajuste?.index);

    if (!Number.isInteger(indice) || indice < 0 || indice >= itens.length) {
      throw new Error('Um dos itens informados para correção não é válido');
    }

    for (const campo of CAMPOS_FISCAIS_EDITAVEIS) {
      if (ajuste[campo] === undefined || ajuste[campo] === null) continue;

      const valor = String(ajuste[campo]).trim();
      if (valor) itens[indice][campo] = valor;
    }
  }

  aplicarAjusteDestinatario({
    payload,
    ajustes: ajustes.destinatario,
    cliente
  });

  aplicarAjustePagamento({
    payload,
    ajustes: ajustes.pagamento
  });

  return {
    ...payload,
    items: itens
  };
}

function aplicarAjusteDestinatario({ payload, ajustes, cliente }) {
  if (!ajustes || typeof ajustes !== 'object') return;

  const dadosCliente = ajustes.usar_dados_cliente && cliente
    ? {
        nome: cliente.nome ?? cliente.nomeCompleto,
        cpf: cliente.cpf,
        cnpj: cliente.cnpj,
        telefone: cliente.telefone,
        email: cliente.email,
        cep: cliente.cep,
        rua: cliente.rua,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        numero: cliente.numero,
        complemento: cliente.complemento,
        pais: cliente.pais,
        inscricao_estadual: cliente.inscricao_estadual ?? cliente.inscricaoEstadual
      }
    : null;
  const dados = {
    ...(dadosCliente || {}),
    ...ajustes
  };

  for (const [campo, chavePayload] of Object.entries(CAMPOS_DESTINATARIO)) {
    const valor = dados[campo];
    if (valor === undefined || valor === null) continue;

    const texto = String(valor).trim();
    if (campo === 'inscricao_estadual') {
      const inscricao = inscricaoEstadualValida(texto);
      if (inscricao) payload[chavePayload] = inscricao;
      else delete payload[chavePayload];
    } else if (texto) {
      payload[chavePayload] = texto;
    }
  }

  if (payload.cpf_destinatario) delete payload.cnpj_destinatario;
  if (payload.cnpj_destinatario) delete payload.cpf_destinatario;

  if (payload.cep_destinatario) {
    payload.cep_destinatario = String(payload.cep_destinatario).replace(/\D/g, '');
  }

  if (payload.cpf_destinatario) {
    payload.cpf_destinatario = String(payload.cpf_destinatario).replace(/\D/g, '');
  }

  if (payload.cnpj_destinatario) {
    payload.cnpj_destinatario = String(payload.cnpj_destinatario).replace(/\D/g, '');
  }

  if (!inscricaoEstadualValida(payload.inscricao_estadual_destinatario)) {
    delete payload.inscricao_estadual_destinatario;
  }

  if (dados.isento_inscricao_estadual === true) {
    // Focus: 2 = contribuinte isento. A IE não deve acompanhar essa declaração.
    delete payload.inscricao_estadual_destinatario;
    payload.indicador_inscricao_estadual_destinatario = 2;
  } else if (dados.isento_inscricao_estadual === false) {
    // Ao desmarcar no reparo, volta ao comportamento normal em vez de manter
    // acidentalmente uma isenção que estava gravada na tentativa anterior.
    payload.indicador_inscricao_estadual_destinatario = inscricaoEstadualValida(payload.inscricao_estadual_destinatario)
      ? 1
      : 9;
  }
}

function aplicarAjustePagamento({ payload, ajustes }) {
  if (!ajustes || typeof ajustes !== 'object') return;

  const formas = Array.isArray(payload.formas_pagamento)
    ? payload.formas_pagamento.map(forma => ({ ...forma }))
    : [];

  const recebeu = toNumber(ajustes.valor_recebido);
  const trocoInformado = toNumber(ajustes.troco);
  const totalNota = toNumber(payload.valor_total);

  if (recebeu !== null || trocoInformado !== null) {
    if (!formas.length) {
      throw new Error('A nota não possui formas de pagamento salvas para corrigir o recebimento');
    }

    const totalRecebido = recebeu !== null
      ? recebeu
      : totalNota + trocoInformado;
    const somaSemUltimo = formas.slice(0, -1).reduce(
      (total, forma) => total + (toNumber(forma.valor_pagamento) || 0),
      0
    );
    const valorUltimo = roundCurrency(totalRecebido - somaSemUltimo);

    if (valorUltimo < 0) {
      throw new Error('O valor recebido não pode ser menor que os pagamentos já informados');
    }

    formas[formas.length - 1].valor_pagamento = valorUltimo;
    payload.formas_pagamento = formas;

    const troco = trocoInformado !== null
      ? trocoInformado
      : roundCurrency(Math.max(totalRecebido - totalNota, 0));

    payload.troco = troco;
  }
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function classificarErroParaReemissao(nota = {}) {
  const texto = normalizarTexto([
    nota.mensagem_retorno,
    nota.codigo_retorno,
    nota.resposta_provedor
  ].filter(Boolean).map(valor => (
    typeof valor === 'string' ? valor : JSON.stringify(valor)
  )).join(' '));

  const destinatario = contemAlgum(texto, [
    'destinatario', 'cpf do destinatario', 'cnpj do destinatario',
    'documento do destinatario', 'endereco do destinatario',
    'logradouro destinatario', 'cep destinatario', 'municipio destinatario',
    'bairro destinatario', 'nome destinatario', 'identificacao do destinatario'
  ]);

  const pagamento = contemAlgum(texto, [
    'pagamento', 'forma de pagamento', 'formas pagamento',
    'valor dos pagamentos', 'total dos pagamentos', 'soma dos pagamentos',
    'troco', 'valor recebido', 'meio de pagamento'
  ]) || ['865', '866'].includes(String(nota.codigo_retorno || '').trim());

  const itemFiscal = contemAlgum(texto, [
    'ncm', 'cest', 'cfop', 'cst', 'csosn', 'icms', 'pis', 'cofins',
    'origem da mercadoria', 'unidade comercial', 'produto', 'item'
  ]);

  const composicaoChave = String(nota.codigo_retorno || '').trim() === '253'
    || contemAlgum(texto, [
      'digito verificador da chave de acesso',
      'chave de acesso composta invalida'
    ]);

  return {
    destinatario,
    pagamento,
    items: !composicaoChave && (itemFiscal || (!destinatario && !pagamento)),
    erroNaoClassificado: composicaoChave || (!destinatario && !pagamento && !itemFiscal)
  };
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function contemAlgum(texto, termos) {
  return termos.some(termo => texto.includes(termo));
}

export function camposFiscaisEditaveis() {
  return [...CAMPOS_FISCAIS_EDITAVEIS];
}
