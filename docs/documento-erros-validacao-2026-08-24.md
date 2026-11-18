# Documento de erros e validação geral — Lucro+

**ID:** TEST-2026-08-24-001  
**Data:** 24/08/2026  
**Ambiente:** produção publicada  
**Status geral:** OPERACIONAL COM PENDÊNCIAS — NÃO HOMOLOGADO

## 1. Escopo e segurança

Foi realizada uma validação orientada a usuário, aba por aba, cobrindo as 57 rotas do menu, estados vazios, filtros, botões, formulários e cadastros não fiscais com dados sintéticos.

Foi criada a empresa `QA GERAL - TESTE 2026-08-24`, sem CNPJ e sem configuração fiscal. Foram criados registros sintéticos de cliente, produto, matéria-prima, fornecedor, pedido de compra, serviço, orçamento, campanha, projeto de marketing, setor de planejamento, centro de custos e usuário colaborador.

Não foram executadas emissão, transmissão, consulta ou cancelamento de NF-e, NFC-e, NFS-e, MDF-e, manifesto, configuração fiscal, envio de WhatsApp, cobrança real ou pagamento. Os campos e fluxos fiscais foram deliberadamente deixados sem execução.

## 2. Resultado executivo

| Área | Resultado | Observação |
|---|---|---|
| Página pública, login Master e seleção de empresa | PASSOU | Acesso confirmado em produção; houve uma ocorrência intermitente de rede registrada no BUG-002. |
| Navegação das 57 abas | PASSOU COM PENDÊNCIAS | Todas as rotas foram abertas; algumas exibiram erros persistentes ou conteúdo inconsistente. |
| CRUD não fiscal | PASSOU PARCIALMENTE | Clientes, produto, fornecedor, pedido, serviço, orçamento, campanha, marketing, planejamento, centro de custos e usuário persistiram; entradas, contratos e procurações não concluíram. |
| Usuário Colaborador | PENDENTE DE AUTORIZAÇÃO | Login aceito, mas menu sem módulos; URLs diretas de telas administrativas continuam acessíveis. |
| Fiscal e integrações externas | BLOQUEADO POR SEGURANÇA | Não foi gerado nem transmitido documento fiscal. |

## 3. Controle de testes funcionais

| ID | Cenário | Resultado |
|---|---|---|
| TEST-001 | Página pública e login Master | PASSOU |
| TEST-002 | Criação e seleção da empresa sintética | PASSOU COM RETESTE |
| TEST-003 | Navegação das 57 abas | PASSOU COM PENDÊNCIAS |
| TEST-004 | Cadastro e persistência de cliente | PASSOU |
| TEST-005 | Cadastro e persistência de produto | PASSOU |
| TEST-006 | Histórico de movimentação de estoque | PASSOU |
| TEST-007 | Persistência da opção Matéria-Prima | NÃO FUNCIONAL |
| TEST-008 | Cadastro de fornecedor e vínculo ao produto | PASSOU |
| TEST-009 | Pedido de compra sintético | PASSOU |
| TEST-010 | Cadastro de serviço sem emissão fiscal | PASSOU |
| TEST-011 | Orçamento sintético | PASSOU |
| TEST-012 | Campanha CRM sintética | PASSOU COM OBSERVAÇÃO |
| TEST-013 | Projeto de marketing, setor e centro de custos | PASSOU |
| TEST-014 | Lançamento financeiro de entrada | NÃO FUNCIONAL |
| TEST-015 | Contrato sintético | NÃO FUNCIONAL / SEM FEEDBACK |
| TEST-016 | Procuração sintética | NÃO FUNCIONAL / SEM FEEDBACK |
| TEST-017 | Cadastro de usuário colaborador | PASSOU |
| TEST-018 | Login e autorização do colaborador | PENDENTE / INCONSISTENTE |
| TEST-019 | Relatório financeiro | NÃO FUNCIONAL |
| TEST-020 | Inteligência do negócio | NÃO FUNCIONAL / ERRO 500 |
| TEST-021 | Operações fiscais | BLOQUEADO POR SEGURANÇA |

## 4. Matriz por aba e funcionalidade verificada

