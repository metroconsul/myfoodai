# Auditoria e migração para desenvolvimento independente

Data: 05/09/2026. Repositório: https://github.com/metroconsul/myfoodai.git.
O commit de origem e o inventário de 227 arquivos estão em `audit.json`.

## Estado da entrega

O código foi desvinculado do editor, build, autenticação intermediada, armazenamento
compartilhado de sessão e gateway de IA do Lovable. O frontend e o backend compilam
para Node. O snapshot recebido foi restaurado no Supabase do proprietário
(`obfwapckvwjpjzlumlei`): 68 tabelas, 291 registros públicos, quatro usuários e cinco
arquivos de Storage. Dados e arquivos foram comparados com o export, sem divergências.

A cópia local usa `.env.local` com as credenciais do destino. Credenciais e backup ficam
fora do Git. O projeto antigo permanece intacto; nenhuma alteração foi enviada ao GitHub.
Google OAuth, Stripe e o provedor de visão exigem configuração própria fora do backup.
Consulte `BACKUP-RECEIVED.md` e `VALIDATION.md` para evidências e limites.

## Arquitetura encontrada

- React 19, TypeScript, Vite 8 e Tailwind 4.
- TanStack Start/Router com 52 declarações de rotas de UI (incluindo layouts) e duas
  rotas HTTP: `/api/public/sales-ingest` e `/api/public/stripe-webhook`.
- 64 funções de servidor encontradas na varredura do código original preservado.
- Supabase Auth, Postgres/RLS e Storage; 68 tabelas definidas nas migrations e nos
  tipos gerados, sem divergência de nomes entre essas duas listas.
- 18 migrations originais, mais duas migrations de portabilidade adicionadas.
- UI local shadcn/Radix, Lucide, React Query, formulários Zod/React Hook Form e gráficos.
- Não há diretório `supabase/functions/` no Git nem chamadas a funções Edge do Supabase
  no código inventariado. Funções criadas fora do Git só podem ser verificadas no Cloud.
- `pages/`, `api/`, `assets/`, `components/`, `hooks/` e `lib/` na raiz não são necessários:
  os equivalentes ficam em `src/routes`, `src/routes/api`, `public` e demais pastas `src`.
- Não falta `index.html`: TanStack Start gera as entradas e faz SSR; `src/server.ts`
  preserva o tratamento de erros. Não converter para SPA estática, pois isso removeria
  as funções que usam service role e a validação de webhooks.
- Não falta configuração JavaScript do Tailwind: a versão 4 usa `src/styles.css` e
  o plugin `@tailwindcss/vite`. O alias `@/` é definido em `tsconfig.json` e resolvido
  pelo suporte nativo do Vite 8.

## Dependências removidas e substituições

| Origem | Substituição / resultado |
| --- | --- |
| `@lovable.dev/vite-tanstack-config` | Plugins oficiais Vite, React, Tailwind, TanStack Start e Nitro com preset Node |
| `@lovable.dev/cloud-auth-js` | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Ponte de sessão do preview via `postMessage` | Persistência padrão do Supabase no navegador, sem envio da sessão ao editor |
| Telemetria `window.__lovable*` | Diagnóstico local em `console.error` |
| `ai.gateway.lovable.dev` + `LOVABLE_API_KEY` | Endpoint/modelo/chave configuráveis de visão compatível com chat/completions |
| `lovable_ai` nas políticas | `vision_api`, com migração SQL dos registros existentes |
| `LOVABLE_CRON_SECRET*` | `CRON_SECRET*`; o helper permanece disponível, sem scheduler obrigatório |
| `.lovable/`, configurações e lock do Bun | Removidos; npm e `package-lock.json` passam a ser a referência |
| Google Fonts remoto | Mesmas famílias/pesos via pacotes Fontsource, servidos pelo próprio Vite/Node |

Não há imports, endpoints ou hooks ativos do Lovable em `src/`. Referências textuais
restam na documentação histórica e nas migrations que transformam o valor legado:
isso é histórico/compatibilidade de dados, não dependência executável.
Os componentes gerados foram preservados: geração automática não implica dependência
proprietária. O arquivo `src/routeTree.gen.ts` continua gerado pelo TanStack Router;
`src/integrations/supabase/types.ts` descreve o schema e pode ser regenerado pela CLI.

## Comportamento preservado e correções

Classes, cores, textos de produto, preços, componentes visuais e assets originais
foram mantidos. As famílias Dela Gothic One, Space Grotesk e Space Mono mantêm os
pesos antes pedidos ao Google Fonts. Capturas de desktop/mobile foram feitas nos testes;
não houve comparação com screenshots autenticados do ambiente antigo.

O login Google retorna a `/auth`, que resolve sessão, onboarding e checkout pendente.
A tela de autenticação agora renderiza no cliente, como as áreas autenticadas, para
eliminar divergência de hidratação observada nos testes. O Portal tem um guard comum
para que visitantes sem token não recebam páginas vazias de documentos.
As verificações reais de identidade/empresa continuam no backend; o guard não substitui RLS.
Após criar uma empresa, o cache do workspace é descartado para carregar a operação nova,
corrigindo o retorno indevido à configuração inicial encontrado no teste de integração.

Foram corrigidos tipos `any` em helpers de políticas/cartões e uma expressão regular
redundante. O lint usa ESLint para erros de código; Prettier fica como formatador separado,
sem reformatar milhares de linhas herdadas. Avisos preexistentes de hooks/Fast Refresh
não bloqueiam compilação e estão registrados na validação.

