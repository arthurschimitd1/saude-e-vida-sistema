-- Backfill histórico recuperado do deploy de teste.
-- Não é executado automaticamente pela aplicação. Deve ser aplicado somente
-- após uma prévia por empresa e com a migration de idempotência já instalada.
WITH totais AS (
    SELECT v.id venda_id, v.empresa_id, v.funcionario_id, v.data, v.desconto, v.tipo_desconto,
           u.comissao_tipo, u.comissao_valor,
           COALESCE(SUM(vi.valor_total) FILTER (WHERE vi.tipo = 'servico'), 0) servicos,
           COALESCE(SUM(vi.valor_total) FILTER (WHERE vi.tipo <> 'servico'), 0) produtos,
           jsonb_agg(jsonb_build_object('item_id', vi.id, 'nome', vi.nome_item, 'valor', vi.valor_total))
               FILTER (WHERE vi.tipo = 'servico') detalhes
      FROM vendas v
      JOIN venda_itens vi ON vi.venda_id = v.id
      JOIN users u ON u.id = v.funcionario_id
     WHERE v.empresa_id IN (55, 59, 60)
       AND u.comissao_tipo IS NOT NULL AND u.comissao_valor > 0
     GROUP BY v.id, u.id
), bases AS (
    SELECT *, GREATEST(
               0,
               servicos - GREATEST(
                   0,
                   CASE WHEN tipo_desconto = 'percent'
                       THEN (produtos + servicos) * desconto / 100
                       ELSE desconto
                   END - produtos
               )
           )::numeric(10,2) base
      FROM totais
)
INSERT INTO comissoes
    (venda_id, funcionario_id, empresa_id, valor, tipo, valor_origem, status,
     "createdAt", "updatedAt", origem, base_calculo, descricao, origem_calculo, detalhes_calculo)
SELECT venda_id, funcionario_id, empresa_id,
       CASE WHEN comissao_tipo = 'percent' THEN ROUND(base * comissao_valor / 100, 2) ELSE comissao_valor END,
       comissao_tipo::enum_comissoes_tipo, comissao_valor, 'pendente'::enum_comissoes_status,
       data, NOW(), 'venda_servicos', base,
       'Comissão de serviços - reconciliação controlada', 'backfill_controlado',
       jsonb_build_object('itens', detalhes, 'desconto_venda', desconto, 'executado_em', NOW())
 FROM bases
 WHERE base > 0
   AND NOT EXISTS (
       SELECT 1
         FROM comissoes existente
        WHERE existente.venda_id = bases.venda_id
          AND existente.origem = 'venda_servicos'
          AND COALESCE(existente.servico_id, '') = ''
   )
ON CONFLICT DO NOTHING;
