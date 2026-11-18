import { Op } from 'sequelize';

// Garante coluna nome_item na tabela venda_itens
sequelize.query(`ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS nome_item VARCHAR(300)`).catch(() => {});
import Venda from '../models/Venda.js';
import VendaItem from '../models/VendaItem.js';
import Product from '../models/Product.js';
import User from '../models/UserModel.js';
import Cliente from '../models/Cliente.js';
import Orcamento from '../models/Orcamento.js';
import Comissao from '../models/Comissao.js';
import ComissaoServico from '../models/ComissaoServico.js';
import ComissaoAssinaturaItem from '../models/ComissaoAssinaturaItem.js';
import Movimento from '../models/Movimento.js';
import EstoqueRoupa from '../models/EstoqueRoupa.js';
import EstoqueRoupaVariacao from '../models/EstoqueRoupaVariacao.js';
import EstoqueRoupaMovimento from '../models/EstoqueRoupaMovimento.js';
import RawMaterial from '../models/RawMaterial.js';
import Agendamento from '../models/Agendamento.js';
import AgendamentoColaborador from '../models/AgendamentoColaborador.js';
import AgendamentoServico from '../models/AgendamentoServico.js';
import AgendamentoServicoUnidade from '../models/AgendamentoServicoUnidade.js';
import Service from '../models/Service.js';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
import AutomacaoEngine from './AutomacaoEngine.js';
import taxaCartaoService from './TaxaCartaoService.js';
import { calcularComissoesVenda } from './ComissaoCalculo.js';
import { calcularComissaoVenda, normalizarNomeServico } from '../utils/calcularComissaoVenda.js';
import nuvemshopCatalogSyncService from './NuvemshopCatalogSync.service.js';
import lojaProgramaService from './LojaProgramaService.js';

const sincronizarRoupasAposCommit = async (empresaId, variationIds) => {
  // Alguns testes unitários carregam este arquivo removendo imports para usar
  // persistência em memória. Em produção o serviço sempre está importado.
  if (typeof nuvemshopCatalogSyncService === 'undefined') return;
  try {
    await nuvemshopCatalogSyncService.pushVariationIds(empresaId, [...variationIds]);
  } catch (error) {
    // A venda já foi confirmada. Uma indisponibilidade externa não pode
    // desfazer a operação local; o erro fica visível no status da integração.
    console.error('[Nuvemshop] Falha ao enviar estoque após venda:', error.message);
  }
};

const normalizarCfop = valor => {
  const cfop = String(valor ?? '').trim();
  if (!cfop) return null;
  if (!/^\d{4}$/.test(cfop)) {
    throw new Error('O CFOP da venda deve conter exatamente 4 dígitos');
  }
  return cfop;
};

const normalizarCstCsosn = valor => {
  const cst = String(valor ?? '').trim();
  if (!cst) return null;
  if (!/^\d{2,3}$/.test(cst)) {
    throw new Error('O CST deve conter 2 dígitos ou o CSOSN deve conter 3 dígitos');
  }
  return cst;
};

// O preco digitado no caixa pertence ao item da venda. Nunca altere o preco
// cadastrado no estoque so porque uma venda teve um valor negociado.
const valoresDoItem = (item, precoPadrao) => {
  const quantidade = Number(item.quantidade);
  const valorUnitario = Number(item.valor_unitario ?? precoPadrao);
  const valorTotal = item.valor_total != null
    ? Number(item.valor_total)
    : valorUnitario * quantidade;

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('A quantidade do item deve ser um numero maior que zero');
  }
  if (item.tipo === 'roupa' && !Number.isSafeInteger(quantidade)) {
    throw new Error('A quantidade de roupas deve ser um número inteiro');
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
    throw new Error('O valor do produto na venda deve ser um numero valido');
  }
  if (!Number.isFinite(valorTotal) || valorTotal < 0) {
    throw new Error('O total do produto na venda deve ser um numero valido');
  }

  return { quantidade, valor_unitario: valorUnitario, valor_total: valorTotal };
};

const carregarVariacaoRoupa = async (item, empresaId, transaction) => {
  const variacaoId = Number(item.variacao_id);
  const roupaId = Number(item.roupa_id);
  if (!Number.isInteger(variacaoId) || variacaoId <= 0) throw new Error('Variação da peça de roupa é obrigatória');
  const variacao = await EstoqueRoupaVariacao.findOne({
    where: {
      id: variacaoId,
      ...(Number.isInteger(roupaId) && roupaId > 0 ? { roupa_id: roupaId } : {}),
    },
    include: [{ model: EstoqueRoupa, as: 'roupa', required: true, where: { empresa_id: empresaId } }],
    transaction,
    lock: { level: transaction.LOCK.UPDATE, of: EstoqueRoupaVariacao },
  });
  if (!variacao) throw new Error('Variação da peça de roupa não encontrada nesta empresa');
  return variacao;
};

const registrarMovimentoRoupa = async ({ variacao, venda, tipo, quantidade, motivo, origem_tipo, origem_id, usuario_id }, transaction) => {
  const saldoPosterior = Number(variacao.quantidade_atual);
  const saldoAnterior = tipo === 'saida' ? saldoPosterior + Number(quantidade) : saldoPosterior - Number(quantidade);
  await EstoqueRoupaMovimento.create({
    empresa_id: venda.empresa_id,
    roupa_id: variacao.roupa_id,
    variacao_id: variacao.id,
    usuario_id: usuario_id ?? null,
    tipo,
    quantidade: Math.abs(Number(quantidade)),
    saldo_anterior: Math.max(0, saldoAnterior),
    saldo_posterior: saldoPosterior,
    motivo,
    origem_tipo,
    origem_id,
    data: new Date(),
  }, { transaction });
};

