import { estoqueBase } from "../queries.js";

// Importação unilateral de uma base existente; a Visão Geral não depende destas consultas.
export const BASE = `WITH catalogo AS (
 SELECT s.*, COALESCE(p.code,er.codigo,'') AS codigo,
 CASE WHEN infinito THEN 'infinito' WHEN quantidade IS NULL OR minimo IS NULL OR minimo<0 THEN 'indisponivel'
 WHEN quantidade<=0 THEN 'zero' WHEN quantidade<minimo THEN 'baixo' ELSE 'normal' END AS status,
 CASE WHEN NOT infinito AND quantidade IS NOT NULL AND minimo>=0 THEN GREATEST(minimo-quantidade,0) END AS necessidade
 FROM (${estoqueBase}) s LEFT JOIN "Products" p ON s.tipo='produto' AND p.id=s.origem_id AND p.empresa_id=:empresaId
 LEFT JOIN estoque_roupas_variacoes ev ON s.tipo='roupa' AND ev.id=s.origem_id
 LEFT JOIN estoque_roupas er ON er.id=ev.roupa_id AND er.empresa_id=:empresaId
), itens_identificados AS (
 SELECT i.*, CASE WHEN i.tipo='roupa' THEN 'roupa:'||i.variacao_id
 WHEN i.raw_material_id IS NOT NULL THEN 'materia:'||i.raw_material_id
 WHEN i.tipo='produto' THEN 'produto:'||i.produto_id END AS chave
 FROM venda_itens i
 WHERE i.tipo<>'roupa' OR EXISTS(SELECT 1 FROM estoque_roupas_variacoes ev JOIN estoque_roupas er ON er.id=ev.roupa_id
 WHERE ev.id=i.variacao_id AND ev.roupa_id=i.roupa_id AND er.empresa_id=:empresaId)
), vendas_escopo AS (
 SELECT v.* FROM vendas v WHERE v.empresa_id=:empresaId AND v.data< :fimInstant
 AND (:cliente =0 OR (v.cliente_id=:cliente AND EXISTS(SELECT 1 FROM clientes c WHERE c.id=v.cliente_id AND c.empresa_id=:empresaId)))
 AND (:produto ='' OR EXISTS(SELECT 1 FROM itens_identificados i JOIN catalogo c ON c.chave=i.chave WHERE i.venda_id=v.id AND i.chave=:produto))
), catalogo_filtrado AS (
 SELECT * FROM catalogo WHERE (:produto ='' OR chave=:produto) AND (:familia ='' OR familia=:familia)
 AND (:unidade ='' OR unidade=:unidade) AND (:status ='' OR status=:status)
 AND (:busca ='' OR strpos(lower(nome||' '||codigo),lower(:busca))>0)
), totais_itens AS (
 SELECT i.venda_id,SUM(i.valor_total) subtotal,
 BOOL_AND(i.valor_total IS NOT NULL AND i.valor_total>=0 AND i.quantidade IS NOT NULL AND i.quantidade>=0) valido
 FROM venda_itens i JOIN vendas_escopo v ON v.id=i.venda_id GROUP BY i.venda_id
), itens AS (
 SELECT c.chave,v.data,i.quantidade,
 (t.valido AND v.desconto IS NOT NULL AND v.desconto>=0 AND v.tipo_desconto IN ('valor','percent')
 AND (v.desconto=0 OR (t.subtotal>0 AND ((v.tipo_desconto='valor' AND v.desconto<=t.subtotal) OR (v.tipo_desconto='percent' AND v.desconto<=100))))) valor_valido,
 i.valor_total*(1-CASE WHEN v.desconto=0 THEN 0 WHEN v.tipo_desconto='valor' THEN v.desconto/NULLIF(t.subtotal,0) ELSE v.desconto/100 END) valor
 FROM itens_identificados i JOIN vendas_escopo v ON v.id=i.venda_id JOIN totais_itens t ON t.venda_id=v.id
 JOIN catalogo c ON c.chave=i.chave
), produto_agregado AS (
 SELECT chave,MAX(data) ultima,
 COUNT(*) FILTER(WHERE data>=:inicioInstant)::int registros,
 COUNT(*) FILTER(WHERE data>=:inicioInstant AND valor_valido IS NOT TRUE)::int invalidos,
 COUNT(*) FILTER(WHERE data>=:inicioInstant AND (quantidade IS NULL OR quantidade<0))::int quantidades_invalidas,
 COALESCE(SUM(quantidade) FILTER(WHERE data>=:inicioInstant),0) quantidade_vendida,
 COALESCE(SUM(valor) FILTER(WHERE data>=:inicioInstant),0) valor FROM itens GROUP BY chave
), produtos AS (
 SELECT c.*,COALESCE(a.registros,0) registros, COALESCE(a.invalidos,0) invalidos,
 CASE WHEN COALESCE(a.quantidades_invalidas,0)=0 THEN COALESCE(a.quantidade_vendida,0)::text END AS vendido,
 CASE WHEN COALESCE(a.invalidos,0)=0 THEN ROUND(COALESCE(a.valor,0),2)::text END AS valor,
 (a.ultima AT TIME ZONE 'America/Fortaleza')::date AS ultima,
 CAST(:fim AS date)-(a.ultima AT TIME ZONE 'America/Fortaleza')::date AS dias_sem,
 GREATEST(CAST(:hoje AS date)-(c.criado_em AT TIME ZONE 'America/Fortaleza')::date,0) AS idade,
 c.criado_em>=:inicioInstant AS novo_no_periodo
 FROM catalogo_filtrado c LEFT JOIN produto_agregado a ON a.chave=c.chave
), clientes_metricas AS (
 SELECT c.id,c."nomeCompleto" nome,c.created_at,
 COUNT(v.id) FILTER(WHERE v.data>=:inicioInstant)::int compras,
 COUNT(v.id) FILTER(WHERE v.data>=:anteriorInstant AND v.data< :inicioInstant)::int anteriores,
 COUNT(v.id) FILTER(WHERE v.data>=:inicioInstant AND (v.valor_total IS NULL OR v.valor_total<0))::int invalidos,
 CASE WHEN COUNT(v.id) FILTER(WHERE v.data>=:inicioInstant AND (v.valor_total IS NULL OR v.valor_total<0))=0
 THEN COALESCE(SUM(v.valor_total) FILTER(WHERE v.data>=:inicioInstant),0)::text END valor,
 CASE WHEN COUNT(v.id) FILTER(WHERE v.data>=:inicioInstant AND (v.valor_total IS NULL OR v.valor_total<0))=0
 THEN ROUND(SUM(v.valor_total) FILTER(WHERE v.data>=:inicioInstant)/NULLIF(COUNT(v.id) FILTER(WHERE v.data>=:inicioInstant),0),2)::text END ticket,
 (MAX(v.data) AT TIME ZONE 'America/Fortaleza')::date ultima,
 CAST(:fim AS date)-(MAX(v.data) AT TIME ZONE 'America/Fortaleza')::date dias_sem
 FROM clientes c LEFT JOIN vendas_escopo v ON v.cliente_id=c.id
 WHERE c.empresa_id=:empresaId AND c.created_at< :fimInstant AND (:cliente =0 OR c.id=:cliente)
 GROUP BY c.id,c."nomeCompleto",c.created_at
)`;