| Grupo | Aba | Funcionalidade exercitada | Resultado |
|---|---|---|---|
| Geral | Configurações | Abertura e carregamento | FUNCIONAL |
| Geral | Dashboard | Abertura e carregamento | FUNCIONAL |
| Operacional | Estoque | Abertura, filtros, cadastro de produto e histórico | FUNCIONAL COM PENDÊNCIA |
| Operacional | Produção | Abertura, formulário de receita e dependência de matéria-prima | NÃO FUNCIONAL — seletor sem opção após cadastro |
| Operacional | Pedidos | Abertura, estado vazio e controles | FUNCIONAL NA CONSULTA; CRUD NÃO CONCLUÍDO |
| Operacional | Fornecedores | Cadastro, persistência e vínculo ao produto | FUNCIONAL |
| Operacional | Agendamentos | Abertura e Novo Agendamento | BLOQUEADO — exige colaborador |
| Comercial | Clientes | Validação, cadastro, persistência e recarga | FUNCIONAL |
| Comercial | Orçamentos | Cadastro, seleção de cliente/produto e persistência | FUNCIONAL |
| Comercial | Caixa | Consulta e abertura de caixa | BLOQUEADO — exige colaborador |
| Comercial | Serviços / NFS-e | Cadastro de serviço sem emissão | FUNCIONAL |
| Comercial | NF-e | Abertura e consulta inicial | BLOQUEADO POR SEGURANÇA |
| Comercial | NFC-e | Abertura e consulta inicial | BLOQUEADO POR SEGURANÇA |
| Comercial | Histórico de Notas | Abertura e consulta inicial | BLOQUEADO POR SEGURANÇA |
| Comercial | Manifestos | Abertura e consulta inicial | BLOQUEADO POR SEGURANÇA |
| Financeiro | Recorrência | Abertura, filtros e estado inicial | FUNCIONAL NA CONSULTA; CRUD NÃO TESTADO |
| Financeiro | Custos por Funcionários | Abertura e estado inicial | FUNCIONAL NA CONSULTA |
| Financeiro | Comissões | Abertura e estado inicial | FUNCIONAL NA CONSULTA |
| Financeiro | Notas Fiscais | Abertura e consulta inicial | BLOQUEADO POR SEGURANÇA |
| Financeiro | Dashboard Financeiro | Abertura e indicadores iniciais | FUNCIONAL NA CONSULTA |
| Financeiro | Entradas | Novo lançamento sintético e persistência | NÃO FUNCIONAL — registro desaparece sem erro |
| Financeiro | Saídas | Abertura e consulta inicial | CRUD NÃO TESTADO |
| Financeiro | Relatórios Financeiros | Abertura e carregamento de relatório | NÃO FUNCIONAL — erro persistente |
| Financeiro | CRM / RFM | Abertura e consulta inicial | FUNCIONAL NA CONSULTA |
| CRM Comercial | Visão Geral | Abertura e indicadores | FUNCIONAL NA CONSULTA |
| CRM Comercial | Pipeline | Abertura e conteúdo apresentado | PENDENTE — possível componente/rota incorreta |
| CRM Comercial | Empresas e Leads | Abertura e ações disponíveis | FUNCIONAL NA CONSULTA |
| CRM Comercial | Campanhas | Criação e persistência de campanha sintética | FUNCIONAL COM OBSERVAÇÃO |
| CRM Comercial | WhatsApp CRM | Abertura | NÃO TESTADO — integração externa |
| CRM Comercial | Histórico Comercial | Abertura e consulta | FUNCIONAL NA CONSULTA |
| CRM Comercial | Scripts IA | Abertura | NÃO TESTADO — IA/integração |
| CRM Comercial | Relatórios | Abertura | FUNCIONAL NA CONSULTA |
| CRM Comercial | Configurações CRM | Abertura | FUNCIONAL NA CONSULTA |
| Contábil & Fiscal | Dashboard Fiscal | Abertura | BLOQUEADO POR SEGURANÇA |
| Contábil & Fiscal | Central Fiscal | Abertura | BLOQUEADO; ocorrência de erro 500 observada |
| Contábil & Fiscal | Inteligência do Negócio | Consulta | NÃO FUNCIONAL — erros persistentes |
| Contábil & Fiscal | Inteligência Fiscal | Abertura | BLOQUEADO POR SEGURANÇA |
| Contábil & Fiscal | Integração Contábil | Abertura | NÃO TESTADO — integração |
| Contábil & Fiscal | Gestão Tributária | Abertura | BLOQUEADO POR SEGURANÇA |
| Contábil & Fiscal | Conciliação Financeira | Abertura e consulta | FUNCIONAL NA CONSULTA; CRUD NÃO TESTADO |
| Contábil & Fiscal | DRE & Relatórios | Abertura | BLOQUEADO POR SEGURANÇA |
| Contábil & Fiscal | Centro de Custos | Cadastro, persistência e consulta | FUNCIONAL |
| Contábil & Fiscal | Automação | Abertura | NÃO TESTADO — automação externa |
| Contábil & Fiscal | Portal do Contador | Abertura | PENDENTE — Network Error observado |
| Contábil & Fiscal | Auditoria | Abertura e consulta inicial | FUNCIONAL NA CONSULTA |
| Departamento Pessoal | Controle de Ponto | Abertura | CRUD NÃO TESTADO |
| Jurídico | Gestão de Contratos | Formulário e salvamento sintético | NÃO FUNCIONAL — modal permanece aberto e lista vazia |
| Jurídico | Procurações | Formulário e salvamento sintético | NÃO FUNCIONAL — modal permanece aberto e lista vazia |
| Estratégia | Marketing | Criação e persistência de projeto | FUNCIONAL |
| Estratégia | Planejamento | Criação e persistência de setor | FUNCIONAL |
| Administração | Usuários | Criação e persistência de usuário sintético | FUNCIONAL |
| Administração | Gestão de Acessos | Abertura | CRUD NÃO TESTADO |
| Administração | Minha Empresa | Abertura e consulta | FUNCIONAL NA CONSULTA; erro transitório retestado |
| Administração | Configuração Fiscal | Abertura | BLOQUEADO POR SEGURANÇA |
| Master | Gestão de Empresas | Criação, seleção e sincronização de pacote | FUNCIONAL COM PENDÊNCIA |
| Master | Uso do Sistema | Abertura e consulta | FUNCIONAL NA CONSULTA |
| Master | Inteligência do Negócio | Consulta | NÃO FUNCIONAL — erros persistentes |

