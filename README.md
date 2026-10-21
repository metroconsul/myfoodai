# MyFoodAI

Aplicação de gestão de food service com React 19, TypeScript, Tailwind CSS 4,
Vite, TanStack Start/Router/Query e Supabase. Desenvolvimento em VS Code, Node e npm.
O build e o runtime não exigem editor, SDK, hospedagem ou gateway do Lovable.

## Executar

Requer **Node.js 22.12+** (recomendado Node 22 LTS).

```sh
npm install
npm run dev
```

Abra http://localhost:5173. Nesta cópia local, `.env.local` já aponta para o Supabase
do proprietário, com banco, usuários e arquivos restaurados do export recebido.
Em um novo clone, copie `.env.example` para `.env.local` e configure seu Supabase
antes do primeiro uso de autenticação/dados. Credenciais e backups não são versionados.

O frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
O backend usa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SERVICE_ROLE_KEY`. Use o mesmo projeto em ambos. A chave administrativa
é indispensável ao Portal CPF/PIN, onboarding e demais operações administrativas.
Nunca coloque chaves secretas em variáveis `VITE_*`.

## Verificar e publicar em servidor Node

```sh
npm run typecheck
npm run build
npm start
```

O build gera `.output/server/index.mjs` e `.output/public/`.
`npm start` carrega `.env` e `.env.local` via Node; variáveis do ambiente de hospedagem
prevalecem. Em produção, use `PORT` e `HOST` conforme necessário.
`npm run preview` também permite inspecionar o build localmente.
Esta aplicação tem backend e não pode ser publicada somente como arquivos estáticos.

## Estrutura

- `src/routes/`: páginas, layouts e APIs HTTP em `api/public/`.
- `src/lib/`: funções de servidor, regras de negócio, schemas e utilitários.
- `src/integrations/supabase/`: clientes, autenticação e tipos do banco.
- `src/components/`, `src/hooks/`, `src/config/`: UI, estado e configuração do produto.
- `src/styles.css`: Tailwind 4 e identidade visual original.
- `public/`: arquivos públicos estáticos.
- `supabase/migrations/`: schema, RLS, triggers e migração do provedor facial.
- `e2e/`: testes de navegação e do Portal.
- `docs/MIGRATION.md`: auditoria, dependências externas e transferência do backend.
- `docs/FILES.md`: inventário de todos os arquivos originais.
- `docs/CHANGES.md`: alterações por arquivo e justificativas.

Não faltam `index.html`, `src/main.tsx`, `pages/` ou `tailwind.config.js`:
TanStack Start fornece as entradas de renderização, usa `src/routes/` e o Tailwind 4
é configurado no CSS e no plugin Vite. `src/routeTree.gen.ts` é gerado automaticamente.
Componentes shadcn/Radix são código local e bibliotecas open source; foram preservados.

## Serviços

Login Google usa Supabase Auth diretamente: habilite Google no painel de seu Supabase,
configure o cliente OAuth e permita `http://localhost:5173/auth` e o domínio de produção.
Stripe mantém os preços e o checkout existentes e exige credenciais da sua conta.
Configure `APP_URL`, `STRIPE_API_KEY` e `STRIPE_WEBHOOK_SECRET` somente no servidor;
o endpoint público é `/api/public/stripe-webhook`. Consulte [STRIPE.md](docs/STRIPE.md).
A validação facial usa `FACE_VISION_ENDPOINT`, `FACE_VISION_MODEL` e, se necessário,
`FACE_VISION_API_KEY`, em uma API compatível com chat/completions e imagens.
As regras e mensagens existentes foram mantidas, mas equivalência de resultados de IA
precisa ser validada com o modelo escolhido. Nenhum modelo é baixado automaticamente.
Geocodificação usa Nominatim ou o endpoint definido pela empresa.

Consulte [MIGRATION.md](docs/MIGRATION.md) antes de trocar o banco de produção.
