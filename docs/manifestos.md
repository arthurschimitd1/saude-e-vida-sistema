# Módulo de Manifestos

O módulo concentra a preparação e o acompanhamento de documentos fiscais de
transporte sem alterar as rotas existentes de NF-e, NFC-e e NFS-e.

## Isolamento por empresa

Todas as rotas usam a empresa do usuário autenticado. Usuários MASTER precisam
selecionar uma empresa, enviada pelo cabeçalho já utilizado no restante do
sistema. O cliente não pode escolher livremente um `empresa_id` no corpo.

## Funcionalidades

- painel de MDF-e por status;
- rascunho guiado com rota, veículo, condutores, documentos, carga e seguro;
- vínculo de NF-e e CT-e autorizadas ou chave manual;
- validação local antes da emissão;
- emissão, consulta, cancelamento, encerramento e inclusão de condutor via
  provedor fiscal, sempre em ação explícita;
- cadastro de veículos e condutores por empresa;
- trilha de auditoria e controle otimista de versão;
- manifestação do destinatário mantida nas rotas fiscais existentes.

## Implantação

1. Revisar o ambiente e fazer backup do banco.
2. Executar a migration `20260727090000-manifestos.cjs`.
3. Informar o código IBGE do município em Configuração Fiscal.
4. Conceder a rota `/uikit/manifestos` apenas às empresas e usuários desejados.
5. Validar primeiro em homologação antes de qualquer uso fiscal em produção.

Os testes automatizados do repositório validam apenas regras locais. Eles não
emitem, consultam, cancelam, encerram ou manifestam documentos no provedor.
