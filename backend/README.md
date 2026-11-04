# Backend do Cave

Esta camada concentra as regras de negócio, o acesso ao PostgreSQL e as integrações de notificações.

- `src/routes`: handlers de autenticação, planejamento, foco, comunidade e notificações.
- `src/lib`: serviços compartilhados, como o agendamento de lembretes.

O projeto é publicado como uma aplicação Next.js integrada: os adaptadores em `frontend/app/api` encaminham cada rota para estes handlers. Assim, a apresentação e o domínio ficam separados sem alterar as rotas públicas do aplicativo.
