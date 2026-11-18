// Todas as consultas recebem empresaId validado. Valores monetários saem como
// strings decimais; nenhum cálculo financeiro é delegado ao navegador.
export const vendasBase = `SELECT v.* FROM vendas v WHERE v.empresa_id = :empresaId`;
export const recebiveisBase = `SELECT cr.*, (cr.valor - cr.valor_pago) AS saldo
  FROM contas_receber cr
  WHERE cr.empresa_id = :empresaId AND cr.status = 'ABERTA'
    AND (:carteira = 'completa' OR cr.data_vencimento BETWEEN CAST(:inicio AS date) AND CAST(:fim AS date))
    AND (cr.cliente_id IS NULL OR EXISTS (SELECT 1 FROM clientes c WHERE c.id=cr.cliente_id AND c.empresa_id=:empresaId))
    AND (cr.venda_id IS NULL OR EXISTS (SELECT 1 FROM vendas v WHERE v.id=cr.venda_id AND v.empresa_id=:empresaId))
    AND (cr.nota_fiscal_id IS NULL OR EXISTS (SELECT 1 FROM notas_fiscais_emitidas n WHERE n.id=cr.nota_fiscal_id AND n.empresa_id=:empresaId))`;
export const saidasBase = `SELECT s.*, COALESCE(NULLIF(TRIM(s.categoria),''), NULLIF(TRIM(s.tipo),''), 'Não classificado') AS classificacao
  FROM saidas s WHERE s.empresa_id=:empresaId AND s.natureza='SAIDA'
    AND s.data >= :inicioInstant AND s.data < :fimInstant`;
export const estoqueBase = `
  SELECT 'produto:'||p.id AS chave, p.name AS nome, 'Produtos' AS familia,
    COALESCE(NULLIF(TRIM(p.unidade_medida),''),'Unidade não informada') AS unidade,
    p."currentQuantity"::numeric AS quantidade, p."minQuantity"::numeric AS minimo, false AS infinito,
    p."createdAt" AS criado_em, 'produto' AS tipo, p.id AS origem_id
  FROM "Products" p WHERE p.empresa_id=:empresaId
    AND (p.raw_material_id IS NULL OR EXISTS(SELECT 1 FROM raw_materials r WHERE r.id=p.raw_material_id AND r.empresa_id=:empresaId))
  UNION ALL
  SELECT 'materia:'||r.id, r.name, 'Matérias-primas', COALESCE(NULLIF(TRIM(r.unit),''),'Unidade não informada'),
    r."currentQuantity", r.min_quantity, false, r."createdAt", 'materia_prima', r.id
  FROM raw_materials r WHERE r.empresa_id=:empresaId
    AND NOT EXISTS(SELECT 1 FROM "Products" p WHERE p.raw_material_id=r.id)
  UNION ALL
  SELECT 'roupa:'||ev.id, er.nome || ' · ' || COALESCE(ev.cor,'') || ' ' || COALESCE(ev.tamanho,''),
    'Variações de roupas', 'un', ev.quantidade_atual::numeric, ev.quantidade_minima::numeric,
    ev.estoque_infinito, ev."createdAt", 'roupa', ev.id
  FROM estoque_roupas_variacoes ev JOIN estoque_roupas er ON er.id=ev.roupa_id AND er.empresa_id=:empresaId`;