const devolverRoupaDaVenda = async (item, venda, currentUser, transaction, edicao = false) => {
  const quantidade = Number(item.quantidade);
  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade inválida na roupa vendida; não foi possível devolver ao estoque');
  }
  const variacao = await carregarVariacaoRoupa(item, venda.empresa_id, transaction);
  if (variacao.estoque_infinito) return variacao.id;
  await variacao.update({
    quantidade_atual: Number(variacao.quantidade_atual) + quantidade,
  }, { transaction });
  await registrarMovimentoRoupa({
    variacao,
    venda,
    tipo: 'entrada',
    quantidade,
    motivo: edicao ? 'Devolução para edição de venda' : 'Cancelamento de venda',
    origem_tipo: edicao ? 'venda_editada' : 'venda_cancelada',
    origem_id: venda.id,
    usuario_id: currentUser?.id,
  }, transaction);
  return variacao.id;
};

export const calcularBaseComissaoUsuario = (totalVenda, totalServicosAgenda) =>
  Math.max(0, Number(totalVenda || 0) - Number(totalServicosAgenda || 0));

export const calcularValorComissao = (tipo, valorOrigem, baseCalculo, quantidade = 1) => {
  const origem = Number(valorOrigem || 0);
  const base = Number(baseCalculo || 0);
  if (origem <= 0 || base < 0) return 0;
  const valor = tipo === 'percent'
    ? (base * origem) / 100
    : origem * Math.max(1, Number(quantidade || 1));
  return Math.round((valor + Number.EPSILON) * 100) / 100;
};

export const resolverRegraComissaoServicoAgenda = (servico, profissional, regraProfissionalServico = null) => {
  if (regraProfissionalServico && Number(regraProfissionalServico.percentual) > 0) {
    return {
      tipo: 'percent',
      valorOrigem: Number(regraProfissionalServico.percentual),
      origemCalculo: 'servico_profissional',
    };
  }
  if (servico?.comissao_tipo) {
    return {
      tipo: servico.comissao_tipo,
      valorOrigem: Number(servico.comissao_valor || 0),
      origemCalculo: 'servico_agendamento',
    };
  }
  if (profissional?.comissao_tipo) {
    return {
      tipo: profissional.comissao_tipo,
      valorOrigem: Number(profissional.comissao_valor || 0),
      origemCalculo: 'usuario',
    };
  }
  return { tipo: null, valorOrigem: 0, origemCalculo: null };
};

// Vendas antigas podem ter sido gravadas antes da obrigatoriedade de
// empresa_id. Nesses casos, o vínculo confiável que já existia é o
// funcionario_id. Recuperamos somente vendas sem empresa_id cujo funcionário
// pertence à empresa do usuário; vendas explicitamente vinculadas continuam
// sendo filtradas pelo empresa_id normalmente.
export const construirEscopoVenda = (empresaId, funcionarioIds = []) => ({
  [Op.or]: [
    { empresa_id: Number(empresaId) },
    ...(funcionarioIds.length > 0
      ? [{ empresa_id: null, funcionario_id: { [Op.in]: funcionarioIds } }]
      : []),
  ],
});

const aplicarEscopoVenda = async (where, currentUser) => {
  const empresaId = currentUser?.empresa_id_override ?? currentUser?.empresa_id;
  if (!empresaId || currentUser?.tipo === 'MASTER' && !currentUser?.empresa_id_override) return;

  const funcionarios = await User.findAll({
    where: { empresa_id: Number(empresaId) },
    attributes: ['id'],
    raw: true,
  });
  const funcionarioIds = funcionarios.map(({ id }) => Number(id)).filter(Number.isInteger);

  Object.assign(where, construirEscopoVenda(empresaId, funcionarioIds));
};

class VendaService {
  async resolverServicoCatalogo(item, empresaId, transaction) {
    const servicoId = Number(item.catalogo_servico_id ?? item.catalogoServicoId);
    if (!Number.isInteger(servicoId) || servicoId <= 0) return null;
    const servico = await Service.findOne({
      where: { id: servicoId, empresa_id: empresaId, ativo: true },
      transaction,
    });
    if (!servico) throw new Error('Serviço não encontrado ou inativo nesta empresa');
    return servico;
  }

  async resolverServicoAgendaCatalogo(item, empresaId, transaction) {
    const servicoId = item.agendamento_servico_catalogo_id ?? item.agendamentoServicoCatalogoId;
    if (!servicoId) return null;
    const servico = await AgendamentoServico.findOne({
      where: { id: String(servicoId), empresa_id: empresaId, ativo: true },
      transaction,
    });
    if (!servico) throw new Error('Serviço da agenda não encontrado ou inativo nesta empresa');
    return servico;
  }

