import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Saida from '../models/Saida.js';
import TurnoCaixa from '../models/TurnoCaixa.js';
import { prepararSaidaPagamento } from '../utils/saidaPagamento.js';
import Venda from '../models/Venda.js';
import FuncionarioCusto from '../models/FuncionarioCusto.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import { obterCustoMensal } from '../services/financeiro/FuncionarioCustoCalculo.js';
import AutomacaoEngine from '../services/AutomacaoEngine.js';
import CentroCusto from '../models/CentroCusto.js';
import cmvService from '../services/CMVService.js';
import { normalizarPeriodo, filtroDataInclusivo, limitesPeriodoInclusivo } from '../utils/financeiroPeriodo.js';
import { BUSINESS_TIME_ZONE, businessMonthSequence, startOfBusinessDate } from '../utils/businessTime.js';
import {
  chaveMes,
  montarSerieFinanceira,
  STATUS_PAGAMENTO_REALIZADO,
} from '../services/financeiro/DashboardFinanceiroCalculo.js';

async function verificarBudgetCentroCusto(centro_custo_id, empresa_id) {
  if (!centro_custo_id || !empresa_id) return;
  const centro = await CentroCusto.findOne({ where: { id: centro_custo_id, empresa_id } });
  if (!centro) return;
  const [mesAtual] = businessMonthSequence(new Date(), 1);
  const [ano, mes] = mesAtual.key.split('-').map(Number);
  const proximoMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);
  const inicioMes = startOfBusinessDate(`${mesAtual.key}-01`);
  const fimMesExclusivo = startOfBusinessDate(`${proximoMes}-01`);
  const [resultado] = await sequelize.query(
    `SELECT COALESCE(SUM(valor), 0) AS total_gasto
         FROM saidas
         WHERE centro_custo_id = :centroId
           AND empresa_id = :empresa_id
           AND natureza = 'SAIDA'
           AND status != 'cancelado'
           AND data >= :inicioMes
           AND data < :fimMesExclusivo`,
    { replacements: { centroId: centro_custo_id, empresa_id, inicioMes, fimMesExclusivo }, type: sequelize.QueryTypes.SELECT }
  );
  const totalGasto = parseFloat(resultado?.total_gasto || 0);
  const budget = parseFloat(centro.budget);
  if (budget <= 0) return;
  const percentual = (totalGasto / budget) * 100;
  AutomacaoEngine.dispararEvento('budget_atingido', empresa_id, {
    centro_custo_id: centro.id,
    nome: centro.nome,
    budget,
    total_gasto: totalGasto,
    percentual_atingido: Math.round(percentual * 100) / 100,
  });
}

// Resolve o empresa_id a usar nos filtros a partir do usuário autenticado.
// MASTER sem override vê todas as empresas (empresaId null = sem filtro).
const resolverEmpresaId = (req) => empresaParaGravar(req.user);

const exigirEmpresaId = (req, res) => {
  const empresaId = resolverEmpresaId(req);
  if (!empresaId) {
    res.status(400).json({ error: 'Selecione uma empresa para acessar as saídas' });
    return null;
  }
  return Number(empresaId);
};