export const SALES_SQL = `WITH base AS (${vendasBase}), totals AS (
 SELECT COUNT(*) FILTER(WHERE data>=:inicioInstant)::int AS quantidade,
  COUNT(*) FILTER(WHERE data< :inicioInstant)::int AS quantidade_anterior,
  COUNT(*) FILTER(WHERE data>=:inicioInstant AND (valor_total IS NULL OR valor_total<0))::int AS invalidos,
  COUNT(*) FILTER(WHERE data< :inicioInstant AND (valor_total IS NULL OR valor_total<0))::int AS invalidos_anterior,
  COALESCE(SUM(valor_total) FILTER(WHERE data>=:inicioInstant),0) AS total,
  COALESCE(SUM(valor_total) FILTER(WHERE data< :inicioInstant),0) AS anterior
 FROM base WHERE data>=:anteriorInstant AND data< :fimInstant
), serie AS (
 SELECT (data AT TIME ZONE 'America/Fortaleza')::date AS dia,
   CASE WHEN COUNT(*) FILTER(WHERE valor_total IS NULL OR valor_total<0)>0 THEN NULL ELSE SUM(valor_total)::text END AS valor,
   COUNT(*)::int AS quantidade FROM base WHERE data>=:inicioInstant AND data< :fimInstant GROUP BY 1
)
SELECT json_build_object('quantidade',quantidade,'quantidadeAnterior',quantidade_anterior,
 'total',CASE WHEN invalidos=0 THEN total::text END,
 'anterior',CASE WHEN invalidos_anterior=0 THEN anterior::text END,
 'ticket',CASE WHEN invalidos=0 AND quantidade>0 THEN ROUND(total/quantidade,2)::text END,
 'variacao',CASE WHEN invalidos=0 AND invalidos_anterior=0 AND anterior>0 THEN ROUND((total-anterior)/anterior*100,2)::text END,
 'invalidos',invalidos,'serie',COALESCE((SELECT json_agg(serie ORDER BY dia) FROM serie),'[]'::json)) AS dados FROM totals`;

export const RECEIVABLES_SQL = `WITH base AS (${recebiveisBase}), validos AS (
 SELECT *, CASE WHEN data_vencimento<CAST(:hoje AS date) THEN 'Vencidos'
 WHEN data_vencimento-CAST(:hoje AS date)<=30 THEN '0–30 dias'
 WHEN data_vencimento-CAST(:hoje AS date)<=60 THEN '31–60 dias'
 WHEN data_vencimento-CAST(:hoje AS date)<=90 THEN '61–90 dias' ELSE '+90 dias' END AS faixa
 FROM base WHERE valor IS NOT NULL AND valor_pago IS NOT NULL AND valor>=0 AND valor_pago>=0 AND valor_pago<=valor AND data_vencimento IS NOT NULL
), totals AS (
 SELECT COUNT(*) FILTER(WHERE saldo>0)::int AS quantidade, COALESCE(SUM(saldo),0) AS total,
 COALESCE(SUM(saldo) FILTER(WHERE data_vencimento<CAST(:hoje AS date)),0) AS vencidos,
 COUNT(*) FILTER(WHERE saldo>0 AND data_vencimento<CAST(:hoje AS date))::int AS quantidade_vencidos,
 COALESCE(SUM(saldo) FILTER(WHERE data_vencimento=CAST(:hoje AS date)),0) AS hoje,
 COALESCE(SUM(saldo) FILTER(WHERE data_vencimento>CAST(:hoje AS date)),0) AS a_vencer,
 COUNT(*) FILTER(WHERE saldo>0 AND data_vencimento BETWEEN CAST(:hoje AS date) AND CAST(:hoje AS date)+7)::int AS proximos
 FROM validos
), aging AS (
 SELECT faixa, SUM(saldo)::text AS valor, COUNT(*)::int AS quantidade,
 ROUND(SUM(saldo)/NULLIF((SELECT total FROM totals),0)*100,2)::text AS percentual FROM validos WHERE saldo>0 GROUP BY faixa
)
SELECT json_build_object('total',total::text,'quantidade',quantidade,'vencidos',vencidos::text,
 'quantidadeVencidos',quantidade_vencidos,'venceHoje',hoje::text,'aVencer',a_vencer::text,'proximos',proximos,
 'inadimplencia',ROUND(vencidos/NULLIF(total,0)*100,2)::text,
 'invalidos',(SELECT COUNT(*) FROM base)-(SELECT COUNT(*) FROM validos),
 'aging',COALESCE((SELECT json_agg(aging) FROM aging),'[]'::json)) AS dados FROM totals`;