export const COMERCIAL = `${BASE}, resumo AS (
 SELECT COUNT(*) FILTER(WHERE data>=:inicioInstant)::int quantidade,
 CASE WHEN COUNT(*) FILTER(WHERE data>=:inicioInstant AND (valor_total IS NULL OR valor_total<0))=0 THEN COALESCE(SUM(valor_total) FILTER(WHERE data>=:inicioInstant),0)::text END total,
 CASE WHEN COUNT(*) FILTER(WHERE data>=:anteriorInstant AND data< :inicioInstant AND (valor_total IS NULL OR valor_total<0))=0 THEN COALESCE(SUM(valor_total) FILTER(WHERE data>=:anteriorInstant AND data< :inicioInstant),0)::text END anterior,
 CASE WHEN COUNT(*) FILTER(WHERE data>=:inicioInstant AND (valor_total IS NULL OR valor_total<0))=0 THEN ROUND(SUM(valor_total) FILTER(WHERE data>=:inicioInstant)/NULLIF(COUNT(*) FILTER(WHERE data>=:inicioInstant),0),2)::text END ticket,
 COUNT(*) FILTER(WHERE data>=:inicioInstant AND cliente_id IS NULL)::int sem_cliente,
 COUNT(*) FILTER(WHERE data>=:inicioInstant AND cliente_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM clientes c WHERE c.id=v.cliente_id AND c.empresa_id=:empresaId))::int vinculo_invalido
 FROM vendas_escopo v
), dias AS (SELECT generate_series(CAST(:inicio AS date),CAST(:fim AS date),interval '1 day')::date dia),
 serie AS (
 SELECT d.dia,
 CASE WHEN COUNT(*) FILTER(WHERE v.valor_total IS NULL AND v.id IS NOT NULL OR v.valor_total<0)=0 THEN COALESCE(SUM(v.valor_total),0)::text END valor,
 COUNT(v.id)::int quantidade FROM dias d LEFT JOIN vendas_escopo v ON (v.data AT TIME ZONE 'America/Fortaleza')::date =d.dia GROUP BY d.dia
), serie_anterior AS (
 SELECT (data AT TIME ZONE 'America/Fortaleza')::date dia,COUNT(*)::int quantidade,
 CASE WHEN BOOL_AND(valor_total IS NOT NULL AND valor_total>=0) THEN SUM(valor_total)::text END valor
 FROM vendas_escopo WHERE data>=:anteriorInstant AND data< :inicioInstant GROUP BY 1
), abc_base AS (
 SELECT chave,nome,valor::numeric valor,SUM(valor::numeric) OVER() total,
 COALESCE(SUM(valor::numeric) OVER(ORDER BY valor::numeric DESC,chave ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) antes
 FROM produtos WHERE valor::numeric >0 AND criado_em< :fimInstant
), abc AS (
 SELECT CASE WHEN antes/NULLIF(total,0)*100< :abcA THEN 'A' WHEN antes/NULLIF(total,0)*100< :abcB THEN 'B' ELSE 'C' END classe,
 COUNT(*)::int produtos,SUM(valor)::text valor,ROUND(SUM(valor)/NULLIF(MAX(total),0)*100,2)::text percentual
 FROM abc_base GROUP BY 1
)
SELECT json_build_object('resumo',(SELECT row_to_json(resumo) FROM resumo),
 'clientes',(SELECT COUNT(*) FROM clientes_metricas WHERE compras>0),
 'novosClientes',(SELECT COUNT(*) FROM clientes_metricas WHERE created_at>=:inicioInstant),
 'orcamentos',(SELECT COUNT(*) FROM orcamentos WHERE empresa_id=:empresaId AND data_orcamento>=:inicioInstant AND data_orcamento< :fimInstant AND (:cliente =0 OR cliente_id=:cliente)),
 'antesSemAgora',(SELECT COUNT(*) FROM clientes_metricas WHERE anteriores>0 AND compras=0),
 'semCompra',(SELECT COUNT(*) FROM clientes_metricas WHERE dias_sem>=:diasSem),
 'semHistorico',(SELECT COUNT(*) FROM clientes_metricas WHERE ultima IS NULL),
 'serie',COALESCE((SELECT json_agg(serie ORDER BY dia) FROM serie),'[]'::json),
 'serieAnterior',COALESCE((SELECT json_agg(serie_anterior ORDER BY dia) FROM serie_anterior),'[]'::json),
 'abc',CASE WHEN EXISTS(SELECT 1 FROM produtos WHERE invalidos>0) THEN NULL ELSE COALESCE((SELECT json_agg(abc ORDER BY classe) FROM abc),'[]'::json) END,
 'abcSemValor',(SELECT COUNT(*) FROM produtos WHERE criado_em< :fimInstant AND valor::numeric =0),
 'abcLimites',json_build_object('a',:abcA,'b',:abcB),
 'itensSemCatalogo',(SELECT COUNT(*) FROM itens_identificados i JOIN vendas_escopo v ON v.id=i.venda_id WHERE v.data>=:inicioInstant AND i.chave IS NOT NULL AND NOT EXISTS(SELECT 1 FROM catalogo c WHERE c.chave=i.chave)),
 'rankingClientes',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM clientes_metricas WHERE compras>0 ORDER BY valor::numeric DESC NULLS LAST,id LIMIT 5)x),'[]'::json),
 'rankingProdutos',COALESCE((SELECT json_agg(x) FROM (SELECT * FROM produtos WHERE registros>0 ORDER BY valor::numeric DESC NULLS LAST,chave LIMIT 5)x),'[]'::json)) dados`;