export const getCMV = async (req, res) => {
  try {
    res.json(await cmvService.relatorio(req.query, req.user));
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

const statusRecorrenciaPagoSql = STATUS_PAGAMENTO_REALIZADO.map(status => `'${status}'`).join(', ');

function filtroEmpresaHistorico(empresaId) {
  return empresaId
    ? 'AND COALESCE(hp.empresa_id, r.empresa_id) = :empresaId'
    : '';
}

function periodoHistorico(dataInicio, dataFim) {
  const filtros = [`hp.status IN (${statusRecorrenciaPagoSql})`];
  const replacements = {};
  const inicio = dataInicio ? normalizarLimiteData(dataInicio) : null;
  const fim = dataFim ? normalizarLimiteData(dataFim, true) : null;
  if (inicio) {
    filtros.push(`COALESCE(hp."dataPagamento", hp."dataVencimento") >= :dataInicio`);
    replacements.dataInicio = inicio;
  }
  if (fim) {
    filtros.push(`COALESCE(hp."dataPagamento", hp."dataVencimento") <= :dataFim`);
    replacements.dataFim = fim;
  }
  return { where: filtros.join(' AND '), replacements };
}

function normalizarLimiteData(data, fimDoDia = false) {
  const valor = String(data || '');
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return `${valor} ${fimDoDia ? '23:59:59.999' : '00:00:00'}`;
  }
  return valor;
}

function dataParaFiltro(data, fimDoDia = false) {
  const valor = String(data || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(`${valor}T${fimDoDia ? '23:59:59.999' : '00:00:00'}`);
  }
  return new Date(valor);
}

function intervaloData(dataInicio, dataFim) {
  const intervalo = {};
  if (dataInicio) intervalo[Op.gte] = dataParaFiltro(dataInicio);
  if (dataFim) intervalo[Op.lte] = dataParaFiltro(dataFim, true);
  return intervalo;
}

function periodoIncluiMesAtual(dataInicio, dataFim) {
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const inicio = dataInicio ? String(dataInicio).slice(0, 7) : null;
  const fim = dataFim ? String(dataFim).slice(0, 7) : null;

  return (!inicio || mesAtual >= inicio) && (!fim || mesAtual <= fim);
}

export const getResumo = async (req, res) => {
  try {
    const { dataInicio, dataFim, funcionarioId } = req.query;

    const empresaId = resolverEmpresaId(req);
    const funcId = funcionarioId ? parseInt(funcionarioId) : null;
    const limites = limitesPeriodoInclusivo(dataInicio, dataFim);

    const buildWhere = (tabela, dataCol = 'data') => {
      const conds = [];
      const repl = {};
      if (limites.inicio) {
        conds.push(`${dataCol} >= :dataInicio`);
        repl.dataInicio = limites.inicio;
      }
      if (limites.fimExclusivo) {
        conds.push(`${dataCol} < :dataFimExclusivo`);
        repl.dataFimExclusivo = limites.fimExclusivo;
      }
      if (empresaId) {
        conds.push(`${tabela}.empresa_id = :empresaId`);
        repl.empresaId = empresaId;
      }
      if (funcId && tabela !== 'saidas') {
        conds.push(`${tabela}.funcionario_id = :funcId`);
        repl.funcId = funcId;
      }
      return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', repl };
    };

    const wVenda = buildWhere('vendas');
    const wSaida = buildWhere('saidas');
    const wComis = buildWhere('comissoes', 'data_pagamento');
    const historicoPeriodo = periodoHistorico(dataInicio, dataFim);
    const whereHistorico = `${historicoPeriodo.where} ${filtroEmpresaHistorico(empresaId)}`;
    const replHistorico = { ...historicoPeriodo.replacements, ...(empresaId ? { empresaId } : {}) };

    const [vendasResult] = await sequelize.query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total FROM vendas ${wVenda.where}`,
      { replacements: wVenda.repl, type: sequelize.QueryTypes.SELECT }
    );

    const [entradasManuaisResult] = await sequelize.query(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM saidas ${wSaida.where ? `${wSaida.where} AND natureza = 'ENTRADA' AND status = 'pago'` : `WHERE natureza = 'ENTRADA' AND status = 'pago'`}`,
      { replacements: wSaida.repl, type: sequelize.QueryTypes.SELECT }
    );

    const [saidasResult] = await sequelize.query(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM saidas ${wSaida.where ? `${wSaida.where} AND natureza = 'SAIDA' AND status = 'pago'` : `WHERE natureza = 'SAIDA' AND status = 'pago'`}`,
      { replacements: wSaida.repl, type: sequelize.QueryTypes.SELECT }
    );

    const [comissoesResult] = await sequelize.query(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM comissoes ${wComis.where ? `${wComis.where} AND status = 'pago'` : `WHERE status = 'pago'`}`,
      { replacements: wComis.repl, type: sequelize.QueryTypes.SELECT }
    );

    const [recEntradaResult] = await sequelize.query(
      `SELECT COALESCE(SUM(hp.valor), 0) AS total
       FROM historico_pagamentos hp
       JOIN recorrencias r ON r.id = hp.recorrencia_id
       WHERE r.tipo_transacao = 'ENTRADA' AND ${whereHistorico}`,
      { replacements: replHistorico, type: sequelize.QueryTypes.SELECT }
    );

    const [recSaidaResult] = await sequelize.query(
      `SELECT COALESCE(SUM(hp.valor), 0) AS total
       FROM historico_pagamentos hp
       JOIN recorrencias r ON r.id = hp.recorrencia_id
       WHERE r.tipo_transacao = 'SAIDA' AND ${whereHistorico}`,
      { replacements: replHistorico, type: sequelize.QueryTypes.SELECT }
    );

    const wFunc = buildWhere('funcionarios_custos', 'dataInicio');
    const replFunc = empresaId ? { empresaId } : {};
    let whereFunc = `WHERE ativo = true AND "datapagamento" IS NOT NULL`;
    if (empresaId) whereFunc += ` AND empresa_id = :empresaId`;
    if (dataInicio || dataFim) {
      const periodo = normalizarPeriodo(dataInicio, dataFim);
      if (periodo.dataInicio) {
        whereFunc += ` AND TO_DATE("datapagamento", 'YYYY-MM') >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`;
        replFunc.dataInicio = periodo.dataInicio;
      }
      if (periodo.dataFimExclusivo) {
        whereFunc += ` AND TO_DATE("datapagamento", 'YYYY-MM') < TO_DATE(:dataFimExclusivo, 'YYYY-MM-DD')`;
        replFunc.dataFimExclusivo = periodo.dataFimExclusivo;
      }
    }

    const [funcCustosResult] = await sequelize.query(
      `SELECT COALESCE(SUM("salarioBruto"), 0) AS total FROM funcionarios_custos ${whereFunc}`,
      { replacements: replFunc, type: sequelize.QueryTypes.SELECT }
    );

    const totalVendas = parseFloat(vendasResult?.total || 0) + parseFloat(recEntradaResult?.total || 0);
    const totalEntradasManuais = parseFloat(entradasManuaisResult?.total || 0);
    const totalEntradas = totalVendas + totalEntradasManuais;
    const totalCustosFuncionarios = parseFloat(funcCustosResult?.total || 0);
    const totalComissoes = parseFloat(comissoesResult?.total || 0);
    const totalSaidas = parseFloat(saidasResult?.total || 0) + parseFloat(recSaidaResult?.total || 0) + totalCustosFuncionarios + totalComissoes;
    const lucro = totalEntradas - totalSaidas;

    res.json({ totalVendas, totalEntradas, totalEntradasManuais, totalSaidas, totalComissoes, lucro, totalCustosFuncionarios });
  } catch (error) {
    console.error('Erro ao buscar resumo financeiro:', error);
    res.status(500).json({ error: error.message });
  }
};