  async resolverServicoAgenda(item, empresaId, transaction, vendaId = null, options = {}) {
    const permitirServicoAdicional = options.permitirServicoAdicional === true;
    const agendamentoId = Number(item.agendamento_id ?? item.agendamentoId);
    const servicoId = item.servico_id ?? item.agendamento_servico_id ?? item.servicoId;
    if (!agendamentoId && !servicoId) return null;
    if (!agendamentoId || !servicoId) {
      throw new Error('O serviço da agenda precisa informar o agendamento e o serviço de origem');
    }

    const agendamento = await Agendamento.findOne({
      where: { id: agendamentoId, empresa_id: empresaId },
      transaction,
    });
    if (!agendamento) throw new Error('Agendamento não encontrado nesta empresa');
    const servicosAgendados = Array.isArray(agendamento.servicos) ? agendamento.servicos : [];
    const servicoPertenceAoAgendamento = String(agendamento.servico_id ?? '') === String(servicoId)
      || servicosAgendados.some(servico => String(servico?.id ?? servico?.servicoId ?? '') === String(servicoId));
    if (!servicoPertenceAoAgendamento && !permitirServicoAdicional) {
      throw new Error('Serviço divergente do agendamento');
    }
    if (agendamento.status === 'cancelado') throw new Error('Um agendamento cancelado não pode ser incluído na venda');

    const vendaExistente = await VendaItem.findOne({
      where: {
        agendamento_id: agendamentoId,
        ...(vendaId ? { venda_id: { [Op.ne]: Number(vendaId) } } : {}),
      },
      transaction,
    });
    if (vendaExistente) {
      throw new Error('Este agendamento já foi incluído em outra venda');
    }

    const [servico, colaborador, configuracaoUnidade] = await Promise.all([
      AgendamentoServico.findOne({
        where: {
          id: String(servicoId),
          empresa_id: empresaId,
          ...(!servicoPertenceAoAgendamento ? { ativo: true } : {}),
        },
        transaction,
      }),
      AgendamentoColaborador.findOne({
        where: { id: agendamento.colaborador_id, empresa_id: empresaId },
        transaction,
      }),
      !servicoPertenceAoAgendamento && agendamento.unidade_id
        ? AgendamentoServicoUnidade.findOne({
            where: {
              empresa_id: empresaId,
              unidade_id: agendamento.unidade_id,
              servico_id: String(servicoId),
            },
            transaction,
          })
        : null,
    ]);
    if (!servico) throw new Error('Serviço do agendamento não encontrado nesta empresa');
    if (!servicoPertenceAoAgendamento && agendamento.unidade_id && configuracaoUnidade?.ativo !== true) {
      throw new Error('Este serviço não está disponível na unidade do agendamento');
    }
    if (!colaborador?.usuario_id && Number(servico.comissao_valor) > 0) {
      throw new Error('O profissional do agendamento precisa estar vinculado a um usuário para receber comissão');
    }
    let profissional = null;
    if (colaborador?.usuario_id) {
      profissional = await User.findOne({
        where: { id: colaborador.usuario_id, empresa_id: empresaId },
        transaction,
      });
      if (!profissional && Number(servico.comissao_valor) > 0) {
        throw new Error('O usuário responsável pelo agendamento não pertence a esta empresa');
      }
    }
    return { agendamento, servico, colaborador, profissional };
  }

  async criarComissoesVenda({ venda, funcionarioId, servicosAgenda, itens = [], transaction }) {
    const totalServicosAgenda = servicosAgenda.reduce((total, item) => total + item.valorTotal, 0);
    const baseUsuario = calcularBaseComissaoUsuario(venda.valor_total, totalServicosAgenda);

    if (funcionarioId && baseUsuario > 0) {
      const funcionario = await User.findOne({
        where: { id: funcionarioId, empresa_id: venda.empresa_id },
        transaction,
      });
      if (funcionario) {
        const itensComissionaveis = itens.filter(item => !(
          item.agendamento_id || item.agendamento_servico_id || item.agendamentoId || item.servicoId
        ));
        const regras = await ComissaoServico.findAll({
          where: { empresa_id: venda.empresa_id, funcionario_id: funcionario.id },
          transaction,
          raw: true,
        });
        if (regras.length === 0) {
          const calculos = calcularComissoesVenda({
            itens: itensComissionaveis,
            desconto: venda.desconto,
            totalVenda: baseUsuario,
            tipo: funcionario.comissao_tipo,
            valor: funcionario.comissao_valor,
          });
          for (const calculo of calculos) {
            if (Number(calculo.valor) <= 0) continue;
            await Comissao.create({
              venda_id: venda.id,
              funcionario_id: funcionario.id,
              empresa_id: venda.empresa_id,
              valor: calculo.valor,
              tipo: funcionario.comissao_tipo,
              valor_origem: Number(funcionario.comissao_valor),
              origem: calculo.origem,
              base_calculo: calculo.base_calculo,
              origem_calculo: 'colaborador',
              detalhes_calculo: calculo.detalhes_calculo ?? null,
              descricao: calculo.origem === 'venda_servicos'
                ? 'Comissão sobre serviços da venda'
                : calculo.origem === 'venda_produtos'
                  ? 'Comissão sobre produtos da venda'
                  : 'Comissão da venda',
              status: 'pendente',
            }, { transaction });
          }
        } else {
          // Mantém as regras especiais por nome de serviço já existentes.
          const calculo = calcularComissaoVenda({
            totalVenda: baseUsuario,
            itens: itensComissionaveis,
            funcionario,
            regras,
          });
          if (Number(calculo.valor) > 0) {
            const temProdutos = itensComissionaveis.some(item => item.tipo !== 'servico');
            const temServicos = itensComissionaveis.some(item => item.tipo === 'servico');
            const origem = temProdutos && temServicos ? 'venda' : temServicos ? 'venda_servicos' : 'venda_produtos';
            const valorOrigem = Number(calculo.valorOrigem ?? funcionario.comissao_valor);
            await Comissao.create({
              venda_id: venda.id,
              funcionario_id: funcionario.id,
              empresa_id: venda.empresa_id,
              valor: calculo.valor,
              tipo: calculo.tipo || funcionario.comissao_tipo,
              valor_origem: valorOrigem,
              origem,
              base_calculo: baseUsuario,
              origem_calculo: calculo.origem,
              detalhes_calculo: calculo.detalhes,
              descricao: temProdutos && temServicos
                ? 'Comissão sobre produtos e serviços da venda'
                : temServicos ? 'Comissão sobre serviços da venda' : 'Comissão sobre produtos da venda',
              status: 'pendente',
            }, { transaction });
          }
        }
      }
    }

    const profissionaisAgendaIds = [...new Set(servicosAgenda
      .map(item => Number(item.profissional?.id))
      .filter(Number.isInteger))];
    const chavesServicosAgenda = [...new Set(servicosAgenda
      .map(item => normalizarNomeServico(item.servico?.nome))
      .filter(Boolean))];
    const regrasAgenda = profissionaisAgendaIds.length > 0 && chavesServicosAgenda.length > 0
      ? await ComissaoServico.findAll({
          where: {
            empresa_id: venda.empresa_id,
            funcionario_id: { [Op.in]: profissionaisAgendaIds },
            servico_chave: { [Op.in]: chavesServicosAgenda },
          },
          transaction,
          raw: true,
        })
      : [];
    const regrasAgendaPorProfissionalServico = new Map(regrasAgenda.map(regra => [
      `${regra.funcionario_id}:${regra.servico_chave}`,
      regra,
    ]));

    for (const item of servicosAgenda) {
      const atendimentoAssinatura = await ComissaoAssinaturaItem.findOne({
        where: { empresa_id: venda.empresa_id, atendimento_id: item.agendamento.id },
        transaction,
      });
      if (atendimentoAssinatura) continue;
      // Empresas que não utilizam comissão ainda podem ter profissionais sem
      // acesso próprio. Quando há comissão configurada no serviço, o vínculo já
      // é validado em resolverServicoAgenda; aqui preservamos o fluxo sem comissão.
      if (!item.profissional) continue;
      const regraProfissionalServico = regrasAgendaPorProfissionalServico.get(
        `${item.profissional.id}:${normalizarNomeServico(item.servico?.nome)}`,
      );
      const { tipo, valorOrigem, origemCalculo } = resolverRegraComissaoServicoAgenda(
        item.servico,
        item.profissional,
        regraProfissionalServico,
      );
      if (!tipo || valorOrigem <= 0) continue;
      const valorComissao = calcularValorComissao(tipo, valorOrigem, item.valorTotal, item.quantidade);
      if (valorComissao <= 0) continue;
      await Comissao.create({
        venda_id: venda.id,
        funcionario_id: item.profissional.id,
        empresa_id: venda.empresa_id,
        valor: valorComissao,
        tipo,
        valor_origem: valorOrigem,
        origem: 'servico_agendamento',
        base_calculo: item.valorTotal,
        agendamento_id: item.agendamento.id,
        servico_id: item.servico.id,
        descricao: `Serviço: ${item.servico.nome}`,
        origem_calculo: origemCalculo,
        status: 'pendente',
      }, { transaction });
    }
  }

