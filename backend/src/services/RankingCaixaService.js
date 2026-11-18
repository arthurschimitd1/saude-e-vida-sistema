import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from '../models/UserModel.js';
import { podeVerTodasComissoes } from '../utils/comissaoAccess.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const dinheiro = valor => Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;

const dataValida = valor => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
  const data = new Date(`${valor}T12:00:00-03:00`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};

export const validarPeriodoRanking = ({ inicio, fim }) => {
  if (!dataValida(inicio) || !dataValida(fim) || fim < inicio) {
    throw Object.assign(new Error('Informe um período válido.'), { status: 400 });
  }
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86400000;
  if (dias > 365) throw Object.assign(new Error('O período pode ter no máximo um ano.'), { status: 400 });
  return { inicio, fim };
};

const inicioDoDia = data => new Date(`${data}T00:00:00-03:00`);
const dataCurta = data => data.toISOString().slice(0, 10);

const periodoAnterior = ({ inicio, fim }) => {
  const inicioAtual = inicioDoDia(inicio);
  const fimExclusivo = new Date(inicioDoDia(fim).getTime() + 86400000);
  const duracao = fimExclusivo.getTime() - inicioAtual.getTime();
  const fimAnterior = new Date(inicioAtual.getTime());
  const inicioAnterior = new Date(inicioAtual.getTime() - duracao);
  return {
    inicio: dataCurta(inicioAnterior),
    fim: dataCurta(new Date(fimAnterior.getTime() - 86400000))
  };
};

const consultarRanking = ({ empresaId, inicio, fim, funcionarioId }) => sequelize.query(`
  WITH vendas_filtradas AS (
    SELECT id, funcionario_id, cliente_id, valor_total, COALESCE(taxa_entrega, 0) AS taxa_entrega
    FROM vendas
    WHERE empresa_id = :empresaId
      AND data >= :inicio
      AND data < :fimExclusivo
      AND (:funcionarioId IS NULL OR funcionario_id = :funcionarioId)
  ),
  vendas_por_profissional AS (
    SELECT
      funcionario_id,
      COUNT(*)::integer AS vendas,
      COUNT(DISTINCT cliente_id)::integer AS clientes,
      COALESCE(SUM(valor_total), 0)::numeric AS faturamento
    FROM vendas_filtradas
    GROUP BY funcionario_id
  ),
  totais_por_venda AS (
    SELECT item.venda_id, COALESCE(SUM(item.valor_total), 0)::numeric AS subtotal_itens
    FROM venda_itens item
    INNER JOIN vendas_filtradas venda ON venda.id = item.venda_id
    GROUP BY item.venda_id
  ),
  itens_por_profissional AS (
    SELECT
      venda.funcionario_id,
      COALESCE(SUM(CASE WHEN item.tipo = 'servico' THEN item.quantidade ELSE 0 END), 0)::numeric AS servicos_quantidade,
      COALESCE(SUM(CASE WHEN item.tipo <> 'servico' THEN item.quantidade ELSE 0 END), 0)::numeric AS produtos_quantidade,
      COALESCE(SUM(CASE WHEN item.tipo = 'servico' AND total.subtotal_itens > 0
        THEN item.valor_total / total.subtotal_itens * GREATEST(venda.valor_total - venda.taxa_entrega, 0)
        ELSE 0 END), 0)::numeric AS servicos_valor,
      COALESCE(SUM(CASE WHEN item.tipo <> 'servico' AND total.subtotal_itens > 0
        THEN item.valor_total / total.subtotal_itens * GREATEST(venda.valor_total - venda.taxa_entrega, 0)
        ELSE 0 END), 0)::numeric AS produtos_valor
    FROM vendas_filtradas venda
    INNER JOIN venda_itens item ON item.venda_id = venda.id
    INNER JOIN totais_por_venda total ON total.venda_id = venda.id
    GROUP BY venda.funcionario_id
  )
  SELECT
    COALESCE(venda.funcionario_id, 0)::integer AS profissional_id,
    COALESCE(NULLIF(usuario."nomeCompleto", ''), 'Sem profissional vinculado') AS profissional,
    venda.vendas,
    venda.clientes,
    venda.faturamento,
    COALESCE(itens.servicos_quantidade, 0)::numeric AS servicos_quantidade,
    COALESCE(itens.servicos_valor, 0)::numeric AS servicos_valor,
    COALESCE(itens.produtos_quantidade, 0)::numeric AS produtos_quantidade,
    COALESCE(itens.produtos_valor, 0)::numeric AS produtos_valor
  FROM vendas_por_profissional venda
  LEFT JOIN itens_por_profissional itens ON itens.funcionario_id IS NOT DISTINCT FROM venda.funcionario_id
  LEFT JOIN users usuario ON usuario.id = venda.funcionario_id
  ORDER BY venda.faturamento DESC, profissional ASC
`, {
  replacements: {
    empresaId,
    inicio: inicioDoDia(inicio),
    fimExclusivo: new Date(inicioDoDia(fim).getTime() + 86400000),
    funcionarioId: funcionarioId || null
  },
  type: QueryTypes.SELECT
});

