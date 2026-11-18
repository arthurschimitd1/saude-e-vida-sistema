# Comissões e painéis da barbearia

## Base e destino

Implementação feita sobre `IagoSantos123/LucroMais-`, branch `main`, commit de produção `94db7b0a416e8d124e1bf906d8204dcb17049167` (frontend e backend conferidos na Vercel).

Frontend: https://lucromais-frontend-mssolucoes.vercel.app
Backend: https://lucromais-backend-mssolucoes.vercel.app
Nova tela: `/uikit/comissoes/relatorios`, acessível pelas telas de comissões e de comissão de assinatura.

O checkout original da sessão apontava para outro repositório, `maislucro8-ctrl/Lucromais-`, branch `iago`. O protótipo de novos planos preparado naquele checkout NÃO faz parte desta publicação. A produção já possui rateio mensal de assinaturas; essa regra foi preservada.

## Comissões

Consulta única por período, profissional e cliente. Filtros adicionais de origem, plano, situação e busca aplicam-se apenas aos lançamentos de comissão e seus totais/PDF.

- Planos: lê `comissao_assinatura_itens` e a situação da competência existente. Aberta = provisório; fechada = a receber; paga = pago.
- Avulsos: lê `comissoes` de serviços.
- Produtos: lê `comissoes` de produtos.
- Venda geral (legado): preserva registros que não permitem divisão por item, sem inventar rateio.
- Total dos registros inclui pago e provisório e não se apresenta como saldo disponível. A receber, provisório e já pago têm cartões separados.
- A data do avulso é a data da venda; a data do plano é a do atendimento. Filtrar parte do mês não recalcula o pote mensal.
- Profissional da agenda é reconciliado com o usuário via `agendamento_colaboradores.usuario_id`, sem agrupar por nome.
- Usuários sem permissão para todas as comissões só consultam seus próprios dados, mesmo enviando o ID de outro funcionário.

Nenhuma consulta recalcula ou paga comissão, gera receita, altera franquia de serviços ou fecha competência. As telas existentes continuam responsáveis por essas ações.

## Painéis ao final

Resultados: vendas líquidas e recorrências de entrada recebidas (estas são receita coletiva, não atribuída a profissional), metas, serviços/produtos, ponto de equilíbrio, ticket médio de venda.

Equipe: ranking por vendas no caixa, metas individuais, quantidades de serviços e produtos, minutos produzidos, ocupação planejada.

Clientes: clientes identificados atendidos, novos/recorrentes, retorno em dias diferentes, retenção de clientes do período anterior de mesma duração, retenção de novos dentro do período. Ao filtrar um barbeiro, o histórico também é restrito a ele; novo significa novo no histórico consultado. Atendimentos sem cliente vinculado são contabilizados separadamente e não entram nas taxas.

Produtos: faturamento líquido proporcional ao desconto da venda, conversão, recompra, produtos mais vendidos e estoque atual (este último só para gestão, independente do período/cliente).

Evolução: 12 meses de vendas no caixa, incluindo meses sem vendas. Variação sobre o mês anterior; sem base positiva não apresenta percentual. O último mês pode ser parcial. Não inclui receita coletiva de recorrências.

Individual/geral: produção, metas, ticket, ocupação e comissões separadas por origem e situação. A seleção de um barbeiro também filtra os clientes e a relação de produtos vendidos.

Limites dos dados: serviços extras sem identificação histórica não são classificados automaticamente; aparecem entre os serviços avulsos. Não há nota de satisfação no modelo atual, portanto a tela informa ausência de avaliações. Não se criam indicadores fictícios.

## Metas e capacidade

Gestão pode salvar metas mensais e capacidade de cada profissional. A ação preserva as demais configurações da empresa, com bloqueio transacional da linha e atualização apenas de `empresas.configuracoes.painel_barbearia[YYYY-MM]`. Grava autor e data da última atualização. Não requer migration nem novas tabelas.

Ponto de equilíbrio = custos fixos informados ÷ margem de contribuição informada. A margem precisa ser maior que zero. Ocupação = minutos agendados (exclui cancelado/faltou) ÷ horas disponíveis informadas; não mede presença. Metas e capacidade aplicam-se a mês completo. Valores ausentes são apresentados como não disponíveis.

## Validação

- Testes de integração em PostgreSQL descartável `relatorios_test`, host 127.0.0.1, porta 55439; guardas impedem uso de outra base/host/URL.
- 11 testes específicos aprovados: totais, receitas, descontos, classificação, retenção, validação de filtros, isolamento de empresa/profissional, persistência de metas e preservação de configurações fiscais/comissões.
- Suíte do repositório executada com Node 24: 52 arquivos aprovados.
- Build Next.js aprovado. TypeScript global tem diagnósticos anteriores; não há diagnósticos nos arquivos novos de relatório.
- Navegador local com dados fictícios: tela desktop e celular, ausência de erros de execução, salvamento de meta confirmado pela API (R$ 2.000), exportação de PDF com R$ 38 em comissões separadas (R$ 25 planos + R$ 9 serviços + R$ 4 produtos).
- Fórmulas e arquivos dos serviços de comissão existentes não foram alterados.

## Publicação

Backend deve estar disponível antes de apresentar a nova consulta no frontend. Nenhuma variável secreta precisa ser baixada: a compilação remota da Vercel utiliza as configurações já existentes.

Rollback: retornar frontend e backend aos deployments anteriores; não há migration a desfazer e metas salvas na chave nova não afetam os fluxos anteriores.
