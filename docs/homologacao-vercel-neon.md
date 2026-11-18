# Homologacao da Lucro+

Este documento descreve a preparacao do segundo ambiente sem alterar a producao.

## Arquitetura

```text
main          -> Vercel producao   -> Neon production
homologacao   -> Vercel homologacao -> Neon branch homologacao
arthur        -> Preview/desenvolvimento
```

Os projetos atuais continuam sendo os de producao:

- `lucromais-frontend-mssolucoes`, com Root Directory `frontend`;
- `lucromais-backend-mssolucoes`, com Root Directory `backend`.

Para uma homologacao permanente, criar dois projetos separados na Vercel:

- `lucromais-frontend-homologacao`, Root Directory `frontend`;
- `lucromais-backend-homologacao`, Root Directory `backend`.

Os dois podem usar o mesmo repositorio, mas devem acompanhar a branch `homologacao`.
Nao conectar a homologacao ao dominio de producao.

## O que falta configurar fora do repositorio

1. Criar no Neon a branch `homologacao` a partir do estado atual da producao.
2. Copiar a connection string dessa branch para `DATABASE_URL` do backend de homologacao.
3. Cadastrar as variaveis do arquivo `backend/.env.homologacao.example` no projeto da Vercel.
4. Trocar no frontend a `NEXT_PUBLIC_API_URL` pela URL do backend de homologacao.
5. Usar credenciais de teste para Focus, WhatsApp, Google e demais integracoes.

Os arquivos `.env.homologacao.example` sao apenas modelos. Eles nao contem segredos e nao devem ser renomeados para `.env` dentro do repositorio.

## Backup antes da primeira migration

O Neon deve ter um snapshot/branch de backup e tambem um dump externo. A partir da pasta `backend`:

```bash
LUCROMAIS_ENV=production \
ALLOW_PRODUCTION_BACKUP=1 \
DATABASE_URL='CONEXAO_NEON_PRODUCAO' \
./scripts/backup-neon.sh
```

O script grava em `backend/backups/`, valida o arquivo com `pg_restore --list` quando disponivel e bloqueia execucoes acidentais sem uma identificacao explicita do ambiente.

## Migrations

Executar primeiro na homologacao:

```bash
cd backend
npm run db:migrate:status
npm run db:migrate
```

Depois dos testes, executar na producao com a connection string de producao e backup confirmado. Nao colocar `db:migrate` no build da Vercel e nao usar `db:migrate:undo` automaticamente.

## Validacao minima

- Backend `/health` retorna HTTP 200;
- frontend carrega e faz login;
- estoque, caixa, producao, vendas, permissoes e CRM funcionam;
- dados criados na homologacao aparecem somente no Neon `homologacao`;
- nenhuma chamada usa a URL ou o banco de producao;
- nenhuma emissao fiscal real ou WhatsApp de cliente e executada durante os testes.

Depois da validacao, a promocao para `main` continua sendo feita por Pull Request. A producao nao deve ser alterada apenas para criar a homologacao.
