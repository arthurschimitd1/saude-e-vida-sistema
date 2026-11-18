import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Agendamento from '../models/Agendamento.js';
import AgendamentoColaborador from '../models/AgendamentoColaborador.js';
import AgendamentoServico from '../models/AgendamentoServico.js';
import Recorrencia from '../models/Recorrencia.js';
import HistoricoPagamento from '../models/HistoricoPagamento.js';
import ComissaoAssinaturaConfiguracao from '../models/ComissaoAssinaturaConfiguracao.js';
import ComissaoAssinaturaCompetencia from '../models/ComissaoAssinaturaCompetencia.js';
import ComissaoAssinaturaItem from '../models/ComissaoAssinaturaItem.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import { servicoInclusoCorresponde } from '../utils/franquiaRecorrencia.js';

const FAIXAS_PADRAO = [
  { nome: 'Faixa 1', minimo: 0, maximo: 599, peso: 1 },
  { nome: 'Faixa 2', minimo: 600, maximo: 1199, peso: 1.1 },
  { nome: 'Faixa 3', minimo: 1200, maximo: 1799, peso: 1.2 },
  { nome: 'Faixa 4', minimo: 1800, maximo: null, peso: 1.3 },
];
const dinheiro = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const competenciaDaData = value => String(value).slice(0, 7);
const periodo = competencia => ({ inicio: `${competencia}-01`, fim: new Date(Date.UTC(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)), 0)).toISOString().slice(0, 10) });
const faixaPara = (minutos, faixas) => faixas.find(f => minutos >= Number(f.minimo) && (f.maximo == null || minutos <= Number(f.maximo))) || { nome: 'Sem faixa', peso: 1 };
const erro = (message, status = 400) => Object.assign(new Error(message), { status });

class ComissaoAssinaturaService {
  empresa(user) {
    const id = empresaParaGravar(user);
    if (!id) throw erro('Selecione uma empresa', 403);
    return Number(id);
  }

  async configuracao(user) {
    const [config] = await ComissaoAssinaturaConfiguracao.findOrCreate({ where: { empresa_id: this.empresa(user) }, defaults: { percentual_pote: 50, faixas: FAIXAS_PADRAO } });
    return config;
  }

  async salvarConfiguracao(data, user) {
    const percentual = Number(data.percentual_pote);
    if (!(percentual > 0 && percentual < 100)) throw erro('Percentual deve estar entre 0 e 100');
    if (!Array.isArray(data.faixas) || !data.faixas.length) throw erro('Informe as faixas');
    const faixas = [...data.faixas].sort((a, b) => Number(a.minimo) - Number(b.minimo));
    faixas.forEach((f, i) => {
      if (!f.nome || Number(f.peso) <= 0 || Number(f.minimo) < 0 || (i && Number(f.minimo) !== Number(faixas[i - 1].maximo) + 1)) throw erro('Faixas inválidas ou não contíguas');
    });
    if (faixas.at(-1).maximo != null) throw erro('A última faixa deve ser ilimitada');
    const config = await this.configuracao(user);
    return config.update({ percentual_pote: percentual, faixas });
  }