export const montarRankingCaixa = ({ atual = [], anterior = [] }) => {
  const anteriorPorProfissional = new Map(anterior.map(linha => [Number(linha.profissional_id), linha]));
  const ranking = atual
    .map(linha => {
      const faturamento = dinheiro(linha.faturamento);
      const vendas = Number(linha.vendas || 0);
      const faturamentoAnterior = dinheiro(anteriorPorProfissional.get(Number(linha.profissional_id))?.faturamento);
      return {
        profissional_id: Number(linha.profissional_id),
        profissional: linha.profissional,
        vendas,
        clientes: Number(linha.clientes || 0),
        faturamento,
        ticket_medio: vendas ? dinheiro(faturamento / vendas) : 0,
        servicos_quantidade: Number(linha.servicos_quantidade || 0),
        servicos_valor: dinheiro(linha.servicos_valor),
        produtos_quantidade: Number(linha.produtos_quantidade || 0),
        produtos_valor: dinheiro(linha.produtos_valor),
        faturamento_anterior: faturamentoAnterior,
        variacao_percentual: faturamentoAnterior > 0
          ? dinheiro(((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100)
          : null
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento || a.profissional.localeCompare(b.profissional));

  ranking.forEach((linha, indice) => { linha.posicao = indice + 1; });
  const resumo = ranking.reduce((total, linha) => ({
    faturamento: dinheiro(total.faturamento + linha.faturamento),
    vendas: total.vendas + linha.vendas,
    clientes: total.clientes + linha.clientes,
    servicos_quantidade: total.servicos_quantidade + linha.servicos_quantidade,
    servicos_valor: dinheiro(total.servicos_valor + linha.servicos_valor),
    produtos_quantidade: total.produtos_quantidade + linha.produtos_quantidade,
    produtos_valor: dinheiro(total.produtos_valor + linha.produtos_valor)
  }), {
    faturamento: 0, vendas: 0, clientes: 0, servicos_quantidade: 0,
    servicos_valor: 0, produtos_quantidade: 0, produtos_valor: 0
  });
  resumo.ticket_medio = resumo.vendas ? dinheiro(resumo.faturamento / resumo.vendas) : 0;
  return { ranking, resumo };
};

class RankingCaixaService {
  async consultar(query, user) {
    const periodo = validarPeriodoRanking(query);
    const empresaId = Number(empresaParaGravar(user));
    if (!empresaId) throw Object.assign(new Error('Selecione uma empresa para consultar o ranking.'), { status: 403 });

    const gestor = podeVerTodasComissoes(user);
    const profissionalInformado = query.profissional_id ? Number(query.profissional_id) : null;
    if (query.profissional_id && (!Number.isInteger(profissionalInformado) || profissionalInformado <= 0)) {
      throw Object.assign(new Error('Profissional inválido.'), { status: 400 });
    }
    const funcionarioId = gestor ? profissionalInformado : Number(user?.id) || -1;
    const anterior = periodoAnterior(periodo);
    const [atual, periodoPassado, profissionais] = await Promise.all([
      consultarRanking({ empresaId, ...periodo, funcionarioId }),
      consultarRanking({ empresaId, ...anterior, funcionarioId }),
      gestor
        ? User.findAll({
          where: { empresa_id: empresaId, status: 'ativo' },
          attributes: ['id', 'nomeCompleto'],
          order: [['nomeCompleto', 'ASC']],
          raw: true
        })
        : []
    ]);
    return {
      ...montarRankingCaixa({ atual, anterior: periodoPassado }),
      inicio: periodo.inicio,
      fim: periodo.fim,
      periodo_anterior: anterior,
      gestor,
      filtros: {
        profissionais: profissionais.map(profissional => ({
          id: profissional.id,
          nome: profissional.nomeCompleto
        }))
      }
    };
  }
}

export default new RankingCaixaService();
