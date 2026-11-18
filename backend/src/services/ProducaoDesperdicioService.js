import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';
export { resolveDesperdicioPeriodo } from '../utils/producaoDesperdicioPeriodo.js';
import { resolveDesperdicioPeriodo } from '../utils/producaoDesperdicioPeriodo.js';

const CLASSIFICACAO_LABELS = {
  rendimento_excedente: 'Rendimento excedente',
  desperdicio_real: 'Desperdício real',
  outro: 'Outro'
};

const normalizarClassificacao = (item) => {
  if (item.classificacao_desperdicio && CLASSIFICACAO_LABELS[item.classificacao_desperdicio]) {
    return item.classificacao_desperdicio;
  }
  return item.tipo_movimento === 'RENDIMENTO_EXCEDENTE' ? 'rendimento_excedente' : 'desperdicio_real';
};

class ProducaoDesperdicioService {
  async listar({ periodo, dataInicio, dataFim } = {}, currentUser) {
    const empresaId = empresaParaGravar(currentUser);
    if (!empresaId) {
      const error = new Error('Selecione uma empresa para consultar os desperdícios');
      error.status = 400;
      throw error;
    }

    const intervalo = resolveDesperdicioPeriodo({ periodo, dataInicio, dataFim });
    const itens = await sequelize.query(`
      SELECT
        m.id,
        m.data,
        m.quantidade,
        m.produto_id,
        m.usuario_id,
        m.origem_id AS ordem_id,
        m.motivo,
        p.name AS produto_nome,
        COALESCE(p.unidade_medida, p.unidade_comercial, p.unidade_tributavel, 'UN') AS unidade,
        COALESCE(NULLIF(p.preco_compra, 0), NULLIF(rm.price, 0), NULLIF(p.price, 0), 0) AS custo_unitario,
        o.receita_id,
        o.quantidade AS ordem_quantidade,
        o.quantidade_final,
        r.nome AS receita_nome,
        m.classificacao_desperdicio,
        m.observacao_desperdicio,
        o.observacao_desperdicio AS ordem_observacao_desperdicio,
        m.tipo_movimento
      FROM movimentos m
      LEFT JOIN "Products" p ON p.id = m.produto_id
      LEFT JOIN raw_materials rm ON rm.id = p.raw_material_id
      LEFT JOIN ordens_producao o ON o.id = m.origem_id AND m.origem_tipo = 'producao'
      LEFT JOIN receitas r ON r.id = o.receita_id
      WHERE m.empresa_id = :empresaId
        AND m.tipo = 'saida'
        AND m.origem_tipo = 'producao'
        AND (o.id IS NULL OR o.status = 'concluida')
        AND (
          m.tipo_movimento IN ('DESPERDICIO', 'RENDIMENTO_EXCEDENTE')
          OR m.motivo ILIKE 'Desperdício %'
        )
        AND m.data >= CAST(:dataInicio AS DATE)
        AND m.data < (CAST(:dataFim AS DATE) + INTERVAL '1 day')
      ORDER BY m.data DESC, m.id DESC
    `, {
      replacements: { empresaId, dataInicio: intervalo.dataInicio, dataFim: intervalo.dataFim },
      type: QueryTypes.SELECT
    });

    const normalizados = itens.map((item) => ({
      classificacao: normalizarClassificacao(item),
      classificacaoLabel: CLASSIFICACAO_LABELS[normalizarClassificacao(item)],
      id: item.id,
      data: item.data,
      quantidade: Number(item.quantidade || 0),
      custoUnitario: Number(item.custo_unitario || 0),
      custoEstimado: Number(item.quantidade || 0) * Number(item.custo_unitario || 0),
      produtoId: item.produto_id,
      produtoNome: item.produto_nome || 'Produto não identificado',
      unidade: item.unidade || 'UN',
      ordemId: item.ordem_id,
      receitaId: item.receita_id,
      receitaNome: item.receita_nome || 'Receita não identificada',
      ordemQuantidade: item.ordem_quantidade == null ? null : Number(item.ordem_quantidade),
      quantidadeFinal: item.quantidade_final == null ? null : Number(item.quantidade_final),
      motivo: item.motivo,
      observacao: item.observacao_desperdicio || item.ordem_observacao_desperdicio || null
    }));

    const porProduto = new Map();
    for (const item of normalizados) {
      const chave = `${item.produtoId ?? 'sem-id'}:${item.unidade}`;
      const atual = porProduto.get(chave) || {
        produtoId: item.produtoId,
        produtoNome: item.produtoNome,
        unidade: item.unidade,
        quantidade: 0,
        custoEstimado: 0,
        custoUnitario: item.custoUnitario,
        ocorrencias: 0
      };
      atual.quantidade += item.quantidade;
      atual.custoEstimado += item.custoEstimado;
      if (!atual.custoUnitario && item.custoUnitario) atual.custoUnitario = item.custoUnitario;
      atual.ocorrencias += 1;
      porProduto.set(chave, atual);
    }

    return {
      ...intervalo,
      resumo: {
        totalQuantidade: normalizados.reduce((total, item) => total + item.quantidade, 0),
        totalCustoEstimado: normalizados.reduce((total, item) => total + item.custoEstimado, 0),
        totalOcorrencias: normalizados.length,
        totalProdutos: porProduto.size,
        totalSemCusto: normalizados.filter(item => item.custoUnitario <= 0).length,
        totalRendimentoExcedente: normalizados
          .filter(item => item.classificacao === 'rendimento_excedente')
          .reduce((total, item) => total + item.quantidade, 0),
        totalDesperdicioReal: normalizados
          .filter(item => item.classificacao === 'desperdicio_real')
          .reduce((total, item) => total + item.quantidade, 0),
        porProduto: [...porProduto.values()].sort((a, b) => b.quantidade - a.quantidade)
      },
      itens: normalizados
    };
  }
}

export default new ProducaoDesperdicioService();
