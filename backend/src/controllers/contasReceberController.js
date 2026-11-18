import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import ContaReceber from '../models/ContaReceber.js';
import Cliente from '../models/Cliente.js';
import Venda from '../models/Venda.js';
import NotaFiscalEmitida from '../models/NotaFiscalEmitida.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const STATUS_VALIDOS = new Set(['ABERTA', 'PAGA', 'CANCELADA']);
const ORIGENS_VALIDAS = new Set(['MANUAL', 'VENDA', 'NF_E', 'RECORRENCIA']);

const hoje = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const dataValida = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : String(value);
};

const numero = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const escopoEmpresa = (req) => empresaParaGravar(req.user);

const validarEmpresaRelacionada = async ({ empresaId, clienteId, vendaId, notaFiscalId }) => {
  if (clienteId) {
    const cliente = await Cliente.findOne({ where: { id: clienteId, empresa_id: empresaId } });
    if (!cliente) throw Object.assign(new Error('Cliente não pertence à empresa selecionada'), { status: 400 });
  }
  let venda = null;
  if (vendaId) {
    venda = await Venda.findOne({ where: { id: vendaId, empresa_id: empresaId } });
    if (!venda) throw Object.assign(new Error('Venda não pertence à empresa selecionada'), { status: 400 });
  }
  let nota = null;
  if (notaFiscalId) {
    nota = await NotaFiscalEmitida.findOne({ where: { id: notaFiscalId, empresa_id: empresaId } });
    if (!nota) throw Object.assign(new Error('Nota fiscal não pertence à empresa selecionada'), { status: 400 });
  }
  return { venda, nota };
};

const montarPayload = (body, empresaId, usuarioId) => {
  const valor = Math.round(numero(body.valor) * 100) / 100;
  const dataVencimento = dataValida(body.data_vencimento);
  if (!empresaId) throw Object.assign(new Error('Selecione uma empresa antes de criar a conta a receber'), { status: 400 });
  if (!body.descricao?.trim()) throw Object.assign(new Error('Informe a descrição da conta a receber'), { status: 400 });
  if (valor <= 0) throw Object.assign(new Error('O valor deve ser maior que zero'), { status: 400 });
  if (!dataVencimento) throw Object.assign(new Error('Informe uma data de vencimento válida'), { status: 400 });

  const status = String(body.status || 'ABERTA').toUpperCase();
  if (!STATUS_VALIDOS.has(status)) throw Object.assign(new Error('Status da conta a receber inválido'), { status: 400 });
  const origem = String(body.origem || 'MANUAL').toUpperCase();
  if (!ORIGENS_VALIDAS.has(origem)) throw Object.assign(new Error('Origem da conta a receber inválida'), { status: 400 });

  const paga = status === 'PAGA';
  return {
    empresa_id: empresaId,
    cliente_id: body.cliente_id ? Number(body.cliente_id) : null,
    venda_id: body.venda_id ? Number(body.venda_id) : null,
    nota_fiscal_id: body.nota_fiscal_id ? Number(body.nota_fiscal_id) : null,
    origem,
    descricao: String(body.descricao).trim(),
    valor,
    valor_pago: paga ? valor : Math.min(Math.max(numero(body.valor_pago), 0), valor),
    data_emissao: dataValida(body.data_emissao) || hoje(),
    data_vencimento: dataVencimento,
    data_pagamento: paga ? (dataValida(body.data_pagamento) || hoje()) : null,
    status,
    observacao: body.observacao ? String(body.observacao).trim() : null,
    criado_por: usuarioId || null,
  };
};