A API de visão mantém o prompt, as decisões, mensagens, formato de retorno e evidências.
Pode apontar para um servidor de modelos open source compatível com imagens ou serviço
independente escolhido. Nenhum modelo ou servidor de inferência está incluído. Os mesmos
resultados de IA não podem ser garantidos com outro modelo; precisam de homologação.
Se endpoint/modelo faltarem ou o serviço falhar, retorna `indisponivel`.
`selfie_evidence` só é usado quando explicitamente selecionado e continua indicando
`liveness: nao_avaliado`, sem se apresentar como reconhecimento biométrico.

## Transferência do backend realizada

O backup custom PostgreSQL foi inspecionado antes da execução. O destino vazio recebeu
usuários/identidades, schema das migrations originais e dados públicos em ordem de chaves
estrangeiras, preservando UUIDs. As migrations de portabilidade foram aplicadas por último.
Os cinco objetos de Storage foram associados aos downloads por tamanho e hash e enviados
pelos caminhos originais. Os buckets privados são `item-photos`, `avatars`, `signatures`,
`documents` e `payslips`.

As 20 versões constam no histórico de migrations. Não reaplique o dump nem a carga de dados
neste destino. Para novas alterações, crie migrations adicionais. O arquivo `supabase/verify.sql`
contém consultas de conferência. O servidor antigo não foi removido.

Sessões e tokens administrativos antigos não foram transferidos. Os hashes de senha
presentes no export e os PINs foram preservados; contas Google dependem de habilitar o
provedor no destino. Secrets, jobs e eventuais funções existentes somente no Cloud não
fazem parte do export recebido e precisam de configuração própria.

Em uma nova instalação sem dados, configure `.env.local` e aplique as migrations em ordem.
Para publicar esta cópia, execute `npm run build`, use hospedagem Node e configure URLs de
retorno e webhooks para o domínio escolhido. Alterar `VITE_*` exige novo build.

Referências: [exportação do Cloud](https://docs.lovable.dev/features/advanced-settings#export-lovable-cloud-data),
[migrations Supabase](https://supabase.com/docs/guides/local-development/database-migrations),
[Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google),
[deploy Node/TanStack](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).

## Configurações externas inventariadas

| Configuração | Uso |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente web, incorporados no build |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Middleware de sessão e consultas RLS no servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | Portal CPF/PIN, onboarding, documentos e operações administrativas |
| `STRIPE_API_KEY` | Checkout; nomes antigos `STRIPE_LIVE_API_KEY` e `STRIPE_TEST_API_KEY` continuam aceitos |
| `STRIPE_WEBHOOK_SECRET` | Validação de eventos de assinatura |
| `FACE_VISION_ENDPOINT`, `FACE_VISION_MODEL`, `FACE_VISION_API_KEY` | Provedor independente de análise de selfie |
| `FACE_VALIDATION_PROVIDER` | Override opcional da política por empresa |
| `FACE_PROVIDER_API_KEY` | Adapter externo já existente; endpoint vem da política no banco |
| `GEOCODING_ENDPOINT` | Geocodificação; padrão Nominatim, alternativa configurável |
| `CRON_SECRET`, `CRON_SECRET_PREVIOUS` | Helper de autenticação de jobs, com rotação |
| `E2E_PORTAL_CPF`, `E2E_PORTAL_PIN`, `E2E_BASE_URL` | Testes opcionais com colaborador e backend de teste |

Os IDs/preços Stripe existentes foram mantidos. O backend tem fallback para criar
price data quando o Price ID não existe na conta configurada. Isso depende de uma
conta Stripe funcional; não foi criado checkout nem realizada cobrança nesta execução.

## Lacunas e limitações preexistentes

O README original era uma especificação extensa, não uma descrição verificável de tudo
que estava entregue. Foi arquivado em `PRODUCT-SPEC.original.md`.

- `sendPointCard` registra notificações pendentes e comenta que WhatsApp/e-mail será
  conectado depois. Não há worker/provedor de entrega implementado no Git. A migração
  mantém a fila e o Portal, mas não inventa envio efetivo sem fornecedor/configuração.
- A conexão de vendas por API registra configuração, mas não implementa um cliente de
  PDV específico. CSV e o endpoint de ingestão existem; nenhum provedor novo foi inventado.
- “Esqueci minha senha” orienta contatar o administrador. Não havia tela de recuperação
  completa. O plano de migração de usuários deve usar o fluxo de recuperação do Supabase.
- A análise de visão original não faz comparação biométrica 1:1; avalia qualidade,
  oclusões e indícios de recaptura. A substituição preserva esse limite.
- O helper atual de cálculo de cartão usa primeiras batidas por tipo/dia e sinaliza
  duplicadas; cenários de múltiplos blocos e virada de dia exigem homologação de negócio.
- O webhook Stripe registra idempotência antes das atualizações e alguns erros de banco
  são apenas registrados. Falhas parciais podem exigir reconciliação; essa lógica
  preexistente foi preservada, não validada com eventos reais.

Esses pontos não foram apresentados como funções completas nem como dependências do
Lovable. Implementar novos provedores ou alterar cálculo de jornada amplia o escopo de
uma migração que deve preservar funcionalidades e requer critérios próprios.

## Evidências e limites de validação

Consulte `VALIDATION.md` para comandos e resultados finais. O inventário automatizado
lê todos os arquivos originais e resolve imports locais TypeScript; não é uma afirmação
de cobertura funcional total. `npm run typecheck` mantém todas as opções strict originais.
Testes de navegação cobrem interface pública, OAuth interceptado, guards e assets;
testes de funções cobrem PIN/tokens e decisões de visão com respostas simuladas.
Os resultados de testes autenticados e da transferência estão em `VALIDATION.md`.
