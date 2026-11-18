# Saídas por forma de pagamento e turno

## Comportamento

- Nova saída no caixa exige dinheiro, Pix ou cartão e um turno aberto da empresa selecionada.
- Um único turno aberto é pré-selecionado. Havendo vários, o usuário escolhe explicitamente.
- A saída vinculada é registrada como paga. O relatório filtra empresa, turno, natureza SAIDA e status pago.
- Editar mantém o turno original, inclusive se fechado. Excluir remove o lançamento e o relatório passa a refletir o valor correto. Não há cópia do saldo armazenada para sincronizar.
- Saldo esperado da gaveta = abertura + vendas em dinheiro − saídas em dinheiro. O valor do pagamento da venda já é líquido de troco, que não pode ser subtraído novamente.
- Pix/cartão têm vendas, saídas e líquido próprios e não reduzem a gaveta.
- Lançamentos antigos sem turno/forma não recebem classificações inventadas. Continuam no histórico e Financeiro, sem inclusão automática no turno. A edição pelo caixa mantém o vínculo ausente.
- Cadastros financeiros fora do caixa continuam podendo existir sem turno, inclusive contas pendentes.

## Publicação

Esta implementação exige a migração aditiva `backend/migrations/20260913160000-add-saidas-pagamento-turno.cjs`, que inclui duas colunas opcionais e um índice. Não há UPDATE, exclusão ou preenchimento retroativo de registros.

Ordem necessária: migração no ambiente de destino, backend, frontend. Não publicar o backend com o modelo novo antes de criar as colunas: consultas Sequelize também as selecionarão.

Em eventual reversão do aplicativo, manter as colunas/dados. Não executar o down em produção com lançamentos já classificados: ele remove as novas informações.

## Verificação sem banco real

`node --test backend/test/saidas-turno.test.js backend/test/venda-roupas-estoque.test.js backend/test/historico-vendas-ordem.test.js frontend/tests/*.test.cjs`

Os testes do novo fluxo usam banco e requisições simulados. Verificam CRUD, empresa/turno, formas, troco, centavos, edição/exclusão, legado, ausência de turno, relatório renderizado e migração aditiva.

Após implantação, validar em uma empresa de teste: abertura 100, venda em dinheiro 80 recebendo 100, saída dinheiro 30 → saldo esperado 150. Saída Pix 10 não muda esse saldo. Trocar a saída de dinheiro para cartão → 180. Excluí-la remove também sua saída no cartão. Não usar dados reais para essa simulação.