export const listar = async (req, res) => {
  try {
    const empresaId = escopoEmpresa(req);
    const { status, busca, dataInicio, dataFim } = req.query;
    const where = [];
    const replacements = {};
    if (empresaId) { where.push('cr.empresa_id = :empresaId'); replacements.empresaId = empresaId; }
    if (status && STATUS_VALIDOS.has(String(status).toUpperCase())) {
      where.push('cr.status = :status'); replacements.status = String(status).toUpperCase();
    }
    if (busca?.trim()) {
      where.push('(cr.descricao ILIKE :busca OR c."nomeCompleto" ILIKE :busca OR CAST(cr.venda_id AS TEXT) ILIKE :busca)');
      replacements.busca = `%${String(busca).trim()}%`;
    }
    const inicio = dataValida(dataInicio);
    const fim = dataValida(dataFim);
    if (inicio) { where.push('cr.data_vencimento >= :dataInicio'); replacements.dataInicio = inicio; }
    if (fim) { where.push('cr.data_vencimento <= :dataFim'); replacements.dataFim = fim; }

    const rows = await sequelize.query(`
      SELECT cr.*, c."nomeCompleto" AS cliente_nome, c.telefone AS cliente_telefone,
             n.numero AS nota_numero, n.serie AS nota_serie,
             v.valor_total AS venda_valor
        FROM contas_receber cr
        LEFT JOIN clientes c ON c.id = cr.cliente_id
        LEFT JOIN notas_fiscais_emitidas n ON n.id = cr.nota_fiscal_id
        LEFT JOIN vendas v ON v.id = cr.venda_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY cr.data_vencimento ASC, cr.created_at DESC
       LIMIT 2000
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    return res.json(rows);
  } catch (error) {
    console.error('Erro ao listar contas a receber:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const criar = async (req, res) => {
  try {
    const empresaId = escopoEmpresa(req);
    const payload = montarPayload(req.body, empresaId, req.user?.id);
    const { venda, nota } = await validarEmpresaRelacionada({
      empresaId,
      clienteId: payload.cliente_id,
      vendaId: payload.venda_id,
      notaFiscalId: payload.nota_fiscal_id,
    });
    if (venda && !payload.cliente_id) payload.cliente_id = venda.cliente_id || null;
    if (nota && !payload.venda_id) payload.venda_id = nota.venda_id || null;

    const relacionamentos = [
      payload.venda_id ? { venda_id: payload.venda_id } : null,
      payload.nota_fiscal_id ? { nota_fiscal_id: payload.nota_fiscal_id } : null
    ].filter(Boolean);
    const whereDuplicada = relacionamentos.length
      ? { empresa_id: empresaId, status: { [Op.ne]: 'CANCELADA' }, [Op.or]: relacionamentos }
      : null;
    const existente = whereDuplicada ? await ContaReceber.findOne({ where: whereDuplicada }) : null;
    const conta = existente ? await existente.update(payload) : await ContaReceber.create(payload);
    return res.status(existente ? 200 : 201).json(conta);
  } catch (error) {
    console.error('Erro ao criar conta a receber:', error);
    return res.status(error.status || 400).json({ error: error.message });
  }
};

export const atualizar = async (req, res) => {
  try {
    const empresaId = escopoEmpresa(req);
    const where = { id: req.params.id };
    if (empresaId) where.empresa_id = empresaId;
    const conta = await ContaReceber.findOne({ where });
    if (!conta) return res.status(404).json({ error: 'Conta a receber não encontrada' });

    const updates = {};
    if (req.body.data_vencimento !== undefined) {
      const dataVencimento = dataValida(req.body.data_vencimento);
      if (!dataVencimento) return res.status(400).json({ error: 'Informe uma data de vencimento válida' });
      updates.data_vencimento = dataVencimento;
    }
    if (req.body.descricao !== undefined) {
      if (!String(req.body.descricao).trim()) return res.status(400).json({ error: 'Informe a descrição da conta a receber' });
      updates.descricao = String(req.body.descricao).trim();
    }
    if (req.body.observacao !== undefined) updates.observacao = req.body.observacao ? String(req.body.observacao).trim() : null;
    if (req.body.status !== undefined) {
      const status = String(req.body.status).toUpperCase();
      if (!STATUS_VALIDOS.has(status)) return res.status(400).json({ error: 'Status da conta a receber inválido' });
      updates.status = status;
      if (status === 'PAGA') {
        updates.valor_pago = conta.valor;
        updates.data_pagamento = dataValida(req.body.data_pagamento) || hoje();
      } else if (status === 'ABERTA') {
        updates.valor_pago = 0;
        updates.data_pagamento = null;
      } else if (status === 'CANCELADA') {
        updates.valor_pago = 0;
        updates.data_pagamento = null;
      }
    }
    await conta.update(updates);
    return res.json(conta);
  } catch (error) {
    console.error('Erro ao atualizar conta a receber:', error);
    return res.status(500).json({ error: error.message });
  }
};