export const ESTOQUE = `${BASE}, grupos AS (
 SELECT familia,unidade,COUNT(*)::int skus,
 CASE WHEN COUNT(*) FILTER(WHERE NOT infinito AND quantidade IS NULL)=0 THEN COALESCE(SUM(quantidade) FILTER(WHERE NOT infinito),0)::text END quantidade,
 CASE WHEN COUNT(*) FILTER(WHERE status='indisponivel')=0 THEN COALESCE(SUM(necessidade),0)::text END necessidade
 FROM produtos GROUP BY familia,unidade
)
SELECT json_build_object('skus',(SELECT COUNT(*) FROM produtos),
 'normal',(SELECT COUNT(*) FROM produtos WHERE status='normal'),'baixo',(SELECT COUNT(*) FROM produtos WHERE status='baixo'),
 'zero',(SELECT COUNT(*) FROM produtos WHERE status='zero'),'infinito',(SELECT COUNT(*) FROM produtos WHERE status='infinito'),
 'indisponivel',(SELECT COUNT(*) FROM produtos WHERE status='indisponivel'),
 'reposicao',(SELECT COUNT(*) FROM produtos WHERE necessidade>0),
 'semVenda',(SELECT COUNT(*) FROM produtos WHERE registros=0 AND criado_em< :fimInstant),
 'novos',(SELECT COUNT(*) FROM produtos WHERE criado_em>=:inicioInstant AND criado_em< :fimInstant),
 'grupos',COALESCE((SELECT json_agg(grupos ORDER BY familia,unidade) FROM grupos),'[]'::json),
 'familias',COALESCE((SELECT json_agg(x) FROM (SELECT familia,COUNT(*)::int skus FROM produtos GROUP BY familia ORDER BY familia)x),'[]'::json)) dados`;

