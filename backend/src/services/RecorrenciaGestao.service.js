import { Op } from 'sequelize';
import Recorrencia from '../models/Recorrencia.js';
import HistoricoPagamento from '../models/HistoricoPagamento.js';
import Cliente from '../models/Cliente.js';
import RecorrenciaConfiguracao from '../models/RecorrenciaConfiguracao.js';
import RecorrenciaPlano from '../models/RecorrenciaPlano.js';
import RecorrenciaAuditoria from '../models/RecorrenciaAuditoria.js';
import asaasService from './Asaas.service.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const PERIOD_MULTIPLIER = { DIARIO: 30, SEMANAL: 4.345, QUINZENAL: 2.174, MENSAL: 1, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12 };

function today() { return new Date().toISOString().slice(0, 10); }
function asNumber(value) { return Number(value || 0); }

function paymentLabel(status) {
  return {
    PAGO: 'RECEBIDO',
    PAGO_ATRASADO: 'RECEBIDO_ATRASADO',
    PENDENTE: 'PENDENTE',
    ATRASADO: 'VENCIDO',
    ESTORNO_EM_PROCESSAMENTO: 'ESTORNO_EM_PROCESSAMENTO',
    ESTORNADO_PARCIAL: 'ESTORNADO_PARCIAL',
    ESTORNADO: 'ESTORNADO',
    CANCELADO: 'CANCELADO'
  }[status] || status;
}

class RecorrenciaGestaoService {
  empresaId(user) {
    const id = empresaParaGravar(user);
    if (!id) throw new Error('Selecione uma empresa antes de acessar a gestão de recorrências');
    return Number(id);
  }

  async registrarAuditoria({ empresaId, recorrenciaId = null, historicoPagamentoId = null, user, acao, statusAnterior = null, statusNovo = null, eventoAsaas = null, respostaAsaas = null, detalhes = null }) {
    return RecorrenciaAuditoria.create({
      empresa_id: empresaId,
      recorrencia_id: recorrenciaId,
      historico_pagamento_id: historicoPagamentoId,
      usuario_id: user?.id || null,
      acao,
      statusAnterior,
      statusNovo,
      eventoAsaas,
      respostaAsaas,
      detalhes
    });
  }

