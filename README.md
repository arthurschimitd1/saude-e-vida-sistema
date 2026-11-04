# Cave

Aplicativo de produtividade pessoal pensado para celular, tablet e navegador. O Cave reúne rotinas, planejamento, estudos, relógios de foco e recursos de comunidade em uma experiência PWA de visual escuro e responsivo.

## Visão do produto

O objetivo é transformar intenção em consistência: o usuário organiza os blocos do dia, acompanha sessões de foco, planeja tarefas com horário e mantém o progresso de estudos e metas em um único lugar.

## Principais recursos

- Cadastro e acesso por e-mail com PIN numérico de quatro dígitos.
- Rotinas de manhã, tarde e noite, com ordenação e conclusão diária.
- Planejamento com horários, lembretes e notificações push.
- Pomodoro configurável, timer, cronômetro e modo de tela cheia.
- Registro de sessões de foco e acompanhamento semanal.
- Área de estudos com matérias, assuntos e progresso.
- Metas de futuro, check-in diário, planejamento semanal e desafios em comunidade.
- Instalação como PWA, com layout adaptado a celulares e tablets em qualquer orientação.

## Arquitetura

```text
cave/
├── frontend/             # Interface, PWA e adaptadores HTTP do Next.js
│   ├── app/
│   └── public/
├── backend/              # Regras de negócio, banco e notificações
│   └── src/
│       ├── lib/
│       └── routes/
```

Os arquivos em `frontend/app/api` são adaptadores pequenos. A implementação das rotas fica em `backend/src/routes`, o que mantém a divisão entre interface e domínio sem mudar as URLs já usadas pelo aplicativo.

## Tecnologias

- Next.js, React e TypeScript
- PostgreSQL hospedado no Neon
- Web Push com VAPID e agendamento via QStash
- PWA com service worker e manifesto para instalação

## Como executar

```bash
cp .env.example frontend/.env.local
npm install --prefix frontend
npm run dev
```

Abra `http://localhost:3000`. Para habilitar banco e notificações, preencha as variáveis de `frontend/.env.local` com credenciais próprias. Nunca publique arquivos `.env` ou chaves privadas.

## Comandos úteis

```bash
npm run build  # valida o build de produção
```

## Organização para recrutadores

Este repositório foi organizado para deixar claras as responsabilidades do projeto: a camada de interface está em `frontend`, enquanto persistência, autenticação, domínio e notificações estão em `backend`. O código foi escrito em TypeScript e inclui fluxos reais de produto, como autenticação por PIN, sincronização de dados e suporte a notificações.