export const OUTGOINGS_SQL = `WITH base AS (${saidasBase}), validos AS (SELECT * FROM base WHERE valor IS NOT NULL AND valor>=0),
 grupos AS (SELECT classificacao AS nome,SUM(valor)::text AS valor,COUNT(*)::int AS quantidade,
 ROUND(SUM(valor)/NULLIF((SELECT SUM(valor) FROM validos),0)*100,2)::text AS percentual FROM validos GROUP BY classificacao),
 centros AS (SELECT COALESCE(c.nome,'Sem centro informado ou vínculo válido') AS nome,SUM(s.valor)::text AS valor
 FROM validos s LEFT JOIN centros_de_custos c ON c.id=s.centro_custo_id AND c.empresa_id=:empresaId GROUP BY c.id,c.nome),
 maiores AS (SELECT id,COALESCE(NULLIF(descricao,''),classificacao) AS nome,classificacao,status,valor::text,
 ROUND(valor/NULLIF((SELECT SUM(valor) FROM validos),0)*100,2)::text AS percentual FROM validos ORDER BY valor::numeric DESC,id DESC LIMIT 5),
 estados AS (SELECT COALESCE(status,'Não informado') AS nome,SUM(valor)::text AS valor,COUNT(*)::int AS quantidade FROM validos GROUP BY status)
 SELECT json_build_object('total',COALESCE((SELECT SUM(valor) FROM validos),0)::text,
 'quantidade',(SELECT COUNT(*) FROM base),'invalidos',(SELECT COUNT(*) FROM base)-(SELECT COUNT(*) FROM validos),
 'composicao',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM grupos ORDER BY valor::numeric DESC,nome LIMIT 12)x),'[]'::json),
 'categoriasOmitidas',GREATEST((SELECT COUNT(*) FROM grupos)-12,0),
 'naoClassificados',(SELECT COUNT(*) FROM base WHERE classificacao='Não classificado'),
 'centros',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM centros ORDER BY valor::numeric DESC,nome LIMIT 12)x),'[]'::json),
 'centrosOmitidos',GREATEST((SELECT COUNT(*) FROM centros)-12,0),
 'maiores',COALESCE((SELECT json_agg(maiores) FROM maiores),'[]'::json),
 'estados',COALESCE((SELECT json_agg(estados) FROM estados),'[]'::json)) AS dados`;

export const CUSTOMERS_SQL = `WITH base AS (
 SELECT v.*,c.id AS cliente_valido,c."nomeCompleto" AS nome FROM (${vendasBase})v
 LEFT JOIN clientes c ON c.id=v.cliente_id AND c.empresa_id=:empresaId
 WHERE v.data>=:inicioInstant AND v.data< :fimInstant
), ranking AS (SELECT cliente_valido AS id,nome,
 CASE WHEN COUNT(*) FILTER(WHERE valor_total IS NULL OR valor_total<0)=0 THEN SUM(valor_total)::text END AS valor,
 COUNT(*)::int AS quantidade FROM base WHERE cliente_valido IS NOT NULL GROUP BY cliente_valido,nome)
SELECT json_build_object('comCompras',(SELECT COUNT(DISTINCT cliente_valido) FROM base),
 'novos',(SELECT COUNT(*) FROM clientes WHERE empresa_id=:empresaId AND created_at>=:inicioInstant AND created_at< :fimInstant),
 'semCliente',(SELECT COUNT(*) FROM base WHERE cliente_id IS NULL),
 'vinculoInvalido',(SELECT COUNT(*) FROM base WHERE cliente_id IS NOT NULL AND cliente_valido IS NULL),
 'valorSemCliente',(SELECT CASE WHEN COUNT(*) FILTER(WHERE valor_total IS NULL OR valor_total<0)=0 THEN COALESCE(SUM(valor_total),0)::text END FROM base WHERE cliente_id IS NULL),
 'ranking',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM ranking ORDER BY valor::numeric DESC NULLS LAST,id LIMIT 5)x),'[]'::json),
 'novasRecorrencias',(SELECT COUNT(*) FROM recorrencias WHERE empresa_id=:empresaId AND created_at>=:inicioInstant AND created_at< :fimInstant)) AS dados`;