  async obterCompetencia(valor, user, transaction) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) throw erro('Competência inválida');
    const config = await this.configuracao(user);
    const [registro] = await ComissaoAssinaturaCompetencia.findOrCreate({
      where: { empresa_id: this.empresa(user), competencia: valor },
      defaults: { percentual_pote_snapshot: config.percentual_pote, faixas_snapshot: config.faixas }, transaction,
    });
    return registro;
  }

  async sincronizarAtendimento(agendamentoId, user) {
    const empresaId = this.empresa(user);
    const agendamento = await Agendamento.findOne({ where: { id: agendamentoId, empresa_id: empresaId } });
    if (!agendamento) throw erro('Agendamento não encontrado', 404);
    const existente = await ComissaoAssinaturaItem.findOne({ where: { empresa_id: empresaId, atendimento_id: agendamento.id } });
    if (agendamento.status !== 'finalizado') {
      if (existente) {
        const comp = await ComissaoAssinaturaCompetencia.findByPk(existente.competencia_id);
        if (comp?.status === 'EM_ANDAMENTO') await existente.destroy();
      }
      return { tipo_atendimento: 'AVULSO', processado: false };
    }
    if (existente) return { tipo_atendimento: 'ASSINATURA', processado: false, item: existente };
    if (!agendamento.cliente_id || !agendamento.servico_id) return { tipo_atendimento: 'AVULSO', processado: false };
    const recorrencias = await Recorrencia.findAll({ where: { empresa_id: empresaId, cliente_id: agendamento.cliente_id, ativo: true, statusRecorrencia: 'ATIVA', dataInicio: { [Op.lte]: agendamento.data }, [Op.or]: [{ dataFim: null }, { dataFim: { [Op.gte]: agendamento.data } }] }, order: [['dataInicio', 'DESC']] });
    const recorrencia = recorrencias.find(r => (Array.isArray(r.servicosInclusos) ? r.servicosInclusos : []).some(s => servicoInclusoCorresponde({ id: agendamento.servico_id, nome: agendamento.servico_nome }, s)));
    if (!recorrencia) return { tipo_atendimento: 'AVULSO', processado: false };
    const [servico, profissional] = await Promise.all([
      AgendamentoServico.findOne({ where: { id: String(agendamento.servico_id), empresa_id: empresaId } }),
      AgendamentoColaborador.findOne({ where: { id: agendamento.colaborador_id, empresa_id: empresaId } }),
    ]);
    if (!servico || !profissional) throw erro('Serviço ou profissional do atendimento não encontrado');
    const competencia = await this.obterCompetencia(competenciaDaData(agendamento.data), user);
    if (competencia.status !== 'EM_ANDAMENTO') throw erro('Competência já fechada', 409);
    const percentual = Number(competencia.percentual_pote_snapshot) / 100;
    const valor = Number(recorrencia.valorMes);
    const item = await ComissaoAssinaturaItem.create({ empresa_id: empresaId, competencia_id: competencia.id, atendimento_id: agendamento.id, recorrencia_id: recorrencia.id, cliente_id: agendamento.cliente_id, cliente_nome: agendamento.cliente_nome, plano_nome: recorrencia.produto, servico_id: String(servico.id), servico_nome: servico.nome, profissional_id: profissional.id, profissional_nome: profissional.usuario_nome, realizado_em: `${agendamento.data}T${agendamento.horario}:00`, minutos: Number(servico.duracao_min || 30), valor_assinatura: valor, valor_barbearia: dinheiro(valor * (1 - percentual)), valor_pote: dinheiro(valor * percentual) });
    return { tipo_atendimento: 'ASSINATURA', processado: true, item };
  }

  async calcular(valor, user) {
    return sequelize.transaction(async transaction => {
      const competencia = await this.obterCompetencia(valor, user, transaction);
      if (competencia.status !== 'EM_ANDAMENTO') throw erro('Competência fechada não pode ser recalculada', 409);
      const empresaId = this.empresa(user);
      const datas = periodo(valor);
      const pagamentos = await HistoricoPagamento.findAll({ where: { empresa_id: empresaId, dataPagamento: { [Op.between]: [datas.inicio, datas.fim] }, status: { [Op.in]: ['PAGO', 'PAGO_ATRASADO'] } }, transaction });
      const receita = dinheiro(pagamentos.reduce((sum, p) => sum + Number(p.valor), 0));
      const assinantes = await Recorrencia.count({ where: { empresa_id: empresaId, ativo: true, statusRecorrencia: 'ATIVA', dataInicio: { [Op.lte]: datas.fim }, [Op.or]: [{ dataFim: null }, { dataFim: { [Op.gte]: datas.inicio } }] }, transaction });
      const itens = await ComissaoAssinaturaItem.findAll({ where: { competencia_id: competencia.id }, transaction });
      const pote = dinheiro(receita * Number(competencia.percentual_pote_snapshot) / 100);
      const grupos = new Map();
      for (const item of itens) { const g = grupos.get(item.profissional_id) || { minutos: 0, itens: [] }; g.minutos += item.minutos; g.itens.push(item); grupos.set(item.profissional_id, g); }
      let totalPonderado = 0;
      for (const g of grupos.values()) { g.faixa = faixaPara(g.minutos, competencia.faixas_snapshot); g.ponderado = g.minutos * Number(g.faixa.peso); totalPonderado += g.ponderado; }
      for (const g of grupos.values()) {
        const participacao = totalPonderado ? g.ponderado / totalPonderado : 0;
        const total = dinheiro(pote * participacao); let alocado = 0;
        for (const [i, item] of g.itens.entries()) { const parcela = i === g.itens.length - 1 ? dinheiro(total - alocado) : dinheiro(total * item.minutos / g.minutos); alocado = dinheiro(alocado + parcela); await item.update({ faixa: g.faixa.nome, peso: g.faixa.peso, participacao, comissao: parcela }, { transaction }); }
      }
      await competencia.update({ receita_assinaturas: receita, valor_pote: pote, valor_barbearia: dinheiro(receita - pote), assinantes_ativos: assinantes }, { transaction });
      return this.dashboard(valor, user, transaction);
    });
  }

  async dashboard(valor, user, transaction) {
    const competencia = await ComissaoAssinaturaCompetencia.findOne({ where: { empresa_id: this.empresa(user), competencia: valor }, transaction });
    if (!competencia) return { competencia: valor, status: 'EM_ANDAMENTO', receita_assinaturas: 0, valor_barbearia: 0, valor_pote: 0, assinantes_ativos: 0, atendimentos: 0, minutos: 0, profissionais: [] };
    const itens = await ComissaoAssinaturaItem.findAll({ where: { competencia_id: competencia.id }, order: [['realizado_em', 'DESC']], transaction });
    const grupos = new Map();
    for (const item of itens) { const g = grupos.get(item.profissional_id) || { profissional_id: item.profissional_id, profissional: item.profissional_nome, atendimentos: 0, minutos: 0, faixa: item.faixa, peso: Number(item.peso), participacao: Number(item.participacao), comissao: 0, detalhes: [] }; g.atendimentos++; g.minutos += item.minutos; g.comissao = dinheiro(g.comissao + Number(item.comissao)); g.detalhes.push(item); grupos.set(item.profissional_id, g); }
    return { ...competencia.toJSON(), atendimentos: itens.length, minutos: itens.reduce((s, i) => s + i.minutos, 0), profissionais: [...grupos.values()] };
  }

  async mudarStatus(valor, status, user) {
    const competencia = await this.obterCompetencia(valor, user);
    if (status === 'FECHADA' && competencia.status === 'EM_ANDAMENTO') await competencia.update({ status, fechado_em: new Date(), fechado_por: user.id });
    else if (status === 'PAGA' && competencia.status === 'FECHADA') await competencia.update({ status, pago_em: new Date(), pago_por: user.id });
    else throw erro('Transição de estado inválida', 409);
    return this.dashboard(valor, user);
  }
}

export default new ComissaoAssinaturaService();
