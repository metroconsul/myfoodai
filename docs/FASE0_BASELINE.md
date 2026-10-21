# Fase 0 — Baseline & Auditoria (2026-10-21)

Branch: `main` · HEAD: `50fe106` ("Add project README") · Nenhum commit criado nesta fase.

## Estado do Git (antes de qualquer alteração desta fase)
- 60 entradas rastreadas alteradas: 50 modificadas, 10 removidas (1 staged: `.env`; 9 não staged).
- 59 arquivos no `git diff` (+1297 / −3436), mais `.env` removido do índice.
- 59 arquivos não rastreados (a auditoria anterior citava 24; o número cresceu com `tmp/`, `output/`, `.codex-finalizer/`).
- Removidos: `.env`, `.lovable/*` (4), `bun.lock`, `bunfig.toml`, `src/integrations/lovable/index.ts`,
  `src/integrations/supabase/previewAuthStorage.ts`, `src/lib/lovable-error-reporting.ts` (remoção intencional da migração Lovable).

## Classificação
- **A. Migração**: remoções Lovable acima; `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `.nvmrc`, `vercel.json`,
  `src/integrations/supabase/*`, `src/lib/stripe.server.ts`, `src/lib/error-reporting.ts`, `supabase/config.toml`.
- **B. Funcionalidades**: `src/lib/*.functions.ts`, rotas `portal.*`, `_authenticated/app.*`, `src/lib/automation.server.ts`, `src/routes/api/automation/*` (9 endpoints), migrations novas `20260905…` e `20260930…`, `supabase/verify.sql`.
- **C. Documentação**: `docs/*` (16 arquivos novos, incl. `MYFOODS_ARCHITECTURE.md`, `PLANO_TECNICO_TRANSFORMACAO_MYFOODS.md`), `README.md`, `AGENTS.md`.
- **D. Config/infra**: `eslint.config.js`, `playwright.config.ts`, `scripts/audit.mjs`, `e2e/*`, `.gitignore`.
- **E. Possíveis resíduos (não removidos)**: `tmp/` (5,8 MB, renders de apresentação), `output/` (pptx/pdf comercial), `.codex-finalizer/`, `supabase/.temp/` (ids do projeto vinculado), `supabase/migrations/20260905000002_stripe_subscription_security.sql.log`, `test-results/`, `docs/audit.json`.

## Segurança (valores nunca registrados)
- `.env` estava versionado no HEAD (commit `aab246d`) com 6 variáveis Supabase (URL, project id, chave *publishable*). São valores públicos por natureza, mas o arquivo continua no histórico. Sua remoção está staged; `.gitignore` agora cobre `.env*` (exceto `.env.example`).
- `.env.local` (ignorado, permissão 600) contém segredos reais: service role Supabase, token de automação, segredo n8n, `VERCEL_OIDC_TOKEN`. **Não versionado — correto.**
- Nenhum padrão `sk_live_`/`sk_test_`/`whsec_` real ou chave privada no HEAD ou no working tree. `docs/STRIPE.md` só tem placeholder `whsec_...`. Ocorrências de "service_role" nas migrations são nomes de políticas SQL.
- Risco residual: commit `65384e8` ("Atualizou key Stripe live") mexeu em `billing.ts`/`billing.functions.ts`; o valor atual não está hardcoded, mas recomenda-se revisar se algum price/chave live passou pelo histórico. Reescrita de histórico é proibida (AGENTS.md).

## Estrutura técnica
React 19.2.8 · TanStack Start 1.168.60 / Router 1.170.41 · Vite 8.1.5 · TypeScript 5.9.3 (strict) · Tailwind 4.3.3 · Supabase JS 2.115 · Stripe 22.4 · Playwright 1.56 · Node 22 (servidor Node, não SPA).
- Rotas de UI: 54 arquivos em `src/routes` (excl. api) — 36 no app autenticado/onboarding, 18 landing/auth/portal.
- Rotas HTTP: 12 arquivos em `src/routes/api` (2 públicas: webhook Stripe e afins; 9 de automação + helpers).
- Server functions: 80 ocorrências de `createServerFn`, 53 arquivos em `src/lib`.
- Migrations: 24 (as 5 mais novas ainda não aplicadas no Cloud — a confirmar na Fase 1); ~69 tabelas distintas.

## Funcionalidades (levantamento por rotas/arquivos, sem teste funcional)
- **Ponto**: implementado — time-entries, shifts, schedules (+templates/histórico/conformidade), point-cards, validação facial (`face-validation.server.ts`), portal (ponto, cartão-ponto, escala).
- **Estoque**: parcial — `inventory`, `items`, entregas/regras (`deliveries`, `delivery-rules`), `sales`; alertas/inventário formal a validar.
- **Documentos**: implementado — holerites (admin + portal), documentos do portal, conformidade (exames, kits, trocas de EPI, pendências), LGPD/aceite.
- **Compras / Caixa / Financeiro / Hub / Executive**: não existem (como esperado).

## Validações
| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | OK (0 erros) |
| `npm run lint` | OK — 0 erros, 14 avisos (hooks/Fast Refresh, preexistentes e já documentados em `docs/VALIDATION.md`) |
| `npm run build` | OK |
| `playwright e2e/migration.smoke.spec.ts` (build local, porta 4173) | 5/5 aprovados |
| `e2e/migration.functions.spec.ts`, `portal-*.spec.ts` | **Não executados**: dependem de dados/credenciais no Supabase Cloud e poderiam gravar em produção |
| `git diff --check` | sem problemas |

## Pendências / decisões humanas
1. Decidir destino de `tmp/`, `output/`, `.codex-finalizer/`, `supabase/.temp/` (sugestão: adicionar ao `.gitignore`, não ao commit).
2. Confirmar que remover `.env` do versionamento é desejado (as variáveis passam a vir de `.env.local`/Vercel).
3. Rotacionar, por prudência, `VERCEL_OIDC_TOKEN` e confirmar que `.env.local` nunca foi enviado a terceiros.
4. Baseline commit **não** criado — ver relatório.