// ================================
// DASHBOARD CONSOLIDADO
// ================================

// GET /api/financeiro/dashboard
export const getDashboard = async (req, res) => {
  try {
    const empresaId = resolverEmpresaId(req);
    const condEmpresaVendas = empresaId ? 'AND empresa_id = :empresaId' : '';
    const condEmpresaRec = empresaId ? 'AND empresa_id = :empresaId' : '';
    const condEmpresaComissoes = empresaId ? 'AND COALESCE(c.empresa_id, v.empresa_id) = :empresaId' : '';
    const repl = empresaId ? { empresaId } : {};

    const hoje = new Date();
    const meses = businessMonthSequence(hoje, 6);
    const seisMesesAtras = startOfBusinessDate(`${meses[0].key}-01`);
    const historicoDashboard = periodoHistorico(seisMesesAtras.toISOString().slice(0, 10));
    const whereHistoricoDashboard = `${historicoDashboard.where} ${filtroEmpresaHistorico(empresaId)}`;
    const replHistoricoDashboard = {
      ...historicoDashboard.replacements,
      ...(empresaId ? { empresaId } : {}),
    };

    const [
      vendasPorMes,
      manualPorMes,
      recorrenciasPagasPorMes,
      comissoesPagasPorMes,
      recorrenciasAtivasResult,
    ] = await Promise.all([
      sequelize.query(
        `SELECT TO_CHAR(data AT TIME ZONE :businessTimeZone, 'YYYY-MM') AS mes,
                COALESCE(SUM(valor_total), 0) AS total
         FROM vendas WHERE data >= :inicio ${condEmpresaVendas} GROUP BY mes`,
        { replacements: { ...repl, inicio: seisMesesAtras, businessTimeZone: BUSINESS_TIME_ZONE }, type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT TO_CHAR(data AT TIME ZONE :businessTimeZone, 'YYYY-MM') AS mes, natureza,
                COALESCE(SUM(valor), 0) AS total
         FROM saidas WHERE data >= :inicio AND status = 'pago' ${condEmpresaVendas} GROUP BY mes, natureza`,
        { replacements: { ...repl, inicio: seisMesesAtras, businessTimeZone: BUSINESS_TIME_ZONE }, type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT TO_CHAR(COALESCE(hp."dataPagamento", hp."dataVencimento") AT TIME ZONE :businessTimeZone, 'YYYY-MM') AS mes,
                r.tipo_transacao,
                COALESCE(SUM(hp.valor), 0) AS total
         FROM historico_pagamentos hp
         JOIN recorrencias r ON r.id = hp.recorrencia_id
         WHERE ${whereHistoricoDashboard}
         GROUP BY mes, r.tipo_transacao`,
        { replacements: { ...replHistoricoDashboard, businessTimeZone: BUSINESS_TIME_ZONE }, type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT TO_CHAR(COALESCE(c.data_pagamento, v.data) AT TIME ZONE :businessTimeZone, 'YYYY-MM') AS mes,
                COALESCE(SUM(c.valor), 0) AS total
         FROM comissoes c
         JOIN vendas v ON v.id = c.venda_id
         WHERE c.status = 'pago'
           AND COALESCE(c.data_pagamento, v.data) >= :inicio
           ${condEmpresaComissoes}
         GROUP BY mes`,
        { replacements: { ...repl, inicio: seisMesesAtras, businessTimeZone: BUSINESS_TIME_ZONE }, type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*)::int AS total FROM recorrencias WHERE ativo = true ${condEmpresaRec}`,
        { replacements: repl, type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const whereFunc = { ativo: true, status: 'ATIVO' };
    if (empresaId) whereFunc.empresa_id = empresaId;
    const funcionarios = await FuncionarioCusto.findAll({ where: whereFunc });
    const custoFolha = funcionarios.reduce((soma, f) => soma + obterCustoMensal(f), 0);

    const vendasPorChave = {};
    vendasPorMes.forEach(v => { vendasPorChave[chaveMes(v.mes)] = parseFloat(v.total); });

    const manualEntradaPorChave = {};
    const manualSaidaPorChave = {};
    manualPorMes.forEach(m => {
      const chave = chaveMes(m.mes);
      if (m.natureza === 'ENTRADA') manualEntradaPorChave[chave] = parseFloat(m.total);
      else manualSaidaPorChave[chave] = parseFloat(m.total);
    });

    const recorrenciaEntradaPorChave = {};
    const recorrenciaSaidaPorChave = {};
    recorrenciasPagasPorMes.forEach((pagamento) => {
      const chave = chaveMes(pagamento.mes);
      const destino = pagamento.tipo_transacao === 'ENTRADA'
        ? recorrenciaEntradaPorChave
        : recorrenciaSaidaPorChave;
      destino[chave] = parseFloat(pagamento.total || 0);
    });

    const comissoesPorChave = {};
    comissoesPagasPorMes.forEach((comissao) => {
      const chave = chaveMes(comissao.mes);
      comissoesPorChave[chave] = parseFloat(comissao.total || 0);
    });

    const mesAtual = chaveMes(hoje);
    const { serieEntradas, serieSaidas } = montarSerieFinanceira({
      meses,
      vendasPorChave,
      manualEntradaPorChave,
      manualSaidaPorChave,
      recorrenciaEntradaPorChave,
      recorrenciaSaidaPorChave,
      comissoesPorChave,
      custoFolha,
      mesAtual,
    });

    const totalEntradas = serieEntradas[serieEntradas.length - 1] || 0;
    const totalSaidas = serieSaidas[serieSaidas.length - 1] || 0;

    res.json({
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      custoFolha,
      comissoesPagas: comissoesPorChave[mesAtual] || 0,
      recorrenciasAtivas: parseInt(recorrenciasAtivasResult[0]?.total || 0, 10),
      serie: {
        labels: meses.map(m => m.label),
        entradas: serieEntradas,
        saidas: serieSaidas,
      },
    });
  } catch (error) {
    console.error('Erro ao montar dashboard financeiro:', error);
    res.status(500).json({ error: error.message });
  }
};

// ================================
// ENTRADAS CONSOLIDADAS (somente leitura)
// ================================

// GET /api/financeiro/entradas
export const listarEntradas = async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const empresaId = resolverEmpresaId(req);

    const whereVenda = {};
    if (empresaId) whereVenda.empresa_id = empresaId;
    const filtroData = filtroDataInclusivo(dataInicio, dataFim, Op);
    if (filtroData) whereVenda.data = filtroData;

    const whereManual = { natureza: 'ENTRADA', status: 'pago' };
    if (empresaId) whereManual.empresa_id = empresaId;
    if (filtroData) whereManual.data = filtroData;

    const historicoPeriodo = periodoHistorico(dataInicio, dataFim);
    const whereHistorico = `${historicoPeriodo.where} ${filtroEmpresaHistorico(empresaId)}`;
    const replHistorico = { ...historicoPeriodo.replacements, ...(empresaId ? { empresaId } : {}) };

    const [vendas, manuais, recorrenciasPagas] = await Promise.all([
      Venda.findAll({ where: whereVenda, order: [['data', 'DESC']] }),
      Saida.findAll({ where: whereManual, order: [['data', 'DESC']] }),
      sequelize.query(
        `SELECT hp.id, r.produto, r.nome_cliente, hp.valor,
                COALESCE(hp."dataPagamento", hp."dataVencimento") AS data,
                hp.status
         FROM historico_pagamentos hp
         JOIN recorrencias r ON r.id = hp.recorrencia_id
         WHERE r.tipo_transacao = 'ENTRADA' AND ${whereHistorico}
         ORDER BY data DESC`,
        { replacements: replHistorico, type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const linhas = [
      ...vendas.map(v => ({ origem: 'Venda/Caixa', id: v.id, descricao: v.observacao || `Venda #${v.id}`, valor: Number(v.valor_total), data: v.data })),
      ...manuais.map(s => ({ origem: 'Lançamento Manual', id: s.id, descricao: s.descricao || s.tipo, valor: Number(s.valor), data: s.data, tipo: s.tipo, natureza: s.natureza })),
      ...recorrenciasPagas.map(r => ({ origem: 'Recorrência paga', id: r.id, descricao: `${r.produto} — ${r.nome_cliente}`, valor: Number(r.valor), data: r.data, status: r.status })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    res.json(linhas);
  } catch (error) {
    console.error('Erro ao listar entradas consolidadas:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/financeiro/saidas-consolidado
export const listarSaidasConsolidado = async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const empresaId = resolverEmpresaId(req);

    const whereManual = { natureza: 'SAIDA', status: 'pago' };
    if (empresaId) whereManual.empresa_id = empresaId;
    const filtroData = filtroDataInclusivo(dataInicio, dataFim, Op);
    if (filtroData) whereManual.data = filtroData;

    const whereFunc = { ativo: true, status: 'ATIVO' };
    if (empresaId) whereFunc.empresa_id = empresaId;

    const historicoPeriodo = periodoHistorico(dataInicio, dataFim);
    const whereHistorico = `${historicoPeriodo.where} ${filtroEmpresaHistorico(empresaId)}`;
    const replHistorico = { ...historicoPeriodo.replacements, ...(empresaId ? { empresaId } : {}) };

    const filtrosComissao = ["c.status = 'pago'"];
    const replComissao = {};
    if (empresaId) {
      filtrosComissao.push('COALESCE(c.empresa_id, v.empresa_id) = :empresaId');
      replComissao.empresaId = empresaId;
    }
    if (dataInicio) {
      filtrosComissao.push('COALESCE(c.data_pagamento, v.data) >= :dataInicioComissao');
      replComissao.dataInicioComissao = normalizarLimiteData(dataInicio);
    }
    if (dataFim) {
      filtrosComissao.push('COALESCE(c.data_pagamento, v.data) <= :dataFimComissao');
      replComissao.dataFimComissao = normalizarLimiteData(dataFim, true);
    }

    const [manuais, funcionarios, recorrenciasPagas, comissoesPagas] = await Promise.all([
      Saida.findAll({ where: whereManual, order: [['data', 'DESC']] }),
      FuncionarioCusto.findAll({ where: whereFunc }),
      sequelize.query(
        `SELECT hp.id, r.produto, r.nome_cliente, hp.valor,
                COALESCE(hp."dataPagamento", hp."dataVencimento") AS data,
                hp.status
         FROM historico_pagamentos hp
         JOIN recorrencias r ON r.id = hp.recorrencia_id
         WHERE r.tipo_transacao = 'SAIDA' AND ${whereHistorico}
         ORDER BY data DESC`,
        { replacements: replHistorico, type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT c.id, c.valor, c.descricao,
                v.id AS venda_id,
                COALESCE(c.data_pagamento, v.data) AS data
         FROM comissoes c
         JOIN vendas v ON v.id = c.venda_id
         WHERE ${filtrosComissao.join(' AND ')}
         ORDER BY data DESC`,
        { replacements: replComissao, type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const linhas = [
      ...manuais.map(s => ({ origem: 'Manual', id: s.id, descricao: s.descricao || s.tipo, valor: Number(s.valor), data: s.data, tipo: s.tipo, natureza: s.natureza })),
      ...funcionarios.map(f => ({ origem: 'Folha projetada', id: f.id, descricao: `${f.nomeCompleto} — ${f.cargo}`, valor: obterCustoMensal(f), data: new Date(), status: 'previsto', projetado: true })),
      ...recorrenciasPagas.map(r => ({ origem: 'Recorrência paga', id: r.id, descricao: `${r.produto} — ${r.nome_cliente}`, valor: Number(r.valor), data: r.data, status: r.status })),
      ...comissoesPagas.map(c => ({ origem: 'Comissão paga', id: c.id, descricao: c.descricao || `Comissão da venda #${c.venda_id}`, valor: Number(c.valor), data: c.data, status: 'pago', venda_id: c.venda_id })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    res.json(linhas);
  } catch (error) {
    console.error('Erro ao listar saídas consolidadas:', error);
    res.status(500).json({ error: error.message });
  }
};

// ================================
// SAÍDAS / ENTRADAS MANUAIS — CRUD
// ================================

// GET /api/financeiro/saidas
export const listarSaidas = async (req, res) => {
  try {
    const { dataInicio, dataFim, natureza } = req.query;
    const where = {};

    const filtroData = filtroDataInclusivo(dataInicio, dataFim, Op);
    if (filtroData) where.data = filtroData;
    if (natureza) where.natureza = natureza;

    const empresaId = exigirEmpresaId(req, res);
    if (!empresaId) return;
    where.empresa_id = empresaId;

    const saidas = await Saida.findAll({ where, order: [['data', 'DESC']] });
    res.json(saidas);
  } catch (error) {
    console.error('Erro ao listar saídas:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/financeiro/saidas
export const criarSaida = async (req, res) => {
  try {
    const { tipo, descricao, data, valor, natureza, centro_custo_id } = req.body;
    const empresa_id = exigirEmpresaId(req, res);
    if (!empresa_id) return;
    const pagamento = await prepararSaidaPagamento(req.body, null, empresa_id, options => TurnoCaixa.findOne(options));
    const saida = await Saida.create({ tipo, descricao, data, valor, natureza: natureza || 'SAIDA', empresa_id, centro_custo_id: centro_custo_id || null, ...pagamento });

    if (saida.centro_custo_id && saida.natureza === 'SAIDA') {
      verificarBudgetCentroCusto(saida.centro_custo_id, empresa_id).catch(() => { });
    }

    res.status(201).json(saida);
  } catch (error) {
    console.error('Erro ao criar saída:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/financeiro/saidas/:id
export const atualizarSaida = async (req, res) => {
  try {
    const where = { id: req.params.id };
    const empresaId = exigirEmpresaId(req, res);
    if (!empresaId) return;
    where.empresa_id = empresaId;

    const saida = await Saida.findOne({ where });
    if (!saida) return res.status(404).json({ error: 'Saída não encontrada' });

    const { tipo, descricao, data, valor, natureza, centro_custo_id } = req.body;
    const pagamento = await prepararSaidaPagamento(req.body, saida, empresaId, options => TurnoCaixa.findOne(options));
    await saida.update({ tipo, descricao, data, valor, ...(natureza ? { natureza } : {}), centro_custo_id: centro_custo_id ?? saida.centro_custo_id, ...pagamento });

    if (saida.centro_custo_id && saida.natureza === 'SAIDA') {
      verificarBudgetCentroCusto(saida.centro_custo_id, empresaId).catch(() => { });
    }

    res.json(saida);
  } catch (error) {
    console.error('Erro ao atualizar saída:', error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/financeiro/saidas/:id
export const deletarSaida = async (req, res) => {
  try {
    const where = { id: req.params.id };
    const empresaId = exigirEmpresaId(req, res);
    if (!empresaId) return;
    where.empresa_id = empresaId;

    const saida = await Saida.findOne({ where });
    if (!saida) return res.status(404).json({ error: 'Saída não encontrada' });
    await saida.destroy();
    res.json({ message: 'Saída deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar saída:', error);
    res.status(500).json({ error: error.message });
  }
};

export const listarVendas = async (req, res) => {
  try {
    const { dataInicio, dataFim, funcionarioId, cliente_id } = req.query;
    const empresaId = resolverEmpresaId(req);

    const conds = [];
    const repl = {};

    const limites = limitesPeriodoInclusivo(dataInicio, dataFim);
    if (limites.inicio) {
      conds.push(`v.data >= :dataInicio`);
      repl.dataInicio = limites.inicio;
    }
    if (limites.fimExclusivo) {
      conds.push(`v.data < :dataFimExclusivo`);
      repl.dataFimExclusivo = limites.fimExclusivo;
    }
    if (funcionarioId) {
      conds.push(`v.funcionario_id = :funcId`);
      repl.funcId = parseInt(funcionarioId);
    }
    if (empresaId) {
      conds.push(`v.empresa_id = :empresaId`);
      repl.empresaId = empresaId;
    }
    if (cliente_id) {
      conds.push(`v.cliente_id = :clienteId`);
      repl.clienteId = parseInt(cliente_id);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const vendas = await sequelize.query(
      `SELECT
         v.id,
         v.data,
         v."createdAt",
         v.valor_total,
         v.forma_pagamento,
         v.tipo_cartao,
         v.parcelas,
         v.desconto,
         v.taxa_entrega,
         v.observacao,
         v.com_nota,
         v.pagamentos,
         v.cliente_id,
         c."nomeCompleto" AS cliente_nome,
         u."nomeCompleto" AS funcionario_nome,
         u.id AS funcionario_id
       FROM vendas v
       LEFT JOIN users u ON u.id = v.funcionario_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
       ${where}
       ORDER BY v.data DESC`,
      { replacements: repl, type: sequelize.QueryTypes.SELECT }
    );

    if (vendas.length > 0) {
      const vendaIds = vendas.map(v => v.id);
      const itens = await sequelize.query(
        `SELECT vi.venda_id, vi.quantidade, vi.valor_unitario, vi.valor_total, p.name AS nome
         FROM venda_itens vi
         LEFT JOIN "Products" p ON p.id = vi.produto_id
         WHERE vi.venda_id IN (:vendaIds)`,
        { replacements: { vendaIds }, type: sequelize.QueryTypes.SELECT }
      );
      const itensByVenda = {};
      for (const item of itens) {
        if (!itensByVenda[item.venda_id]) itensByVenda[item.venda_id] = [];
        itensByVenda[item.venda_id].push(item);
      }
      for (const v of vendas) {
        v.itens = itensByVenda[v.id] || [];
      }
    }

    res.json(vendas);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: error.message });
  }
};

export const ultimaCompraPorCliente = async (req, res) => {
  try {
    const empresaId = resolverEmpresaId(req);
    const repl = {};

    const vendaWhere = empresaId ? 'WHERE v.cliente_id IS NOT NULL AND v.empresa_id = :empresaId' : 'WHERE v.cliente_id IS NOT NULL';
    const recorrWhere = empresaId ? 'WHERE r.ativo = true AND r.cliente_id IS NOT NULL AND r.empresa_id = :empresaId' : 'WHERE r.ativo = true AND r.cliente_id IS NOT NULL';
    if (empresaId) repl.empresaId = empresaId;

    const result = await sequelize.query(
      `SELECT
         COALESCE(vendas.cliente_id, recorr.cliente_id) AS cliente_id,
         vendas.ultima_compra,
         COALESCE(vendas.total_compras, 0)              AS total_compras,
         (recorr.cliente_id IS NOT NULL)                AS tem_recorrencia_ativa
       FROM (
         SELECT v.cliente_id, MAX(v.data) AS ultima_compra, COUNT(*)::int AS total_compras
         FROM vendas v
         ${vendaWhere}
         GROUP BY v.cliente_id
       ) vendas
       FULL OUTER JOIN (
         SELECT DISTINCT r.cliente_id
         FROM recorrencias r
         ${recorrWhere}
       ) recorr ON vendas.cliente_id = recorr.cliente_id`,
      { replacements: repl, type: sequelize.QueryTypes.SELECT }
    );

    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar ultima compra por cliente:', error);
    res.status(500).json({ error: error.message });
  }
};