// Desconto rateado no subtotal da venda, inclusive serviços, mas os rankings
// incluem somente produtos identificados. Falta de desconto/subtotal invalida
// o ranking por valor; não inventamos custo, preço, unidade ou vínculo.
export const PRODUCTS_SQL = `WITH catalogo AS (${estoqueBase}), vendas_periodo AS (
 SELECT v.* FROM (${vendasBase})v WHERE data>=:inicioInstant AND data< :fimInstant
), totais_itens AS (
 SELECT i.venda_id,SUM(i.valor_total) AS subtotal,
 BOOL_AND(i.valor_total IS NOT NULL AND i.valor_total>=0 AND i.quantidade IS NOT NULL AND i.quantidade>=0) AS valido
 FROM venda_itens i JOIN vendas_periodo v ON v.id=i.venda_id GROUP BY i.venda_id
), itens AS (
 SELECT i.*,v.desconto,v.tipo_desconto,t.subtotal,t.valido,
 CASE WHEN i.tipo='roupa' THEN 'roupa:'||i.variacao_id
 WHEN i.raw_material_id IS NOT NULL THEN 'materia:'||i.raw_material_id
 WHEN i.tipo='produto' THEN 'produto:'||i.produto_id END AS chave
 FROM venda_itens i JOIN vendas_periodo v ON v.id=i.venda_id JOIN totais_itens t ON t.venda_id=v.id
), agregados AS (
 SELECT c.chave,c.nome,c.unidade,c.familia,
 BOOL_AND(i.quantidade IS NOT NULL AND i.quantidade>=0) AS quantidade_valida,
 SUM(i.quantidade) AS quantidade,
 BOOL_AND(i.valido AND i.desconto IS NOT NULL AND i.desconto>=0 AND i.tipo_desconto IN ('valor','percent')
 AND (i.desconto=0 OR (i.subtotal>0 AND ((i.tipo_desconto='valor' AND i.desconto<=i.subtotal) OR (i.tipo_desconto<>'valor' AND i.desconto<=100))))) AS valor_valido,
 SUM(i.valor_total*(1-CASE WHEN i.desconto=0 THEN 0 WHEN i.tipo_desconto='valor' THEN i.desconto/NULLIF(i.subtotal,0) ELSE i.desconto/100 END)) AS valor
 FROM itens i JOIN catalogo c ON c.chave=i.chave
 WHERE (i.tipo<>'roupa' OR EXISTS(SELECT 1 FROM estoque_roupas_variacoes ev WHERE ev.id=i.variacao_id AND ev.roupa_id=i.roupa_id))
 GROUP BY c.chave,c.nome,c.unidade,c.familia
), classificados AS (
 SELECT chave,nome,unidade,familia,CASE WHEN quantidade_valida THEN quantidade::text END AS quantidade,
 CASE WHEN valor_valido THEN ROUND(valor,2)::text END AS valor FROM agregados
), menos AS (
 SELECT c.chave,c.nome,c.unidade,c.familia,
 CASE WHEN a.chave IS NULL THEN '0' WHEN a.quantidade_valida THEN a.quantidade::text END AS quantidade
 FROM catalogo c LEFT JOIN agregados a ON a.chave=c.chave WHERE c.criado_em< :fimInstant
)
SELECT json_build_object(
 'porValor',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM classificados WHERE valor IS NOT NULL ORDER BY valor::numeric DESC,chave LIMIT 5)x),'[]'::json),
 'porQuantidade',COALESCE((SELECT json_agg(r) FROM (SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY unidade ORDER BY quantidade::numeric DESC,chave) AS posicao FROM classificados WHERE quantidade IS NOT NULL)x WHERE posicao<=5 ORDER BY unidade,posicao LIMIT 30)r),'[]'::json),
 'menosVendidos',COALESCE((SELECT json_agg(r) FROM (SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY unidade ORDER BY quantidade::numeric ASC,chave) AS posicao FROM menos WHERE quantidade IS NOT NULL)x WHERE posicao<=5 ORDER BY unidade,posicao LIMIT 30)r),'[]'::json),
 'valoresIndisponiveis',(SELECT COUNT(*) FROM classificados WHERE valor IS NULL),
 'itensSemCatalogo',(SELECT COUNT(*) FROM itens i WHERE i.chave IS NOT NULL AND NOT EXISTS(SELECT 1 FROM catalogo c WHERE c.chave=i.chave))) AS dados`;