export function detalheSQL(tipo) {
  const filter =
    tipo === "clientes"
      ? `(:grupo <>'antes' OR (anteriores>0 AND compras=0)) AND (:grupo <>'sem-compra' OR dias_sem>=:diasSem)`
      : `(:grupo <>'sem-venda' OR (registros=0 AND criado_em< :fimInstant)) AND (:grupo <>'baixa' OR (NOT infinito AND quantidade>0 AND criado_em< :fimInstant)) AND (:grupo <>'vendidos' OR registros>0) AND (:grupo <>'atencao' OR status IN ('baixo','zero'))`;
  const order =
    tipo === "clientes"
      ? "valor::numeric DESC NULLS LAST,id"
      : `CASE WHEN :ordem IN ('quantidade','menor') THEN unidade END,
 CASE WHEN :ordem ='quantidade' THEN vendido::numeric END DESC NULLS LAST,
 CASE WHEN :ordem ='menor' THEN vendido::numeric END ASC NULLS LAST,
 CASE WHEN :ordem ='valor' THEN valor::numeric END DESC NULLS LAST,chave`;
  return `${BASE}, lista AS (SELECT * FROM ${
    tipo === "clientes" ? "clientes_metricas" : "produtos"
  } WHERE ${filter}), pagina AS (SELECT * FROM lista ORDER BY ${order} LIMIT :tamanho OFFSET :offset)
 SELECT json_build_object('total',(SELECT COUNT(*) FROM lista),'itens',COALESCE((SELECT json_agg(pagina) FROM pagina),'[]'::json)) dados`;
}

export const PRODUTO_SERIE = `${BASE} SELECT json_build_object('serie',COALESCE((SELECT json_agg(x ORDER BY dia) FROM (
 SELECT (data AT TIME ZONE 'America/Fortaleza')::date dia,
 CASE WHEN BOOL_AND(valor_valido IS TRUE) THEN ROUND(SUM(valor),2)::text END valor,
 CASE WHEN BOOL_AND(quantidade IS NOT NULL AND quantidade>=0) THEN SUM(quantidade)::text END quantidade
 FROM itens WHERE chave=:produto AND data>=:inicioInstant GROUP BY 1)x),'[]'::json)) dados`;

export const OPTIONS = `${BASE} SELECT json_build_object(
 'produtos',COALESCE((SELECT json_agg(x) FROM (SELECT chave,nome,codigo,unidade FROM catalogo WHERE :busca ='' OR strpos(lower(nome||' '||codigo),lower(:busca))>0 ORDER BY nome,chave LIMIT 30)x),'[]'::json),
 'clientes',COALESCE((SELECT json_agg(x) FROM (SELECT id,"nomeCompleto" nome FROM clientes WHERE empresa_id=:empresaId AND (:busca ='' OR strpos(lower("nomeCompleto"),lower(:busca))>0) ORDER BY "nomeCompleto",id LIMIT 30)x),'[]'::json),
 'unidades',COALESCE((SELECT json_agg(unidade ORDER BY unidade) FROM (SELECT DISTINCT unidade FROM catalogo)x),'[]'::json)) dados`;