## 5. Registro de erros

### BUG-001 — Empresa criada sem módulos até sincronização/reload

**Severidade:** Alta — **Status:** Aguardando reteste. Após criar a empresa com pacote Contador, a primeira seleção exibiu “Nenhum módulo disponível”. Sincronizar pacotes e recarregar fez os módulos aparecerem. O pacote deveria ficar disponível imediatamente.

### BUG-002 — Instabilidade intermitente no login/listagem

**Severidade:** Média — **Status:** Em análise. Uma sessão apresentou “Network Error” no login e “Erro ao carregar empresas”; nova tentativa funcionou e o acesso em produção foi confirmado posteriormente. Repetir três sessões e correlacionar horários com logs e códigos HTTP.

### BUG-003 — Opção Matéria-Prima não persiste

**Severidade:** Média — **Status:** Reproduzido. O produto `Materia Prima QA 2026` foi salvo com a opção Matéria-Prima ativada, mas a edição/releitura mostrou a opção desativada. Como consequência, a receita de produção não encontrou matéria-prima disponível.

### BUG-004 — Lançamento financeiro desaparece sem erro

**Severidade:** Alta — **Status:** Reproduzido. Foram tentadas entradas sintéticas com categoria, valor e descrição; o diálogo fechou, mas a tabela permaneceu vazia, total em R$ 0,00 e nenhum aviso foi exibido, inclusive após recarga.

### BUG-005 — Contrato não conclui salvamento nem informa validação

**Severidade:** Média — **Status:** Reproduzido. Com título e responsável sintéticos preenchidos, o modal permaneceu aberto, a tabela continuou vazia e não houve mensagem clara de sucesso ou validação.

### BUG-006 — Procuração não conclui salvamento nem informa validação

**Severidade:** Média — **Status:** Reproduzido. Com tipo, referência, partes e poderes sintéticos preenchidos, o modal permaneceu aberto, a lista continuou vazia e não houve mensagem clara de sucesso ou validação.

### BUG-007 — Perfil Colaborador sem menu, mas com acesso direto a rotas administrativas

**Severidade:** Alta — **Status:** Reproduzido. O usuário sintético conseguiu fazer login, porém viu “Nenhum módulo disponível”. Mesmo assim, ao abrir URLs diretamente, carregou Dashboard, Estoque, Entradas e Cadastro de Usuários; a tela de Usuários exibiu o botão “Novo Usuário”. A regra de autorização e a navegação exibida estão inconsistentes e precisam ser corrigidas antes de liberar o perfil.

### BUG-008 — Rota Pipeline apresenta conteúdo de Empresas e Leads

**Severidade:** Média — **Status:** Pendente de confirmação. A rota `/uikit/prospeccao/pipeline` apresentou cabeçalho e ações de Empresas e Leads, em vez de um pipeline claramente identificável. Confirmar se é componente compartilhado intencional ou erro de roteamento.

### BUG-009 — Relatórios Financeiros com erro persistente de carregamento

**Severidade:** Média — **Status:** Reproduzido. A tela exibiu “Erro ao carregar relatório financeiro” em duas tentativas; totais ficaram em R$ 0,00 e a tabela vazia.

### BUG-010 — Inteligência do Negócio com erros 500

**Severidade:** Média — **Status:** Reproduzido. A rota `/uikit/inteligencia-negocio` exibiu “Não foi possível” e ocorrências 500 em duas tentativas. Investigar endpoint e tratamento do estado de erro.

### BUG-011 — Portal do Contador com Network Error

**Severidade:** Média — **Status:** Pendente de reteste. O erro foi observado na varredura geral; repetir em sessão limpa e verificar logs antes de concluir a causa.

## 6. Limitações e próximos passos

1. Retestar BUG-001, BUG-002, BUG-008 e BUG-011 em sessão limpa/homologação.
2. Corrigir BUG-003 a BUG-007 e BUG-009/BUG-010 antes da homologação funcional.
3. Reexecutar CRUDs ainda classificados como consulta, usando massa sintética e sem CNPJ.
4. Definir permissões do perfil Colaborador e repetir teste com rotas permitidas e proibidas.
5. Validar integrações externas somente em sandbox, mock ou homologação.
6. Executar roteiro fiscal apenas com autorização formal e ambiente controlado.

## 7. Conclusão

O Lucro+ permite acesso, navegação ampla e vários cadastros não fiscais com persistência correta. Entretanto, a rodada não deve ser considerada homologada: foram reproduzidos problemas de persistência, falhas silenciosas, erros de carregamento, inconsistência de rota e falha de autorização do perfil Colaborador. Nenhuma emissão ou transmissão fiscal foi executada.

