# Relatório de saúde atual — Lucro+

**Data da verificação:** 24/08/2026  
**Ambiente:** produção  
**Classificação geral:** **AMARELO — operação disponível, mas ainda sem certificação completa de todas as telas autenticadas**

## 1. Resumo executivo

O núcleo do Lucro+ está disponível: backend, banco, frontend, dashboard e tela de Recorrências responderam normalmente. O backend possui 112 testes automatizados aprovados e o frontend compilou com 85 rotas.

Também foi confirmada a carga dos dados da Dom Ferraz - Manaíra: 17 planos, 44 assinantes, 44 clientes vinculados e 44 recorrências. A carga foi concluída sem vendas, cobranças ou documentos fiscais.

Não foi encontrado indício de indisponibilidade geral. Porém, ainda não é correto afirmar que todos os botões e todas as funcionalidades foram validados em produção com usuário autenticado.

## 2. Evidências coletadas

| Verificação | Resultado |
|---|---|
| Backend `/health` | HTTP 200; banco conectado |
| Backend `/` | HTTP 200; API online |
| Frontend `/dashboard` | HTTP 200 |
| Frontend `/uikit/list` | HTTP 200 |
| Rota antiga `/uikit/assinaturas` | HTTP 404; não existe aba separada |
| API de importação sem autenticação | HTTP 401; proteção funcionando |
| Testes do backend | 112 aprovados, 0 falhas |
| Build do frontend | Concluído; 85 rotas geradas |
| Carga AppBarber | 44 recorrências criadas/atualizadas; reexecução ignorada por já estar concluída |
| Fiscal em produção | Há registro recente de NF-e autorizado pela Focus, código SEFAZ 100 |

## 3. Pendências por urgência

### P0 — imediato

**Nenhum P0 foi identificado na verificação atual.** Não há evidência de queda geral, banco indisponível ou falha de compilação.

### P1 — corrigir antes de considerar o sistema certificado

1. **Executar teste autenticado completo, aba por aba e botão por botão.**
   Os testes automatizados cobrem regras e APIs, mas não comprovam todos os fluxos visuais em produção: login, seleção de empresa, permissões, modais, gravação, edição, exclusão, filtros, PDFs e integrações.

2. **Revisar e registrar o estado real das migrations de produção.**
   A tela de Produção possui uma preparação de schema em runtime para `movimentos.tipo_movimento`, enquanto existe migration correspondente. Isso reduz o risco imediato, mas deixa o controle de versão do banco menos confiável. É necessário conferir o histórico de migrations aplicado e eliminar dependência de criação de colunas durante requisições.

3. **Separar claramente status AppBarber de status Asaas.**
   Os status importados (`Em Dia`, `A vencer`, `Atrasado`, `Inadimplente`) vieram do AppBarber. Os registros importados não possuem assinatura vinculada ao Asaas nem `asaasStatus`. Portanto, não devem ser apresentados como confirmação de pagamento do Asaas.

4. **Corrigir o meio de pagamento padrão da importação.**
   A importação usa `PIX` para satisfazer uma coluna obrigatória, embora o PDF não informe a forma de pagamento. Isso não criou cobrança, mas pode gerar interpretação incorreta em telas financeiras. O ideal é permitir `NÃO INFORMADO` ou deixar o campo nulo, conforme a regra do módulo.

5. **Validar os fluxos fiscais de ponta a ponta em ambiente controlado.**
   Existe evidência de NF-e autorizada recentemente, mas ainda é necessário testar consulta, reemissão de erro, download, manifestação e tratamento de autorização sem gerar documento indevido.

### P2 — importante para estabilidade e manutenção

6. **Tornar as migrations antigas idempotentes.**
   A migration de `tipo_movimento` usa `addColumn` e `addIndex` diretamente. Se o banco tiver a coluna ou o índice, mas o histórico de migration estiver divergente, o deploy pode falhar. O padrão deve ser `IF NOT EXISTS` ou verificação explícita antes de alterar.

7. **Remover o bootstrap com dados pessoais depois da carga inicial.**
   A carga automática funcionou e é idempotente, mas os dados dos assinantes estão empacotados no backend. Depois de confirmar a carga, deve-se retirar o dataset do código e manter apenas o registro importado/auditoria no banco.

8. **Unificar os relatórios de desperdício.**
   Há implementação de relatório tanto em Produção quanto em Estoque/Form Layout. Isso aumenta o risco de as duas telas apresentarem filtros, totais ou cálculos diferentes. Deve existir um único serviço de cálculo e, idealmente, um componente compartilhado.

9. **Melhorar observabilidade.**
   Os logs misturam erros esperados de testes negativos com erros reais. É necessário usar níveis e códigos de erro consistentes para distinguir validação esperada, falha de integração e falha interna.

10. **Criar commit e versionamento do estado publicado.**
    O workspace ainda contém alterações rastreadas e arquivos não versionados. Isso dificulta rollback, auditoria e identificação exata do que está em produção.

### P3 — melhorias de qualidade

11. **Renomear os campos bancários da recorrência.**
    A tela deve informar claramente que são dados da conta de recebimento da barbearia, não da conta do cliente.

12. **Criar smoke tests autenticados por módulo.**
    Um roteiro automatizado deve validar as principais rotas de Dashboard, Estoque, Produção, Clientes, Recorrências, Fiscal, Financeiro, Relatórios e Configurações.

## 4. Conclusão

O Lucro+ está **operacional no nível de infraestrutura e dos fluxos automatizados verificados**, sem sinal de quebra geral. A principal lacuna atual é de **certificação funcional autenticada**, não de indisponibilidade.

Antes de declarar o sistema plenamente estável, a ordem recomendada é: teste autenticado completo, conferência do estado das migrations, correção da semântica de status/forma de pagamento da importação e validação fiscal controlada.