  async dashboard(user) {
    const empresaId = this.empresaId(user);
    const [recorrencias, pagamentos] = await Promise.all([
      Recorrencia.findAll({ where: { empresa_id: empresaId } }),
      HistoricoPagamento.findAll({ where: { empresa_id: empresaId } })
    ]);
    const ativos = recorrencias.filter((item) => item.ativo && item.statusRecorrencia !== 'CANCELADA');
    const previstos = ativos.reduce((total, item) => {
      const ciclo = item.tempoRecorrencia === 'PERSONALIZADO' ? item.subtipoRecorrencia : item.tempoRecorrencia;
      return total + asNumber(item.valorMes) * (PERIOD_MULTIPLIER[ciclo] || 1);
    }, 0);
    const recebidos = pagamentos.filter((item) => ['PAGO', 'PAGO_ATRASADO'].includes(item.status));
    const vencidos = pagamentos.filter((item) => item.status === 'ATRASADO');
    const pendentes = pagamentos.filter((item) => item.status === 'PENDENTE');
    const estornos = pagamentos.filter((item) => ['ESTORNADO', 'ESTORNADO_PARCIAL', 'ESTORNO_EM_PROCESSAMENTO'].includes(item.status));
    const month = today().slice(0, 7);
    const noMes = pagamentos.filter((item) => item.mesReferencia === month);
    const canceladas = recorrencias.filter((item) => item.statusRecorrencia === 'CANCELADA' || (!item.ativo && item.statusRecorrencia !== 'PAUSADA'));
    const mrr = previstos;
    const previstoMes = noMes.reduce((total, item) => total + asNumber(item.valor), 0) || previstos;
    const recebidoMes = noMes.filter((item) => ['PAGO', 'PAGO_ATRASADO'].includes(item.status)).reduce((total, item) => total + asNumber(item.valor), 0);
    const vencidoTotal = vencidos.reduce((total, item) => total + asNumber(item.valor), 0);
    const taxaInadimplencia = previstoMes > 0 ? Number(((vencidoTotal / previstoMes) * 100).toFixed(2)) : 0;
    return {
      receitaRecorrenteMensal: Number(mrr.toFixed(2)),
      receitaRecebidaMes: Number(recebidoMes.toFixed(2)),
      receitaAguardandoPagamento: Number(pendentes.reduce((t, item) => t + asNumber(item.valor), 0).toFixed(2)),
      totalVencido: Number(vencidoTotal.toFixed(2)),
      recorrenciasAtivas: ativos.length,
      recorrenciasPausadas: recorrencias.filter((item) => item.statusRecorrencia === 'PAUSADA' || (!item.ativo && item.statusRecorrencia !== 'CANCELADA')).length,
      recorrenciasCanceladas: canceladas.length,
      pagamentosVencidos: vencidos.length,
      pagamentosEstornados: estornos.length,
      taxaInadimplencia,
      ticketMedioRecorrente: ativos.length ? Number((mrr / ativos.length).toFixed(2)) : 0,
      novasRecorrenciasMes: recorrencias.filter((item) => String(item.created_at || '').slice(0, 7) === month).length,
      cancelamentosMes: canceladas.filter((item) => String(item.updated_at || '').slice(0, 7) === month).length,
      receitaRecuperada: noMes.filter((item) => item.status === 'PAGO_ATRASADO').reduce((t, item) => t + asNumber(item.valor), 0),
      mrr: Number(mrr.toFixed(2)),
      arr: Number((mrr * 12).toFixed(2)),
      recebidoXPrevisto: { recebido: Number(recebidoMes.toFixed(2)), previsto: Number(previstoMes.toFixed(2)) },
      proximosRecebimentos: pagamentos.filter((item) => item.status === 'PENDENTE' && item.dataVencimento >= today()).sort((a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento))).slice(0, 10),
      mesReferencia: month
    };
  }

  async listarPagamentos(filters = {}, user) {
    const empresaId = this.empresaId(user);
    const where = { empresa_id: empresaId };
    if (filters.status) where.status = filters.status;
    if (filters.asaasStatus) where.asaasStatus = filters.asaasStatus;
    if (filters.de || filters.ate) where.dataVencimento = { ...(filters.de ? { [Op.gte]: filters.de } : {}), ...(filters.ate ? { [Op.lte]: filters.ate } : {}) };
    const rows = await HistoricoPagamento.findAll({
      where,
      include: [{ model: Recorrencia, as: 'recorrencia', required: true, include: [{ model: Cliente, as: 'cliente', required: false }] }],
      order: [['dataVencimento', 'DESC']],
      limit: Math.min(Number(filters.limit || 200), 500)
    });
    return rows.map((row) => ({ ...row.toJSON(), statusExibicao: paymentLabel(row.status) }));
  }

  async configuracao(user) {
    const empresaId = this.empresaId(user);
    const config = await RecorrenciaConfiguracao.findOne({ where: { empresa_id: empresaId } });
    return config || { empresa_id: empresaId, formaPagamentoPadrao: 'PIX', juros: 0, multa: 0, desconto: 0, diasAntecedencia: 0 };
  }

  async salvarConfiguracao(data, user) {
    const empresaId = this.empresaId(user);
    const allowed = ['formaPagamentoPadrao', 'juros', 'multa', 'desconto', 'diasAntecedencia', 'reciboNomeEmpresa', 'reciboDocumento', 'reciboEndereco', 'reciboTelefone', 'reciboRodape'];
    const values = Object.fromEntries(allowed.filter((key) => data?.[key] !== undefined).map((key) => [key, data[key]]));
    const [config] = await RecorrenciaConfiguracao.findOrCreate({ where: { empresa_id: empresaId }, defaults: { empresa_id: empresaId } });
    await config.update(values);
    await this.registrarAuditoria({ empresaId, user, acao: 'CONFIGURACAO_ATUALIZADA', detalhes: values });
    return config;
  }

  async listarPlanos(user) {
    return RecorrenciaPlano.findAll({ where: { empresa_id: this.empresaId(user) }, order: [['ativo', 'DESC'], ['nome', 'ASC']] });
  }

  async criarPlano(data, user) {
    const empresaId = this.empresaId(user);
    if (!data?.nome || asNumber(data.valor) <= 0) throw new Error('Informe nome e valor maior que zero para o plano');
    return RecorrenciaPlano.create({ empresa_id: empresaId, nome: String(data.nome).trim(), descricao: data.descricao || null, valor: data.valor, periodicidade: data.periodicidade || 'MENSAL', ativo: data.ativo !== false });
  }

  async atualizarPlano(id, data, user) {
    const plano = await RecorrenciaPlano.findOne({ where: { id, empresa_id: this.empresaId(user) } });
    if (!plano) throw new Error('Plano não encontrado');
    await plano.update({ nome: data.nome ?? plano.nome, descricao: data.descricao ?? plano.descricao, valor: data.valor ?? plano.valor, periodicidade: data.periodicidade ?? plano.periodicidade, ativo: data.ativo ?? plano.ativo });
    return plano;
  }

  async excluirPlano(id, user) {
    const deleted = await RecorrenciaPlano.destroy({ where: { id, empresa_id: this.empresaId(user) } });
    if (!deleted) throw new Error('Plano não encontrado');
  }

  async alterarStatus(id, action, user, motivo) {
    const empresaId = this.empresaId(user);
    const recorrencia = await Recorrencia.findOne({ where: { id, empresa_id: empresaId } });
    if (!recorrencia) throw new Error('Recorrência não encontrada');
    const anterior = recorrencia.statusRecorrencia || (recorrencia.ativo ? 'ATIVA' : 'PAUSADA');
    let resposta;
    if (action === 'pausar') resposta = await asaasService.pauseSubscription(id, user);
    if (action === 'reativar') resposta = await asaasService.reactivateSubscription(id, user);
    if (action === 'cancelar') resposta = await asaasService.cancelSubscription(id, user);
    const novo = action === 'pausar' ? 'PAUSADA' : action === 'reativar' ? 'ATIVA' : 'CANCELADA';
    await recorrencia.update({ statusRecorrencia: novo, ativo: novo === 'ATIVA', asaasSyncStatus: 'SINCRONIZADO', asaasSyncError: null });
    await this.registrarAuditoria({ empresaId, recorrenciaId: id, user, acao: `RECORRENCIA_${action.toUpperCase()}`, statusAnterior: anterior, statusNovo: novo, respostaAsaas: resposta, detalhes: { motivo: motivo || null } });
    return recorrencia;
  }

  async solicitarEstorno(id, data, user) {
    const empresaId = this.empresaId(user);
    const historico = await HistoricoPagamento.findOne({ where: { id, empresa_id: empresaId }, include: [{ model: Recorrencia, as: 'recorrencia', required: true }] });
    if (!historico) throw new Error('Pagamento não encontrado');
    if (!historico.asaasPaymentId) throw new Error('Este pagamento não possui cobrança Asaas vinculada');
    if (!['PAGO', 'PAGO_ATRASADO'].includes(historico.status)) throw new Error('Somente pagamentos recebidos podem ser estornados');
    const resposta = await asaasService.refundPayment(historico.asaasPaymentId, data, user);
    const valorEstorno = asNumber(data?.value || historico.valor);
    await historico.update({ asaasRefundStatus: 'PROCESSANDO', asaasRefundedValue: valorEstorno, status: valorEstorno < asNumber(historico.valor) ? 'ESTORNADO_PARCIAL' : 'ESTORNO_EM_PROCESSAMENTO' });
    await this.registrarAuditoria({ empresaId, recorrenciaId: historico.recorrencia_id, historicoPagamentoId: id, user, acao: 'ESTORNO_SOLICITADO', statusAnterior: 'PAGO', statusNovo: historico.status, respostaAsaas: resposta, detalhes: { motivo: data?.reason || null, valor: valorEstorno } });
    return historico;
  }

  async eventos(id, user) {
    const empresaId = this.empresaId(user);
    return RecorrenciaAuditoria.findAll({ where: { empresa_id: empresaId, recorrencia_id: id }, order: [['created_at', 'DESC']], limit: 100 });
  }

  async recibo(id, user) {
    const empresaId = this.empresaId(user);
    const historico = await HistoricoPagamento.findOne({ where: { id, empresa_id: empresaId }, include: [{ model: Recorrencia, as: 'recorrencia', required: true, include: [{ model: Cliente, as: 'cliente', required: false }] }] });
    if (!historico) throw new Error('Pagamento não encontrado');
    await historico.update({ reciboEmitidoAt: new Date() });
    const configuracao = await this.configuracao(user);
    await this.registrarAuditoria({ empresaId, recorrenciaId: historico.recorrencia_id, historicoPagamentoId: id, user, acao: 'RECIBO_GERADO' });
    return { pagamento: historico, configuracao };
  }
}

export default new RecorrenciaGestaoService();
