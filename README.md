# Saúde e Vida

Sistema de gestão comercial da Saúde e Vida, com operação de caixa, estoque, clientes, financeiro, pedidos e uma lojinha virtual integrada ao estoque.

## O que o sistema faz

- Controle de produtos, estoque, categorias e movimentações.
- Operação de caixa, vendas, cancelamentos, clientes e formas de pagamento.
- Gestão financeira, contas a receber, relatórios e indicadores.
- Controle de colaboradores, empresas e permissões de acesso.
- Integrações de pagamento, WhatsApp, emissão fiscal e serviços externos quando configuradas.
- Loja virtual com catálogo controlado pela configuração da empresa.
- Programa de pontos, cupons, prêmios e roleta promocional.

## Estrutura do projeto

```text
Saude e vida/
├── frontend/                  # Next.js, React, TypeScript e telas do sistema
│   ├── app/(main)/             # Área autenticada e gestão interna
│   ├── app/loja/               # Páginas públicas da loja virtual
│   └── public/                 # Imagens e arquivos públicos
├── backend/                   # API, regras de negócio, autenticação e integrações
│   ├── src/controllers/        # Controladores HTTP
│   ├── src/routes/             # Rotas da API
│   ├── src/services/           # Regras de negócio
│   ├── src/models/             # Modelos do banco
│   └── migrations/             # Evolução do schema do PostgreSQL
├── docs/lojinha-virtual/       # Documentação específica da loja
└── docs/roleta/               # Documentação específica da roleta e pontos
```

## Lojinha virtual

A loja não publica automaticamente todo o estoque. Um produto precisa ser adicionado à configuração da lojinha, receber uma categoria da loja e ser marcado como **Na loja**. O vínculo com o produto do estoque é mantido pelo ID original.

A loja contempla:

- catálogo, categorias próprias, fotos e nome público personalizado;
- produtos por unidade e produtos a granel;
- carrinho, checkout, retirada na loja e entrega regional;
- Pix e cartão via Mercado Pago;
- cupons de primeira compra e cupons vinculados a clientes;
- pedidos com atualização de status e notificações;
- integração de pontos entre compras online e vendas do caixa.

Veja a documentação em [`docs/lojinha-virtual/README.md`](docs/lojinha-virtual/README.md).

## Roleta e programa de pontos

A roleta cadastra participantes, permite configurar prêmios e gera um código individual para uso na loja. O sistema também acumula pontos por compras vinculadas ao cliente, tanto no caixa quanto na loja online.

Veja a documentação em [`docs/roleta/README.md`](docs/roleta/README.md).

## Como executar localmente

1. Instale Node.js compatível com os arquivos `package.json`.
2. Configure as variáveis de ambiente a partir dos arquivos `.env.example`, quando disponíveis.
3. Instale as dependências:

   ```bash
   npm install --prefix frontend
   npm install --prefix backend
   ```

4. Execute as migrações no backend:

   ```bash
   cd backend
   npx sequelize-cli db:migrate
   ```

5. Inicie frontend e backend pelos scripts definidos em cada `package.json`.

Nunca publique arquivos `.env`, tokens, chaves privadas ou credenciais. Os arquivos de ambiente locais estão protegidos pelo `.gitignore`.

## Build

```bash
npm run build --prefix frontend
```

O deploy da aplicação é dividido entre a interface Next.js e a API Node/Express. As variáveis de ambiente de produção devem ser configuradas no provedor de hospedagem.