export const STOCK_SQL = `WITH base AS (${estoqueBase}), grupos AS (
 SELECT familia,unidade,COUNT(*)::int AS skus,
 CASE WHEN COUNT(*) FILTER(WHERE NOT infinito AND quantidade IS NULL)=0 THEN COALESCE(SUM(quantidade) FILTER(WHERE NOT infinito),0)::text END AS quantidade,
 COUNT(*) FILTER(WHERE infinito)::int AS infinitos,
 COUNT(*) FILTER(WHERE NOT infinito AND quantidade>0 AND minimo IS NOT NULL AND quantidade<minimo)::int AS baixos,
 COUNT(*) FILTER(WHERE NOT infinito AND quantidade<=0)::int AS zerados
 FROM base GROUP BY familia,unidade
)
SELECT json_build_object('skus',(SELECT COUNT(*) FROM base),
 'infinitos',(SELECT COUNT(*) FROM base WHERE infinito),
 'baixos',(SELECT COUNT(*) FROM base WHERE NOT infinito AND quantidade>0 AND quantidade<minimo),
 'zerados',(SELECT COUNT(*) FROM base WHERE NOT infinito AND quantidade<=0),
 'invalidos',(SELECT COUNT(*) FROM base WHERE NOT infinito AND (quantidade IS NULL OR minimo IS NULL)),
 'grupos',COALESCE((SELECT json_agg(grupos ORDER BY familia,unidade) FROM grupos),'[]'::json)) AS dados`;

export function detalhesSQL(tipo) {
  const selects = {
    vendas: `SELECT v.id::text AS id, (v.data AT TIME ZONE 'America/Fortaleza') AS data, 'Venda #'||v.id AS descricao,
      CASE WHEN v.valor_total>=0 THEN v.valor_total::text END AS valor,
      COALESCE(c."nomeCompleto",CASE WHEN v.cliente_id IS NULL THEN 'Sem cliente identificado' ELSE 'Vínculo de cliente indisponível' END) AS classificacao,
      'Registrada' AS status FROM (${vendasBase})v LEFT JOIN clientes c ON c.id=v.cliente_id AND c.empresa_id=:empresaId WHERE v.data>=:inicioInstant AND v.data< :fimInstant`,
    recebiveis: `SELECT id::text,data_vencimento::timestamp AS data,descricao,
      CASE WHEN valor>=0 AND valor_pago>=0 AND valor_pago<=valor THEN saldo::text END AS valor,
      'Título cadastrado' AS classificacao,CASE WHEN data_vencimento<CAST(:hoje AS date) THEN 'Vencido' WHEN data_vencimento=CAST(:hoje AS date) THEN 'Vence hoje' ELSE 'A vencer' END AS status FROM (${recebiveisBase})cr WHERE saldo>0`,
    saidas: `SELECT id::text,(data AT TIME ZONE 'America/Fortaleza') AS data,COALESCE(NULLIF(descricao,''),classificacao) AS descricao,CASE WHEN valor>=0 THEN valor::text END AS valor,classificacao,status FROM (${saidasBase})s`,
    estoque: `SELECT chave AS id,NULL::timestamp AS data,nome AS descricao,CASE WHEN infinito THEN NULL ELSE quantidade::text END AS valor,
      familia||' · '||unidade AS classificacao,CASE WHEN infinito THEN 'Estoque infinito' WHEN quantidade IS NULL THEN 'Indisponível' WHEN quantidade<=0 THEN 'Sem estoque' WHEN quantidade<minimo THEN 'Estoque baixo' ELSE 'Em estoque' END AS status FROM (${estoqueBase})s`,
  };
  if (!selects[tipo]) throw new Error('Tipo de detalhe inválido');
  return `WITH base AS (${selects[tipo]}), pagina AS (SELECT * FROM base ORDER BY data DESC NULLS LAST,id LIMIT :tamanho OFFSET :offset)
    SELECT json_build_object('total',(SELECT COUNT(*) FROM base),'itens',COALESCE((SELECT json_agg(pagina) FROM pagina),'[]'::json)) AS dados`;
}

