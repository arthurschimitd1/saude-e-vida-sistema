# Backend da Saúde e Vida

Esta camada concentra as regras de negócio, o acesso ao PostgreSQL e as integrações de notificações.

- `src/routes`: rotas públicas e autenticadas da aplicação.
- `src/services`: regras de negócio e integrações do sistema.

O projeto é publicado como uma aplicação Next.js integrada: os adaptadores em `frontend/app/api` encaminham cada rota para estes handlers. Assim, a apresentação e o domínio ficam separados sem alterar as rotas públicas do aplicativo.