  async create(data, currentUser) {
    const t = await sequelize.transaction();
    let committed = false;
    try {
      const empresaId = empresaParaGravar(currentUser);
      if (!empresaId) throw new Error('Selecione uma empresa para registrar a venda');
      const orcamentoId = data.orcamento_id ? Number(data.orcamento_id) : null;
      let orcamento = null;
      if (orcamentoId) {
        orcamento = await Orcamento.findOne({
          where: { id: orcamentoId, empresa_id: empresaId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!orcamento) throw new Error('Orçamento não encontrado para conversão em venda');
        if (orcamento.status === 'cancelado') throw new Error('Não é possível vender um orçamento cancelado');
      }
      const dataVenda = data.data ?? new Date();
      const pagamentosComTaxa = Array.isArray(data.pagamentos)
        ? await Promise.all(data.pagamentos.map(pagamento => taxaCartaoService.aplicar(pagamento, empresaId, dataVenda)))
        : null;
      let descontoEfetivo = data.desconto ?? 0;
      let tipoDescontoEfetivo = data.tipo_desconto ?? 'valor';
      let valorTotalEfetivo = data.valor_total;
      let cupomValidado = null;
      const codigoCupom = String(data.loja_cupom_codigo || '').trim();
      if (data.origem !== 'loja_online' && (codigoCupom || data.loja_cupom_id)) {
        if (!codigoCupom) throw new Error('Informe o código do cupom.');
        const valorBrutoCupom = Number((data.itens ?? []).reduce((total, item) => {
          const quantidade = Number(item.quantidade || 0);
          const valorUnitario = Number(item.valor_unitario || 0);
          return total + Number(item.valor_total ?? (quantidade * valorUnitario));
        }, 0).toFixed(2));
        cupomValidado = await lojaProgramaService.validarCupomCaixa({
          codigo: codigoCupom,
          cliente_id: data.cliente_id,
          valor_bruto: valorBrutoCupom,
          itens: data.itens,
        }, currentUser, t);
        if (data.loja_cupom_id && Number(data.loja_cupom_id) !== Number(cupomValidado.cupom.id)) {
          throw new Error('O cupom informado não corresponde ao código selecionado.');
        }
        descontoEfetivo = cupomValidado.desconto;
        tipoDescontoEfetivo = 'valor';
        valorTotalEfetivo = cupomValidado.valor_total + Number(data.taxa_entrega || 0);
      }
      const venda = await Venda.create({
        cliente_id: data.cliente_id ?? null,
        funcionario_id: data.funcionario_id ?? currentUser?.id ?? null,
        empresa_id: empresaId,
        origem: data.origem ?? 'caixa',
        status_loja: data.status_loja ?? null,
        status_loja_atualizado_em: data.status_loja_atualizado_em ?? (data.status_loja ? new Date() : null),
        status_loja_historico: data.status_loja_historico ?? (data.status_loja ? [{ status: data.status_loja, em: new Date().toISOString(), origem: 'loja' }] : []),
        loja_cupom_id: data.loja_cupom_id ?? null,
        loja_cupom_codigo: data.loja_cupom_codigo ?? null,
        orcamento_id: orcamentoId,
        data: dataVenda,
        forma_pagamento: data.forma_pagamento,
        tipo_cartao: data.tipo_cartao ?? null,
        parcelas: data.parcelas ?? 1,
        com_nota: data.com_nota ?? false,
        desconto: descontoEfetivo,
        tipo_desconto: tipoDescontoEfetivo,
        taxa_entrega: data.taxa_entrega ?? 0,
        endereco_entrega: data.endereco_entrega ?? null,
        observacao: data.observacao ?? null,
        cfop: normalizarCfop(data.cfop),
        cst_csosn: normalizarCstCsosn(data.cst_csosn),
        valor_total: valorTotalEfetivo,
        pagamentos: pagamentosComTaxa,
        turno_id: data.turno_id ?? null
      }, { transaction: t });

      const estoquesBaixos = []; // coletados durante o loop, disparados após commit
      const servicosAgenda = [];
      const variacoesRoupaAlteradas = new Set();

      for (const item of (data.itens ?? [])) {

        // ── Item de Roupa ──
        if (item.tipo === 'roupa') {
          const variacao = await carregarVariacaoRoupa(item, venda.empresa_id, t);
          const valoresRoupa = valoresDoItem(item, item.valor_unitario);

          if (!variacao.estoque_infinito && Number(variacao.quantidade_atual) < valoresRoupa.quantidade) {
            throw new Error(`Estoque insuficiente para esta variação (tem ${variacao.quantidade_atual}, precisa ${valoresRoupa.quantidade})`);
          }

          await VendaItem.create({
            venda_id: venda.id,
            produto_id: null,
            tipo: 'roupa',
            roupa_id: variacao.roupa_id,
            variacao_id: item.variacao_id,
            nome_item: item.nome_item ?? item.nome_servico ?? item.nome ?? 'Peça de roupa',
            quantidade: valoresRoupa.quantidade,
            valor_unitario: valoresRoupa.valor_unitario,
            valor_total: valoresRoupa.valor_total
          }, { transaction: t });

          if (!variacao.estoque_infinito) {
            const novaQtdRoupa = Number(variacao.quantidade_atual) - valoresRoupa.quantidade;
            await variacao.update({ quantidade_atual: novaQtdRoupa }, { transaction: t });
            await registrarMovimentoRoupa({
              variacao, venda, tipo: 'saida', quantidade: valoresRoupa.quantidade,
              motivo: 'Venda', origem_tipo: 'venda', origem_id: venda.id, usuario_id: currentUser?.id,
            }, t);
            variacoesRoupaAlteradas.add(Number(variacao.id));
            if (novaQtdRoupa < variacao.quantidade_minima) {
              estoquesBaixos.push({ tipo: 'roupa', nome: `Variação ${variacao.id}`, novaQtd: novaQtdRoupa, minima: variacao.quantidade_minima, empresa_id: venda.empresa_id });
            }
          }

          continue;
        }

        // ── Item de Matéria-Prima ──
        if (item.tipo === 'materia_prima') {
          const mp = await RawMaterial.findByPk(item.raw_material_id, { transaction: t });
          if (!mp) throw new Error(`Matéria-prima ${item.raw_material_id} não encontrada`);
          if (Number(mp.currentQuantity) < Number(item.quantidade)) {
            throw new Error(`Estoque insuficiente para "${mp.name}" (tem ${Number(mp.currentQuantity)}, precisa ${Number(item.quantidade)})`);
          }
          await VendaItem.create({
            venda_id: venda.id,
            produto_id: null,
            raw_material_id: mp.id,
            tipo: 'materia_prima',
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario ?? mp.price,
            valor_total: item.valor_total ?? (Number(item.valor_unitario ?? mp.price) * Number(item.quantidade))
          }, { transaction: t });
          await mp.update({ currentQuantity: Number(mp.currentQuantity) - Number(item.quantidade) }, { transaction: t });
          continue;
        }

        // ── Item de Serviço (sem produto em estoque) ──
        if (!item.produto_id || Number(item.produto_id) <= 0) {
          const origemCaixa = String(item.origem_servico ?? item.origemServico ?? '').toLowerCase() === 'caixa';
          const origemAgenda = origemCaixa ? null : await this.resolverServicoAgenda(item, venda.empresa_id, t, venda.id);
          const servicoAgendaCatalogo = origemCaixa || origemAgenda ? null : await this.resolverServicoAgendaCatalogo(item, venda.empresa_id, t);
          const servicoCatalogo = origemCaixa || origemAgenda || servicoAgendaCatalogo ? null : await this.resolverServicoCatalogo(item, venda.empresa_id, t);
          if (!origemCaixa && !origemAgenda && !servicoAgendaCatalogo && !servicoCatalogo) {
            throw new Error('Selecione um serviço válido do catálogo da empresa');
          }
          const valoresServico = valoresDoItem(item, 0);
          await VendaItem.create({
            venda_id: venda.id,
            produto_id: null,
            nome_item: origemAgenda?.servico.nome ?? servicoAgendaCatalogo?.nome ?? servicoCatalogo?.name ?? item.nome_servico ?? item.nome_item ?? 'Serviço',
            tipo: 'servico',
            quantidade: valoresServico.quantidade,
            valor_unitario: valoresServico.valor_unitario,
            valor_total: valoresServico.valor_total,
            agendamento_id: origemAgenda?.agendamento.id ?? null,
            agendamento_servico_id: origemAgenda?.servico.id ?? servicoAgendaCatalogo?.id ?? null,
            catalogo_servico_id: servicoCatalogo?.id ?? null,
          }, { transaction: t });
          if (origemAgenda) servicosAgenda.push({
            ...origemAgenda,
            quantidade: valoresServico.quantidade,
            valorTotal: valoresServico.valor_total,
          });
          continue;
        }

        // ── Item de Produto Normal ──
        const produto = await Product.findByPk(item.produto_id, { transaction: t });
        if (!produto) throw new Error(`Produto ${item.produto_id} não encontrado`);

        const valoresProduto = valoresDoItem(item, produto.price);

        if (Number(produto.currentQuantity) < valoresProduto.quantidade) {
          throw new Error(`Estoque insuficiente para "${produto.name}" (tem ${Number(produto.currentQuantity)}, precisa ${valoresProduto.quantidade})`);
        }

        await VendaItem.create({
          venda_id: venda.id,
          produto_id: produto.id,
          tipo: 'produto',
          quantidade: valoresProduto.quantidade,
          valor_unitario: valoresProduto.valor_unitario,
          valor_total: valoresProduto.valor_total
        }, { transaction: t });

        await produto.update({
          currentQuantity: Number(produto.currentQuantity) - valoresProduto.quantidade
        }, { transaction: t });

        // Verifica se ficou abaixo do mínimo (usa minQuantity se existir, senão verifica se chegou a 0)
        const novaQtdProd = Number(produto.currentQuantity) - valoresProduto.quantidade;
        const minProd = Number(produto.minQuantity ?? 0);
        if (novaQtdProd <= minProd) {
            estoquesBaixos.push({ tipo: 'produto', nome: produto.name, novaQtd: novaQtdProd, minima: minProd, empresa_id: venda.empresa_id });
        }

        await Movimento.create({
          produto_id: produto.id,
          empresa_id: venda.empresa_id ?? null,
          usuario_id: currentUser?.id ?? null,
          tipo: 'saida',
          quantidade: valoresProduto.quantidade,
          motivo: 'Venda',
          origem_tipo: 'venda',
          origem_id: venda.id,
          data: new Date()
        }, { transaction: t });
      }

      await this.criarComissoesVenda({
        venda,
        funcionarioId: venda.funcionario_id,
        servicosAgenda,
        itens: data.itens ?? [],
        transaction: t,
      });

      if (orcamento) {
        await orcamento.update({ status: 'pago' }, { transaction: t });
      }

      if (cupomValidado) {
        await lojaProgramaService.consumirCupom(cupomValidado.cupom.id, empresaId, t);
      }

      await t.commit();
      committed = true;

      await lojaProgramaService.registrarVenda(venda.id);

      await sincronizarRoupasAposCommit(venda.empresa_id, variacoesRoupaAlteradas);

      // Dispara eventos de estoque abaixo do mínimo APÓS o commit (fora da transaction)
      for (const item of estoquesBaixos) {
          AutomacaoEngine.dispararEvento('estoque_abaixo_minimo', item.empresa_id, item);
      }

      return await this.getById(venda.id, currentUser);
    } catch (error) {
      if (!committed) await t.rollback();
      throw new Error(`Erro ao criar venda: ${error.message}`);
    }
  }

  async getAll(filters = {}, currentUser) {
    const where = {};
    if (filters.cliente_id) where.cliente_id = filters.cliente_id;
    if (filters.funcionario_id) where.funcionario_id = filters.funcionario_id;
    if (filters.dataInicio || filters.dataFim) {
      where.data = {};
      if (filters.dataInicio) where.data[Op.gte] = new Date(filters.dataInicio);
      if (filters.dataFim) where.data[Op.lte] = new Date(filters.dataFim);
    }
    await aplicarEscopoVenda(where, currentUser);
    // Pedidos da loja online cancelados continuam registrados para auditoria,
    // mas não representam vendas válidas no histórico/RFM. Use AND para não
    // substituir o escopo de empresa que também usa Op.or.
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { status_loja: { [Op.is]: null } },
          { status_loja: { [Op.notIn]: ['cancelado', 'cancelada'] } },
        ],
      },
    ];
    return await Venda.findAll({
      where,
      include: [
        { model: VendaItem, as: 'itens', include: [{ model: Product, attributes: ['id', 'name'] }] },
        { model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto', 'email'] },
        { model: Cliente, as: 'cliente', attributes: ['id', 'nomeCompleto', 'telefone'] },
      ],
      order: [['data', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']]
    });
  }

  async getById(id, currentUser, transaction = null) {
    const where = { id };
    await aplicarEscopoVenda(where, currentUser);
    const venda = await Venda.findOne({
      where,
      ...(transaction
        ? { transaction, lock: transaction.LOCK.UPDATE }
        : { include: [{ model: VendaItem, as: 'itens' }] }),
    });
    if (!venda) throw new Error('Venda não encontrada');
    // Ler os itens somente após obter o bloqueio da venda: duas exclusões/edições
    // simultâneas não podem devolver os mesmos itens duas vezes.
    if (transaction) {
      venda.itens = await VendaItem.findAll({ where: { venda_id: id }, transaction });
    }
    return venda;
  }

  async update(id, data, currentUser) {
    const t = await sequelize.transaction();
    let committed = false;
    try {
      const venda = await this.getById(id, currentUser, t);
      const variacoesRoupaAlteradas = new Set();
      const agendamentosJaVinculados = new Set(
        venda.itens
          .filter(item => item.tipo === 'servico' && item.agendamento_id)
          .map(item => Number(item.agendamento_id))
      );

      // 1. Reverter estoque. Roupas preservam a trilha de saída e devolução.
      await Movimento.destroy({ where: { origem_tipo: 'venda', origem_id: id }, transaction: t });

      for (const item of venda.itens) {
        if (item.tipo === 'roupa') {
          variacoesRoupaAlteradas.add(Number(await devolverRoupaDaVenda(item, venda, currentUser, t, true)));
        } else if (item.tipo === 'materia_prima' && item.raw_material_id) {
          const mp = await RawMaterial.findByPk(item.raw_material_id, { transaction: t });
          if (mp) await mp.update({ currentQuantity: Number(mp.currentQuantity) + Number(item.quantidade) }, { transaction: t });
        } else if (item.produto_id) {
          const produto = await Product.findByPk(item.produto_id, { transaction: t });
          if (produto) await produto.update({ currentQuantity: Number(produto.currentQuantity) + Number(item.quantidade) }, { transaction: t });
        }
      }

      // 2. Remover itens antigos
      await VendaItem.destroy({ where: { venda_id: id }, transaction: t });

      // 3. Atualizar campos da venda
      const primeiroPag = (data.pagamentos ?? [])[0];
      const dataVenda = data.data ?? venda.data;
      const pagamentosComTaxa = Array.isArray(data.pagamentos)
        ? await Promise.all(data.pagamentos.map(pagamento => taxaCartaoService.aplicar(pagamento, venda.empresa_id, dataVenda)))
        : venda.pagamentos;
      await venda.update({
        cliente_id: data.cliente_id ?? null,
        funcionario_id: data.funcionario_id ?? venda.funcionario_id,
        data: dataVenda,
        forma_pagamento: data.forma_pagamento ?? primeiroPag?.forma ?? venda.forma_pagamento,
        tipo_cartao: data.tipo_cartao ?? null,
        parcelas: data.parcelas ?? 1,
        com_nota: data.com_nota ?? venda.com_nota,
        desconto: data.desconto ?? 0,
        tipo_desconto: data.tipo_desconto ?? 'valor',
        taxa_entrega: data.taxa_entrega ?? 0,
        endereco_entrega: data.endereco_entrega ?? null,
        observacao: data.observacao ?? null,
        cfop: normalizarCfop(data.cfop),
        cst_csosn: normalizarCstCsosn(data.cst_csosn),
        valor_total: data.valor_total,
        pagamentos: pagamentosComTaxa,
        turno_id: data.turno_id ?? venda.turno_id
      }, { transaction: t });

      // 4. Criar novos itens e deduzir estoque
      const servicosAgenda = [];
      for (const item of (data.itens ?? [])) {
        if (item.tipo === 'roupa') {
          const variacao = await carregarVariacaoRoupa(item, venda.empresa_id, t);
          const valoresRoupa = valoresDoItem(item, item.valor_unitario);
          if (!variacao.estoque_infinito && Number(variacao.quantidade_atual) < valoresRoupa.quantidade) {
            throw new Error(`Estoque insuficiente para esta variação (tem ${variacao.quantidade_atual}, precisa ${valoresRoupa.quantidade})`);
          }
          await VendaItem.create({
            venda_id: id,
            produto_id: null,
            tipo: 'roupa',
            roupa_id: variacao.roupa_id,
            variacao_id: variacao.id,
            nome_item: item.nome_item ?? item.nome_servico ?? item.nome ?? 'Peça de roupa',
            quantidade: valoresRoupa.quantidade,
            valor_unitario: valoresRoupa.valor_unitario,
            valor_total: valoresRoupa.valor_total,
          }, { transaction: t });
          if (!variacao.estoque_infinito) {
            await variacao.update({ quantidade_atual: Number(variacao.quantidade_atual) - valoresRoupa.quantidade }, { transaction: t });
            await registrarMovimentoRoupa({
              variacao, venda, tipo: 'saida', quantidade: valoresRoupa.quantidade,
              motivo: 'Venda atualizada', origem_tipo: 'venda', origem_id: id, usuario_id: currentUser?.id,
            }, t);
            variacoesRoupaAlteradas.add(Number(variacao.id));
          }
          continue;
        }

        if (item.tipo === 'materia_prima') {
          const mp = await RawMaterial.findByPk(item.raw_material_id, { transaction: t });
          if (!mp) throw new Error(`Matéria-prima ${item.raw_material_id} não encontrada`);
          if (Number(mp.currentQuantity) < Number(item.quantidade)) {
            throw new Error(`Estoque insuficiente para "${mp.name}" (tem ${Number(mp.currentQuantity)}, precisa ${Number(item.quantidade)})`);
          }
          await VendaItem.create({
            venda_id: id,
            produto_id: null,
            raw_material_id: mp.id,
            tipo: 'materia_prima',
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario ?? mp.price,
            valor_total: item.valor_total ?? (Number(item.valor_unitario ?? mp.price) * Number(item.quantidade))
          }, { transaction: t });
          await mp.update({ currentQuantity: Number(mp.currentQuantity) - Number(item.quantidade) }, { transaction: t });
          continue;
        }

        if (!item.produto_id || Number(item.produto_id) <= 0) {
          const agendamentoId = Number(item.agendamento_id ?? item.agendamentoId);
          const origemCaixa = String(item.origem_servico ?? item.origemServico ?? '').toLowerCase() === 'caixa';
          const origemAgenda = origemCaixa ? null : await this.resolverServicoAgenda(item, venda.empresa_id, t, venda.id, {
            permitirServicoAdicional: agendamentosJaVinculados.has(agendamentoId),
          });
          const servicoAgendaCatalogo = origemCaixa || origemAgenda ? null : await this.resolverServicoAgendaCatalogo(item, venda.empresa_id, t);
          const servicoCatalogo = origemCaixa || origemAgenda || servicoAgendaCatalogo ? null : await this.resolverServicoCatalogo(item, venda.empresa_id, t);
          if (!origemCaixa && !origemAgenda && !servicoAgendaCatalogo && !servicoCatalogo) {
            throw new Error('Selecione um serviço válido do catálogo da empresa');
          }
          const valoresServico = valoresDoItem(item, 0);
          await VendaItem.create({
            venda_id: id,
            produto_id: null,
            nome_item: origemAgenda?.servico.nome ?? servicoAgendaCatalogo?.nome ?? servicoCatalogo?.name ?? item.nome_servico ?? item.nome_item ?? 'Serviço',
            tipo: 'servico',
            quantidade: valoresServico.quantidade,
            valor_unitario: valoresServico.valor_unitario,
            valor_total: valoresServico.valor_total,
            agendamento_id: origemAgenda?.agendamento.id ?? null,
            agendamento_servico_id: origemAgenda?.servico.id ?? servicoAgendaCatalogo?.id ?? null,
            catalogo_servico_id: servicoCatalogo?.id ?? null,
          }, { transaction: t });
          if (origemAgenda) servicosAgenda.push({
            ...origemAgenda,
            quantidade: valoresServico.quantidade,
            valorTotal: valoresServico.valor_total,
          });
          continue;
        }

        const produto = await Product.findByPk(item.produto_id, { transaction: t });
        if (!produto) throw new Error(`Produto ${item.produto_id} não encontrado`);
        const valoresProduto = valoresDoItem(item, produto.price);
        if (Number(produto.currentQuantity) < valoresProduto.quantidade) {
          throw new Error(`Estoque insuficiente para "${produto.name}" (tem ${Number(produto.currentQuantity)}, precisa ${valoresProduto.quantidade})`);
        }
        await VendaItem.create({
          venda_id: id,
          produto_id: produto.id,
          tipo: 'produto',
          quantidade: valoresProduto.quantidade,
          valor_unitario: valoresProduto.valor_unitario,
          valor_total: valoresProduto.valor_total
        }, { transaction: t });
        await produto.update(
          { currentQuantity: Number(produto.currentQuantity) - valoresProduto.quantidade },
          { transaction: t }
        );
        await Movimento.create({
          produto_id: produto.id,
          empresa_id: venda.empresa_id ?? null,
          usuario_id: currentUser?.id ?? null,
          tipo: 'saida',
          quantidade: valoresProduto.quantidade,
          motivo: 'Venda (editada)',
          origem_tipo: 'venda',
          origem_id: id,
          data: new Date()
        }, { transaction: t });
      }

      // 5. Comissões pagas ficam congeladas; apenas pendentes podem ser recalculadas.
      const possuiComissaoPaga = await Comissao.count({
        where: { venda_id: id, status: 'pago' },
        transaction: t,
      });
      if (!possuiComissaoPaga) {
        await Comissao.destroy({ where: { venda_id: id, status: 'pendente' }, transaction: t });
        await this.criarComissoesVenda({
          venda,
          funcionarioId: data.funcionario_id ?? venda.funcionario_id,
          servicosAgenda,
          itens: data.itens ?? [],
          transaction: t,
        });
      }

      await t.commit();
      committed = true;
      await sincronizarRoupasAposCommit(venda.empresa_id, variacoesRoupaAlteradas);
      return await this.getById(id, currentUser);
    } catch (error) {
      if (!committed) await t.rollback();
      throw new Error(`Erro ao atualizar venda: ${error.message}`);
    }
  }

  async delete(id, currentUser) {
    const t = await sequelize.transaction();
    let committed = false;
    try {
      const venda = await this.getById(id, currentUser, t);
      const variacoesRoupaAlteradas = new Set();

      for (const item of venda.itens) {
        if (item.tipo === 'roupa') {
          variacoesRoupaAlteradas.add(Number(await devolverRoupaDaVenda(item, venda, currentUser, t)));
          continue;
        }

        if (item.tipo === 'materia_prima' && item.raw_material_id) {
          const mp = await RawMaterial.findByPk(item.raw_material_id, { transaction: t });
          if (mp) await mp.update({ currentQuantity: Number(mp.currentQuantity) + Number(item.quantidade) }, { transaction: t });
          continue;
        }

        const produto = await Product.findByPk(item.produto_id, { transaction: t });
        if (produto) {
          await produto.update({
            currentQuantity: Number(produto.currentQuantity) + Number(item.quantidade)
          }, { transaction: t });
          await Movimento.create({
            produto_id: produto.id,
            empresa_id: venda.empresa_id ?? null,
            usuario_id: currentUser?.id ?? null,
            tipo: 'entrada',
            quantidade: item.quantidade,
            motivo: 'Cancelamento de venda',
            origem_tipo: 'venda_cancelada',
            origem_id: venda.id,
            data: new Date()
          }, { transaction: t });
        }
      }

      await VendaItem.destroy({ where: { venda_id: id }, transaction: t });
      await Comissao.destroy({ where: { venda_id: id }, transaction: t });
      if (venda.orcamento_id) {
        await Orcamento.update(
          { status: 'em_aberto' },
          { where: { id: venda.orcamento_id, empresa_id: venda.empresa_id }, transaction: t },
        );
      }
      await Venda.destroy({ where: { id }, transaction: t });

      await t.commit();
      committed = true;
      await sincronizarRoupasAposCommit(venda.empresa_id, variacoesRoupaAlteradas);
      return true;
    } catch (error) {
      if (!committed) await t.rollback();
      throw new Error(`Erro ao deletar venda: ${error.message}`);
    }
  }
}

export { valoresDoItem };
export default new VendaService();
