# Diagnóstico inicial de dados — Lucro Mais

Data da análise: 2026-08-13

## Resumo executivo

O sistema já possui os principais domínios para analisar saúde do produto e saúde financeira dos clientes: empresas, usuários, uso diário por rota, vendas, pagamentos recorrentes, agendamentos, clientes, CRM/WhatsApp, estoque, fiscal e contratos.

Não foi possível calcular números reais nesta rodada porque a conexão PostgreSQL configurada no backend falhou por resolução do host. Portanto, este documento separa evidência estrutural de hipótese; nenhuma taxa de churn, receita ou retenção deve ser considerada calculada ainda.

## O que já dá para medir quando a base estiver acessível

| Frente | Fontes principais | Indicadores |
|---|---|---|
| Retenção de empresas | `empresas`, `users`, `empresa_usage_daily` | empresas ativas, WAU/MAU, dias ativos, recência, reativação, churn presumido |
| Ativação | `empresa_usage_daily`, `vendas`, `clientes`, `agendamentos`, `recorrencias` | tempo até primeiro valor, módulos usados, criação de cliente, primeira venda/agendamento |
| Receita | `vendas`, `historico_pagamentos`, `recorrencias`, `movimentos`, `saidas` | faturamento, recebimento, MRR recorrente, inadimplência, margem aproximada |
| Valor para o cliente | `vendas`, `agendamentos`, `clientes`, `whatsapp_*`, `crm_*` | clientes atendidos, recorrência, no-show/cancelamento, vendas por cliente, uso de CRM |
| Operação | `venda_itens`, `Products`, `services`, `movimentos`, `inventarios`, `ordens_producao` | ticket médio, mix, margem por item quando custo existir, ruptura e giro |
| Fiscal | `notas_fiscais*`, `auditorias_fiscais*`, `inconsistencias_fiscais*` | emissão, rejeição, cancelamento, erros por empresa e produto |

## Sinais e riscos observados no código

1. `empresa_usage_daily` é uma ótima base de produto, mas registra rota e contagem diária; sem eventos de resultado, não prova que o cliente concluiu uma tarefa útil. Recomendo ligar uso a eventos de valor, como primeira venda, pagamento conciliado, agenda concluída e nota autorizada.
2. A entidade `empresas` tem `arquivada_em`, o que permite um churn operacional claro. Também é importante diferenciar arquivamento, inadimplência, pausa e churn voluntário.
3. `recorrencias` e `historico_pagamentos` permitem construir uma régua de risco de churn financeiro: vencido, atrasado, último pagamento, próximo vencimento e queda de valor.
4. `vendas` permite ticket, frequência, desconto, forma de pagamento, cancelamento e composição de itens. Para margem confiável, é necessário garantir custo do produto/serviço e despesas variáveis.
5. Há forte amplitude funcional. Isso é oportunidade de expansão, mas também risco de baixa ativação: devemos medir quais módulos aparecem nos clientes retidos versus clientes que abandonam.
6. O modelo de usuário contém `senha_texto`. Isso é um risco grave de segurança e privacidade; senhas devem existir somente em formato hash e esse campo deve ser removido/neutralizado após uma migração segura.
7. O worktree possui alterações locais não relacionadas à análise. Elas foram preservadas.

## Definições recomendadas

- **Ativo de produto:** empresa com pelo menos um evento de uso ou valor nos últimos 28 dias.
- **Ativo de valor:** empresa com pelo menos uma ação de negócio concluída nos últimos 28 dias.
- **Churn presumido:** empresa sem evento de valor por 42 dias, sem estar arquivada; deve gerar alerta, não ser tratado como churn confirmado.
- **Churn confirmado:** `arquivada_em` preenchido ou contrato/assinatura encerrado, com data e motivo.
- **Risco alto:** sem evento de valor há 21–41 dias, ou pagamento atrasado, ou queda de pelo menos 50% no uso/receita contra a média dos 3 períodos anteriores.

## Próxima extração prioritária

1. Inventário de tabelas, colunas, volumes e datas mínimas/máximas.
2. Cohorts mensais por data de criação da empresa.
3. Retenção de uso e retenção de valor em D7, D30, D60 e D90.
4. Lista de empresas em risco com último uso, último valor, último pagamento, recorrência e módulos usados.
5. Funil de ativação e correlação entre módulos usados e retenção.
6. Receita recorrente, inadimplência, ticket e concentração por empresa/segmento.
7. Qualidade: IDs nulos, duplicidades, datas inconsistentes, vendas sem empresa/cliente e pagamentos sem vínculo.

## Query-base de empresas em risco

```sql
WITH uso AS (
  SELECT empresa_id, MAX(last_visited_at) AS ultimo_uso
  FROM empresa_usage_daily
  GROUP BY empresa_id
), valor AS (
  SELECT empresa_id, MAX(data) AS ultima_venda
  FROM vendas
  GROUP BY empresa_id
), pagamento AS (
  SELECT empresa_id, MAX(data_pagamento) AS ultimo_pagamento
  FROM historico_pagamentos
  WHERE status IN ('PAGO', 'PAGO_ATRASADO')
  GROUP BY empresa_id
)
SELECT e.id, e.nome, e.pacote, e.arquivada_em,
       u.ultimo_uso, v.ultima_venda, p.ultimo_pagamento
FROM empresas e
LEFT JOIN uso u ON u.empresa_id = e.id
LEFT JOIN valor v ON v.empresa_id = e.id
LEFT JOIN pagamento p ON p.empresa_id = e.id
WHERE e.arquivada_em IS NULL
  AND COALESCE(v.ultima_venda, u.ultimo_uso) < CURRENT_DATE - INTERVAL '21 days'
ORDER BY COALESCE(v.ultima_venda, u.ultimo_uso) NULLS FIRST;
```

## Decisões de produto que essa análise deve responder

- Qual é o primeiro momento em que o cliente percebe valor?
- Quais funcionalidades aumentam retenção e quais só aumentam complexidade?
- O churn começa por falta de uso, falha operacional, preço, inadimplência ou ausência de resultado?
- Quais empresas precisam de intervenção humana nesta semana?
- Qual segmento tem maior LTV e menor custo de suporte/aquisição?

