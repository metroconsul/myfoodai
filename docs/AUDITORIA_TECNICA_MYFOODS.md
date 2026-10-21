# MYFOODS — AUDITORIA TÉCNICA COMPLETA

**Data:** 2026-10-20 · **Natureza:** somente leitura (nenhum arquivo de código, schema, policy, migration ou configuração foi alterado; este relatório é o único arquivo criado)
**Referência estratégica:** `docs/MYFOODS_ARCHITECTURE.md` (v1.0, diretriz aprovada)
**Escopo do repositório:** `/home/m1000/Documents/ChatGPT/New project/myfoodai` (remoto: `github.com/metroconsul/myfoodai`)

**Convenção de evidência:** cada afirmação é marcada como **FATO** (verificado no código/migrations deste repositório), **HIPÓTESE** (inferência plausível, não verificada) ou **NÃO VERIFICADO** (exige acesso ao Supabase Cloud/Stripe Dashboard). Recomendações aparecem como **RECOMENDAÇÃO**.

---

## 1. Resumo executivo

**FATOS**

- O MyFoods é um SaaS operacional de food service, multiempresa e multiunidade, construído como **uma única aplicação TanStack Start (SSR em Node)** com React 19, TypeScript strict, Tailwind 4 e Supabase (Postgres + RLS + Auth + Storage), monetizada com **uma assinatura Stripe única por empresa** (planos Começo/Essencial/Equipe).
- O produto atual entrega, de fato, funcionalidades que mapeiam para **3 dos 6 produtos planejados**: **Ponto** (o mais maduro: escalas, turnos, registros com geolocalização, revisão, cartões-ponto, timesheet), **Estoque** (catálogo, saldo por unidade, movimentações, inventário, alertas) e **Documentos** (documentos ocupacionais, holerites com versões/assinaturas/disputas, solicitações e ciência, kits de uniforme). **Compras, Caixa e Financeiro não existem em nenhum ponto do código** (apenas `suppliers` existe, como apoio ao estoque).
- Existe também um conjunto de funcionalidades **fora dos seis produtos planejados** que precisará de destino na modularização: **EPIs/entregas** (módulo de entregas com evidência e aceite), **Vendas** (ingestão por API/webhook + métricas diárias), **Conformidade/exames**, **LGPD** (políticas de privacidade/aceite) e o **Portal do Colaborador** (app mobile-first por CPF+PIN).
- O pré-requisito central do portal planejado já existe parcialmente: `feature_entitlements` por empresa, espelhada em RLS via `app_auth.has_feature()`, com trigger que sincroniza direitos ao plano (`sync_plan_entitlements`). **Essa é a base natural para produtos individuais e pacotes.**
- O app é um shell único (`/app`) com menu único; **não há portal central de seleção de produtos** (a "Opção B" da arquitetura ainda não foi implementada).
- A migração do Lovable foi concluída e validada (ver `docs/MIGRATION.md` e `docs/VALIDATION.md`): zero dependência executável do editor; 68 tabelas restauradas; build Node; testes Playwright aprovados contra dev e produção.

**Principais riscos para a transformação (detalhes na seção 12)**

1. **ALTO — proveniência de papel não verificada por empresa** em `is_company_admin()`/`has_role()`: um papel concedido na empresa B autoriza administração na empresa A (se `profiles.company_id = A`). Corrigível com migration aditiva pequena.
2. **ALTO — autorização por funcionalidade inconsistente no banco**: `has_feature()` é aplicado em RLS apenas em `schedules`, `shifts`, `schedule_templates`, `inventory_items` e `sales_orders`; as demais tabelas (ponto, itens, entregas, holerites, documentos) só isolam empresa/unidade. Para vender produtos individualmente, o backend precisa passar a exigir o direito do produto em **todas** as tabelas do domínio.
3. **ALTO — Storage com policies apenas por bucket no Git** (`app_files_*` por `bucket_id`): isolamento por pasta de empresa pode existir no Cloud, mas não está versionado. Verificação no Cloud é imprescindível antes de modularizar Documentos.
4. **MÉDIO — monetização parcialmente bloqueada**: só o plano Começo tem Price IDs configurados (`src/config/billing.ts`); Essencial/Equipe lançam erro no checkout; CTAs de planos pendentes (`roadmap.md`); webhook sem suporte a múltiplos produtos.
5. **MÉDIO — duas gerações de módulos convivendo** (ex.: `employee_item_deliveries` × `item_deliveries`; `point_cards` × `timesheet_*`), além de `roles` (cargos) vs `user_roles` (RBAC) — nomes confusos e duplicidade funcional.
6. **MÉDIO — limitação funcional do portal**: login busca colaborador por CPF global; CPF existente em 2 empresas quebra o login (`maybeSingle()` falha).

**RECOMENDAÇÃO (menor transformação)** — seção 13: reutilizar a arquitetura existente (um app, um banco) e introduzir **(a)** tabela `products` + catálogo de direitos por produto reaproveitando `feature_entitlements`; **(b)** um hub `/hub` leve após o login listando produtos contratados; **(c)** aplicação de `has_feature` em RLS para todos os domínios; **(d)** correção da proveniência de papéis. Sem reconstruir UI, banco ou autenticação.

---

## 2. Stack tecnológica

**FATOS** (fontes: `package.json`, `vite.config.ts`, `tsconfig.json`, `.nvmrc`, `src/server.ts`, `src/start.ts`)

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| UI | React + React DOM | ^19.2.0 |
| Linguagem | TypeScript (strict; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | ^5.8.3 |
| Framework full-stack | TanStack Start (SSR, server functions) | ^1.168.60 |
| Router / dados | TanStack Router + TanStack Query | ^1.170.41 / ^5.101.1 |
| Build | Vite + Nitro (preset `node-server` ou `vercel`) | 8.1.5 / 3.0.260603-beta |
| Estilo | Tailwind CSS 4 (config no CSS via `@theme`) + `tw-animate-css` | ^4.2.1 |
| Componentes | shadcn/Radix locais (`src/components/ui`, 45 arquivos), Lucide, Recharts, Sonner, vaul, cmdk | — |
| Formulários | react-hook-form + zod ^3.24.2 (schemas por server function) | — |
| Backend/DB | Supabase JS ^2.112.4 (Postgres, Auth, Storage, RLS) | — |
| Pagamentos | stripe ^22.4.0 (API version `2026-07-29.dahlia`) | — |
| Fontes | Fontsource local (Dela Gothic One, Space Grotesk, Space Mono) | — |
| Testes | Playwright 1.56 (`e2e/`), ESLint 9, Prettier 3 | — |
| Runtime | Node ≥ 22.12 (`.nvmrc` = 22), npm (lockfile v3) | — |

**FATOS de operação**

- Build gera `.output/server/index.mjs` + `.output/public/`; `npm start` carrega `.env`/`.env.local` via `--env-file-if-exists`. **A aplicação exige servidor Node** (server functions + webhooks + service role) — não pode ser publicada como SPA estática (`README.md`, `AGENTS.md`).
- Scripts: `dev`, `build`, `preview`, `start`, `typecheck`, `lint`, `format`, `test:e2e`, `test:migration`, `audit:source` (`scripts/audit.mjs` — inventário de imports/tabelas/server functions vs HEAD).
- Variáveis (nomes, `.env.example`; **valores nunca registrados**): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (front); `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `FACE_VISION_ENDPOINT`, `FACE_VISION_MODEL`, `FACE_VISION_API_KEY` (servidor). Usadas em código mas **ausentes do `.env.example`**: `MYFOODS_AUTOMATION_TOKEN` (`src/lib/automation.server.ts:42`), `CRON_SECRET`/`CRON_SECRET_PREVIOUS` (`src/integrations/supabase/cron-auth.ts`). **FATO de lacuna operacional**: os endpoints de automação falham fechado sem o token, mas a variável não está documentada no exemplo.
- **HIPÓTESE de fragilidade de toolchain**: Vite 8 + Nitro beta + override `rolldown: 1.2.1` — stack muito recente; upgrades exigem cautela (risco médio de build).

---

## 3. Estrutura atual do projeto

**FATOS**

```
docs/                    12 docs (arquitetura, migração, validação, Stripe, MVP histórico)
e2e/                     5 specs Playwright (smoke, portal login/sessão, functions, fixtures)
scripts/audit.mjs        auditoria de imports/tabelas/server fns vs git HEAD
public/                  logo/favicon estáticos
supabase/config.toml     project_id local "myfoodai"; site_url myfoodsai.com; redirects
supabase/migrations/     23 migrations SQL (+1 .log), 2.384 linhas, forward-only
supabase/verify.sql      checks read-only pós-migração (RLS, buckets, providers)
src/
  routes/                52 rotas declaradas (ver seção 4)
  _authenticated/        layout de sessão admin + /app + /onboarding
  api/public/            sales-ingest.ts, stripe-webhook.ts
  api/automation/        9 endpoints (dispatch, manager-summary, candidates, events)
  lib/                   54 módulos: 14 com server functions (~80 createServerFn)
  integrations/supabase/ client, client.server (service role), auth-middleware, auth-attacher, cron-auth, types.ts (5.234 linhas)
  components/            app-shell, feature-blocked, pricing-section, portal-ui, selfie-capture, signature-pad, lgpd-consent, item-photo, ui-kit + ui/ (45 shadcn)
  hooks/                 use-workspace, use-portal-session, use-portal-policies, use-signed-url, use-mobile
  config/                brand.ts, features.ts, plans.ts, billing.ts
  styles.css             design system "Acid Operations"
```

- `src/routeTree.gen.ts` (1.446 linhas) é gerado; **não editar manualmente** (`AGENTS.md`).
- **FATO de estado do Git (2026-10-20)**: working tree com alterações **não commitadas**, incluindo `M src/config/billing.ts`, `M src/config/brand.ts`, `M package.json`, `M AGENTS.md`, `M README.md`, `D .env`, `D .lovable/*`. A auditoria descreve o estado de trabalho atual; a divergência com HEAD deve ser reconciliada antes de qualquer planejamento de migration.

---

## 4. Diagnóstico do frontend

### 4.1 Rotas e layouts (**FATOS**; fontes `src/routes/**`, `src/routeTree.gen.ts`)

| Grupo | Layout | Rotas |
| --- | --- | --- |
| Pública | `__root.tsx` (QueryClientProvider + Toaster, SEO MY FOOD'S AI) | `/` landing (500 linhas; hero, marquee, recursos, **planos via `PricingSection`**, FAQ, CTA), `/auth` (login/cadastro e-mail+senha, Google OAuth) |
| HTTP | — | `POST /api/public/sales-ingest`, `POST /api/public/stripe-webhook`; `/api/automation/{dispatch,manager-summary,clock.candidates,documents.candidates,epis.candidates,events.claim,events.clock,events.documents,events.epis}` |
| Admin | `_authenticated/route.tsx` (`ssr:false`; valida `supabase.auth.getUser()`; redireciona `/auth`) | `/onboarding` (cria empresa+unidade via `bootstrap`); `/app` layout (`app.tsx` → `WorkspaceProvider` → gate de assinatura → `AppShell`) com 31 páginas: dashboard, employees, time-entries, point-cards(+id), shifts, schedules, schedule-templates, schedule-compliance, schedule-history, items(+id), inventory, deliveries(+id), delivery-rules, sales, conformidade (index, exames index/$id/novo, kits, pendencias, trocas), documentos/holerites (index/$id), settings/{aceite,jornada,lgpd}, units, roles-teams, admin/piloto |
| Colaborador | `portal.tsx` (`ssr:false`; `beforeLoad` exige token; bottom-nav mobile Início/Ponto/Documentos/EPIs) | `/portal/login`, `/portal` (recados do "Assistente MyFoods"), `/portal/ponto`, `/portal/escala`, `/portal/documentos(+id)`, `/portal/holerites(+id,/comprovante)`, `/portal/itens(+id)`, `/portal/cartao-ponto(+id)`, `/portal/pendencias`, `/portal/perfil` |

### 4.2 Estado e dados (**FATOS**)

- TanStack Query com um único `QueryClient` no contexto do router (`src/router.tsx`); chaves como `["workspace"]`, `["portal-me", token]`.
- `src/hooks/use-workspace.tsx` — contexto central do admin: `profiles` + `user_roles` + `platform_admins` + `companies` + `units` + `feature_entitlements`; deriva `isAdmin` (owner/admin), `isPlatformAdmin`, `hasSubscriptionAccess` (fontes `subscription`/`trial`/`admin_grant` com os mesmos critérios do SQL `app_auth.has_valid_access`), `features` (entitlements habilitados, com *fallback* para `planFeatures(planCode)` quando vazio), `hasFeature`. Unidade ativa em `localStorage.active_unit_id`. Branding da empresa aplicado via `applyCompanyBranding` (CSS vars).
- Portal: token em cliente (`use-portal-session`), tudo via server functions com service role no servidor.
- Formulários: react-hook-form + zod; sem Redux/Zustand.

### 4.3 Design system e responsividade (**FATOS**)

- `src/styles.css` — sistema "Acid Operations" (neo-brutalismo): tokens `--ink #09090b`, `--paper #f8f4e8`, `--acid #d2e823`, `--ember #f26b38`; sombras duras 2/4/8px; utilitários `surface-card`, `display-type`, `meta-mono`, `brut-press`, `portal-card/tile/press`; landing isolada em `.gh`; `prefers-reduced-motion` respeitado.
- `src/config/brand.ts` — marca central (`BRAND_NAME "MY FOOD'S AI"`, logo, cores) + override por empresa.
- Admin: sidebar fixa 264px com drawer no mobile (`lg:`), header sticky, seletor de unidade; Portal: mobile-first `max-w-lg`. E2E renderiza 1440×1000 e 390×844 sem erros de console (`e2e/migration.smoke.spec.ts`).
- **FATO**: menu do admin (`app-shell.tsx`) exibe apenas Dashboard, Colaboradores, Ponto, Documentos, EPIs — as demais páginas existem mas não estão no NAV (navegação por URL direta); o gate de feature por rota (`ROUTE_FEATURES` em `features.ts`) cobre 12 prefixos e trata rotas ausentes como liberadas.

### 4.4 Bibliotecas e dependências — ver seção 2. Nenhuma dependência do Lovable permanece (**FATO**, `docs/MIGRATION.md` + varredura `audit:source`).

---

## 5. Diagnóstico do Supabase

### 5.1 Migrations (**FATOS**; 23 arquivos SQL, forward-only)

| Migration | Conteúdo |
| --- | --- |
| `20260829134240_cee32520…` | **Schema base** (775 linhas): enums (`app_role`, `unit_type`, `employment_status`, `regime_type`, `schedule_status`, `time_entry_type`, `geo_status`, `item_type`, `movement_type`, `delivery_channel`, `delivery_status`); tabelas de empresas→vendas+notificações; helpers de segurança; trigger `on_auth_user_created` → `profiles`; RLS+grants em lote; policies por empresa e por unidade |
| `20260829134305…` | REVOKE/GRANT dos helpers (menor privilégio) |
| `20260829134344…` | Policies de Storage por bucket (`item-photos`, `avatars`, `signatures`, `documents`) |
| `20260830101855…` | Módulo de entregas: `delivery_rules`, `item_deliveries(+items/evidence/events)` |
| `20260830105459…` | Timesheet: `timesheet_periods`; `point_cards.period_id` |
| `20260830230759…` | `timesheet_entries`, `timesheet_disputes`, `point_card_evidence`, `timesheet_batches`, `point_card_events` |
| `20260831160253…` | **Holerites**: `payslips(+versions/signatures/disputes/settings/audit_events)` com partial unique index por período ativo |
| `20260831161250…` | Grants do módulo de holerites |
| `20260831205851…` | `acceptance_policies` (assinatura facial/geofence/provedor) + `privacy_policies` (LGPD) |
| `20260831211015…` | **Schema privado `app_auth`** + reescrita de todas as policies públicas para os helpers privados |
| `20260831234238…` | `subscriptions` (Stripe) + RLS somente leitura para o dono |
| `20260901094706/32…` | `stripe_webhook_events` (idempotência; deny para clientes) |
| `20260901210619…` | Campos de plano em `companies`; `company_id` em `subscriptions`; `platform_admins`; **`feature_entitlements`**; `app_auth.is_platform_admin/company_plan` |
| `20260901211326…` | `plan_feature_codes`, `apply_plan_entitlements`, trigger `sync_plan_entitlements`, `companies.access_source`; backfill |
| `20260901211729…` | Policies com `has_feature` (schedules, shifts, templates, inventory, sales) |
| `20260905000000…` | Provedor facial `lovable_ai` → `vision_api` |
| `20260905000001…` | Criação dos 5 buckets privados (limites de tamanho) |
| `20260905000002…` | **Segurança de assinatura**: `has_valid_access` (gate em `in_company`), `has_feature`; trigger `prevent_client_billing_update` (bloqueia campos de billing via cliente) |
| `20260930000707…` | **Motor de automações**: `automation_events` (ledger server-only; comentário: "n8n only orchestrates authenticated, idempotent requests") |
| `20260930001652…` | Deny explícito a `anon/authenticated` em `automation_events` |

### 5.2 Tabelas por domínio (**FATOS**; 60+ tabelas em `types.ts` e migrations; `docs/MIGRATION.md` contabiliza 68 no Cloud, contagem inclui tabelas de sistema)

- **Núcleo:** `companies` (branding, `plan_code`, `subscription_status`, `access_source`, `trial_ends_at`, `is_demo`, `fixed_schedule_mode`…), `units` (tipo, endereço, lat/lng, `point_radius_meters`), `profiles` (1 empresa por usuário), `user_roles` (enum `owner/admin/unit_manager/hr/stock_manager/supervisor/staff`), `user_units`, `platform_admins`, `feature_entitlements`, `audit_logs`, `notifications` (idempotency_key).
- **Pessoas:** `roles` (cargos), `teams`, `work_regimes`, `employees` (CPF único por empresa, PIN hash, bloqueio, `employment_status`), `portal_sessions` (hash de token, 12h, revogação).
- **Ponto/Escala:** `shifts`, `schedule_templates(+_items)`, `schedules` (versões/status), `schedule_blocks`, `schedule_changes`, `shift_swap_requests`, `point_policies` (geolocalização/raio), `time_entries` (server_time, geo, device_info, validation_status), `time_entry_reviews`, `point_cards(+deliveries/events/evidence)`, `timesheet_periods/entries/disputes/batches`, `fixed_work_schedules`.
- **Estoque/Itens:** `suppliers`, `catalog_items` (com tamanhos/cores/reposição — foco EPI/uniforme), `inventory_items` (saldo por unidade, validade, lote, custo), `stock_movements` (entrada/saida/ajuste/perda/transferencia/inventario, before/after), `inventory_counts(+_items)`, `stock_alerts`, `delivery_rules`, `item_deliveries(+_items/_evidence/_events)`, `employee_item_deliveries` (geração anterior).
- **Vendas:** `sales_connections` (provider/adapter/config+secret), `sales_import_jobs`, `sales_orders(+_items)`, `sales_daily_metrics` (unique por unidade+data).
- **Documentos/RH:** `occupational_documents`, `document_requests` (modos visualizar/ciência/enviar/assinar), `document_acknowledgements`, `document_access_logs`, `uniform_kits(+_items)`, `uniform_exchange_requests`.
- **Holerites:** `payslips`, `payslip_versions` (sha256, storage key), `payslip_signatures`, `payslip_disputes`, `payslip_settings`, `payslip_audit_events`.
- **Billing:** `subscriptions` (user_id único + company_id; price/product/period/cancel), `stripe_webhook_events` (event_id único).
- **LGPD/Aceite:** `acceptance_policies` (1 por empresa; `face_provider IN ('vision_api','selfie_evidence','externo')`, geofence 20–20000 m, método de assinatura), `privacy_policies` (controlador, DPO, bases legais, retenção).
- **Automação:** `automation_events` (event_id PK, status claimed/processed/failed, payload jsonb).

### 5.3 Functions, views, triggers (**FATOS**)

- **Sem views** (`types.ts` Views vazio). **Sem funções Edge versionadas** (`docs/MIGRATION.md`: não há `supabase/functions/` no Git).
- SQL expostas aos clientes: `apply_plan_entitlements(company, plan, source)`, `plan_feature_codes(plan)` (revoke de `anon/authenticated` onde aplicável). Helpers internos em `app_auth`: `current_company_id`, `has_role`, `is_company_admin`, `can_see_all_units`, `has_unit_access`, `in_company`, `can_manage_payroll`, `is_platform_admin`, `company_plan`, `has_valid_access`, `has_feature`.
- Triggers relevantes: `on_auth_user_created` (profiles), `set_updated_at_*` (lote), `sync_plan_entitlements` (companies), `prevent_client_billing_update` (companies), `enforce_single_unit_mode` (referenciada em migration de revoke).

### 5.4 RLS — padrão geral (**FATOS**)

- RLS habilitada em todas as tabelas de aplicação (confirme com `supabase/verify.sql`).
- Padrão: `in_company(company_id)` **e** `has_unit_access(unit_id)`; escrita adicional de `is_company_admin()`/`has_role()` em tabelas sensíveis (payslips: RH/admin; delete de draft só admin); `has_feature(company_id, 'feature')` em schedules/shifts/templates/inventory/sales (migration `20260901211729`).
- `portal_sessions` e `automation_events`: service_role only (deny explícito a clientes).
- **Storage (risco)** — policies versionadas são **por bucket** (`storage.objects ... USING bucket_id IN (...)`, migration `20260829134344`), sem predicado de pasta/empresa no Git. **HIPÓTESE**: políticas por pasta de empresa podem existir criadas fora do Git (o comentário da migration de buckets diz "company folder policies stay unchanged"). **NÃO VERIFICADO no Cloud** — verificar com a consulta de `pg_policies` de `supabase/verify.sql`.

### 5.5 Duplicidades e problemas de arquitetura (**FATOS** + análise)

1. `roles` (cargos de trabalho) vs `user_roles` (RBAC) — nomes colidentem conceitualmente.
2. Duas gerações de entregas: `employee_item_deliveries` (base) e `item_deliveries(+items/evidence/events)` (módulo novo com regras/evidência). Ambas ativas no código.
3. Duas gerações de fechamento de ponto: `point_cards` (+deliveries/events/evidence) e `timesheet_periods/entries/disputes/batches`.
4. `catalog_items` mistura itens de estoque e EPIs/uniformes (tamanhos/cores/reposição) — o "Estoque" planejado e o módulo de EPIs compartilham a mesma tabela.
5. `profiles.company_id` único ⇒ **um usuário pertence a uma empresa só** (compatível com "1 empresa" nos planos, mas trava multiempresa por usuário no futuro).
6. `employees.cpf` único **por empresa**, mas o login busca por CPF global (`src/lib/portal.functions.ts:14-18` com `maybeSingle()`) ⇒ colisão entre empresas quebra login (ver seção 6).

---

## 6. Diagnóstico da autenticação

**FATOS**

- **Admin (painel):** Supabase Auth e-mail/senha + Google OAuth direto (`supabase.auth.signInWithOAuth`); redirect `/auth`; guarda de rota client-side em `_authenticated/route.tsx` (`ssr:false` + `getUser()`; sem sessão → `/auth`), comprovado por teste E2E de redirecionamento.
- **Server functions:** middleware `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) valida Bearer JWT (formato + `getClaims`), cria cliente Supabase **com o JWT do usuário** ⇒ RLS por requisição. Service role (`client.server.ts` `supabaseAdmin`) usada apenas onde necessário: sessão do portal, webhook Stripe, billing, automações, ingestão de vendas.
- **Portal do Colaborador (auth separada, sem Supabase Auth):** login CPF+PIN (`portalLogin`): busca `employees` por CPF (global), verifica status, `hasCompanyAccess`, bloqueio por tentativas (5 tentativas → 10 min), PIN com **PBKDF2-SHA256 100k iterações** + salt (compatível com legado 120k), token opaco de 32 bytes com **hash SHA-256** em `portal_sessions` (expira 12h, revogável), erros genéricos (anti-enumerção), audit `portal_login`. Resolução de sessão server-only (`portal-session.server.ts`) + verificação de acesso da empresa a cada chamada.
- **Onboarding:** usuário autenticado sem `profiles.company_id` é levado a `/onboarding` (cria empresa+unidade via server function `bootstrap`); `companies_insert_authenticated` permite a qualquer autenticado criar empresa; `user_roles_bootstrap_owner` permite ao criador assumir `owner` (primeiro papel da empresa).

**FALHA DE SEGURANÇA IDENTIFICADA (ALTO) — proveniência de papel**

- **FATO:** `is_company_admin()` e `has_role(_user_id, role)` (`migration base` e espelho `app_auth`) testam apenas `user_id`+`role`, **sem filtrar `company_id` do papel**.
- **Consequência (hipótese verificada pela leitura das policies):** usuário com `profiles.company_id = A` e papel `admin` concedido na empresa B passa em `is_company_admin()` e, como `in_company(A)` é verdadeiro, **administra a empresa A** (units, user_roles, employees, policies…). O gate `user_roles_admin_manage` impede escrever a linha de papel da empresa B sem pertencer a B, mas não impede o papel de B **vazar autoridade** para A.
- **RECOMENDAÇÃO (para o plano, não executar agora):** migration aditiva que mude os helpers para `WHERE user_id = auth.uid() AND company_id = <empresa> AND role IN (...)`, com testes negativos E2E.

**Outros pontos de autenticação**

- **FATO:** `platform_admins` (dono do SaaS) bypassa features/assinatura (`is_platform_admin` em `has_valid_access`/`has_feature` e no UI).
- **FATO:** campos de billing de `companies` são imutáveis pelo cliente (trigger), evitando auto-concessão.
- **HIPÓTESE (não verificada):** revogação de papel em sessão já aberta: o middleware recria o cliente por requisição e a RLS é reavaliada a cada consulta ⇒ mudanças de papel valem na próxima requisição; caches de `["workspace"]` no cliente podem exibir UI desatualizada até invalidar.

---

## 7. Diagnóstico das permissões e isolamento

**FATOS**

- Modelo: **empresa (tenant) → unidade → papel RBAC + acesso por unidade (`user_units`) → direito por funcionalidade (`feature_entitlements`) → assinatura (`companies.access_source/subscription_status`) + trial (`trial_ends_at`) + concessão admin.**
- Perfis do enum: `owner`, `admin`, `unit_manager`, `hr`, `stock_manager`, `supervisor`, `staff` — mais granulares que os 4 perfis de referência da arquitetura; **não há permissões por produto** (o que será necessário).
- RLS: todas as tabelas de cliente têm `company_id`; operacionais têm também `unit_id`; policies `USING/WITH CHECK` espelham leitura e escrita; helpers em schema privado `app_auth` (não exposto na Data API).
- UI oculta recursos por feature (`app-shell`, `feature-blocked`, `ROUTE_FEATURES`), mas **a autorização real no banco por feature só existe em 5 tabelas** (ver 5.3/12.2).
- Auditoria: `audit_logs` (insert por membros, leitura só admin), `payslip_audit_events`, `document_access_logs`, eventos do portal.
- LGPD: `privacy_policies`, `acceptance_policies`, consentimento em portal (componente `lgpd-consent.tsx`), página `/app/settings/lgpd`.

**Avaliação de compatibilidade com o modelo multiempresa/multiunidade planejado**

- **Compatível:** empresa/unidade/usuário/colaborador/papel já modelados; escopo em quase todas as tabelas; RLS consistente; auditoria existente.
- **Lacunas (FATOS/HIPÓTESES):** (1) falha de proveniência de papel (seção 6); (2) `has_unit_access(NULL)` retorna `true` — tabelas com `unit_id` anulável permitem linhas "de toda a empresa" visíveis a todos da empresa (aceitável, mas enfraquece isolamento por unidade); (3) não há vínculo usuário↔várias empresas; (4) unidades consultadas no cliente sem filtro explícito de empresa (dependem de RLS — correto, porém sensível a regressão de policy); (5) permissões por produto inexistentes.

---

## 8. Diagnóstico do Stripe

**FATOS**

- **Catálogo:** `src/config/billing.ts` — apenas `comeco` tem `productId`/`priceId` (mensal `price_1UAeTjRzTbFSBgbDKHq91ZYH`, anual `price_1UAeTjRzTbFSBgbD2ASyogbe`, `prod_VB0UQimCMeINc7`); `essencial`/`equipe` **sem Price ID** ⇒ `priceForPlan` lança "Este plano ainda não está disponível para contratação." (`docs/STRIPE.md` confirma o desenho; `roadmap.md` pede ligar os CTAs).
- **Checkout:** `createCheckoutSession` (`billing.functions.ts`) — exige empresa; bloqueia nova assinatura se já existir `active/trialing/past_due/unpaid`; metadata `{supabase_user_id, company_id, plan_key, billing_interval}` + `client_reference_id`; reusa `stripe_customer_id`; success `/app?checkout=success…`, cancel `/#planos`. **Customer Portal** disponível via `createCustomerPortalSession` (requer configuração no Dashboard).
- **Webhook** `POST /api/public/stripe-webhook` (`src/routes/api/public/stripe-webhook.ts`): verifica assinatura com `STRIPE_WEBHOOK_SECRET`; trata `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`; `syncSubscription` faz upsert em `subscriptions` (conflict `user_id`) e atualiza `companies` (`access_source='subscription'`, `subscription_status`, `plan_code`/`billing_cycle` somente se o preço for conhecido — senão `incomplete`); **idempotência**: registra `stripe_webhook_events` **após** processar; duplicata detectada por `event_id` único (23505) e Stripe reenvia em falha (retorno 500). Roadmap "webhook idempotente" está, na prática, implementado.
- **Liberação de acesso:** `companies.access_source` + `subscription_status`; gate em RLS `app_auth.has_valid_access` (apenas `active`/`trialing` pagos; trial com prazo; `admin_grant`); UI `FeatureBlocked` quando sem acesso; trigger impede cliente alterar billing. `docs/STRIPE.md`: "O retorno do Checkout não libera acesso."
- **Limites de plano** (colaboradores, unidades, admins): documentados em `src/config/plans.ts` e auditados no admin (`app.admin.piloto.tsx`, `docs` de piloto); **HIPÓTESE**: enforce no servidor nos módulos de pilot/policies (não auditado linha a linha nesta passada).
- **NÃO VERIFICADO:** preços/portais ativos no Dashboard Stripe; qual chave (live/test) em produção (git log menciona "key Stripe live").

**Caminho para produtos individuais e pacotes (FATOS estruturais)**

- `feature_entitlements` já é por empresa, por `feature_code`, com `source` (`plan`/`admin_grant`) e `enabled` — **extensão natural** para "produto": introduzir `products` + mapear `feature_code`→produto + aplicar `has_feature` em RLS nos domínios + checkout por produto/preço.
- Hoje **1 assinatura por empresa** (`plan_code` único) — contratação combinada exigirá múltiplas assinaturas/itens (Stripe: `subscription items` por produto) e `syncSubscription` deixará de ser single-price.

---

## 9. Diagnóstico dos seis produtos

Classificação do que **existe no código hoje** (evidências de rotas + tabelas + server functions):

| Produto | Estado | Evidências | Lacunas p/ produto autônomo |
| --- | --- | --- | --- |
| **Ponto** | **Existente e maduro** | Rotas `/app/time-entries`, `/app/point-cards(+id)`, `/app/shifts`, `/app/schedules`, `/app/schedule-*` (templates/compliance/history), settings/jornada; portal `/portal/ponto`, `/portal/escala`, `/portal/cartao-ponto(+id)`, pendencias; tabelas de escala+ponto+timesheet; server fns `timesheet.*`, `fixed-schedule.*`, `portal-timesheet.*`; geolocalização (`point_policies`, `geo_status`), revisões e disputas; feature `time_entries/point_cards/schedules_advanced…` | Fechamento/assinatura do cartão depende de Documentos/Holerites para ciência formal; nenhuma dependência de estoque/vendas |
| **Estoque** | **Existente (funcional)** | `/app/inventory`, `/app/items`; `catalog_items`, `inventory_items`, `stock_movements` (com before/after e transferência entre unidades), `inventory_counts(+items)`, `stock_alerts`; server fns `inventory.*`; features `items/inventory` | Alertas sem canal de entrega automático (tabela existe, entrega por e-mail/WhatsApp **não implementada** — `notifications` sem sender); inventário sem app de contagem mobile |
| **Compras** | **Não existe** | Apenas `suppliers` (apoio) e `delivery_rules` (regras de EPI, não compras) | Tudo: solicitações, aprovação, pedidos, recebimento/conciliação |
| **Caixa** | **Não existe** | Nenhuma rota/tabela | Tudo: abertura/fechamento, sangrias, conferência |
| **Financeiro** | **Não existe** | `sales_daily_metrics` é analítico de vendas, não lançamento financeiro | Tudo: contas a pagar/receber, categorias, fluxo |
| **Documentos** | **Existente e maduro (escopo RH/ocupacional)** | `/app/conformidade/*` (exames, kits, pendências, trocas), `/app/documentos/holerites(+id)`; `/app/settings/lgpd|aceite`; portal `/portal/documentos(+id)`, `/portal/holerites(+id/comprovante)`, perfil/pendencias; tabelas `occupational_documents`, `document_requests/acknowledgements/access_logs`, `payslips*`, `uniform_*`; server fns `payslips.*`, `portal-payslips.*`, `portal-compliance.*`, `policies.*` | Documentos **empresariais genéricos** (contratos, alvarás) e alertas de vencimento por e-mail não existem; biometria/facial requer revisão LGPD própria (já sinalizada na arquitetura) |

**Módulos fora dos seis produtos (decisão pendente — seção 15):** EPIs/entregas (usa `catalog_items`+`item_deliveries`), Vendas (`/app/sales`, ingestão API), Conformidade/exames, Uniformes, Admin piloto, LGPD settings, Portal do Colaborador (transversal, sobretudo do Ponto).

**O que pode ser reaproveitado sem reescrita (FATOS):** todo o núcleo (auth, workspace, RLS helpers, entitlements, audit, notificações, storage, design system, portal), mais os três domínios maduros acima. **Funcionalidades que dependem de outros módulos:** portal de holerites/documentos depende do cadastro de `employees` (núcleo); entregas de EPI dependem de `catalog_items` (Estoque) e `employees`; escalas fixas (`fixed_work_schedules`) alimentam o portal; automações consomem eventos de Ponto/Documentos/EPIs.

---

## 10. Diagnóstico das automações, notificações e integrações

**FATOS**

- **Motor de eventos:** `automation_events` (ledger server-only, idempotente por `event_id`, status claimed/processed/failed) + API `/api/automation/*` protegida por `Bearer MYFOODS_AUTOMATION_TOKEN` (comparação timing-safe), projetada **para n8n orquestrar chamadas autenticadas e idempotentes** (comentário da migration): claim de eventos (`events.claim`), candidatos por domínio (`clock|documents|epis.candidates`), processamento por domínio (`events.clock/documents/epis` com validação de prefixo `clock.`/`document.`/`epi.`), `dispatch` de notificações (valida tenant/employee, dedupe por `dedupe_key`), `manager-summary`.
- **Notificações:** tabela `notifications` (canal whatsapp/email/link, status, tentativas, `idempotency_key` único) + normalização em `notifications.shared.ts` (mapeia eventos legados → notificações estruturadas com prioridade/action_url) exibidas no portal. **FATO:** **não há remetente implementado** (e-mail/WhatsApp) — a fila existe, o envio não.
- **Mascote/assistente:** **FATO** — bloco "Assistente MyFoods" em `/portal` (`portal.index.tsx:180-215`): cartão de "Recados do MyFoods" com ícone personificado (olhinhos) que lista lembretes/notificações; comunicação baseada em eventos, **sem IA generativa** (alinhado à diretriz da arquitetura, que manda preservá-lo).
- **Visão facial:** `face-validation.server.ts` + `acceptance_policies` (`vision_api`/`selfie_evidence`/`externo`) contra API compatível chat/completions (`FACE_VISION_*`); testes E2E usam respostas simuladas; equivalência com o provedor escolhido precisa validação (README).
- **Geocodificação:** `geo-validation.server.ts` — Nominatim ou endpoint próprio (`acceptance_policies.geocoding_*`).
- **Vendas:** ingestão pública `POST /api/public/sales-ingest` autenticada por `x-connection-id` + segredo por conexão (`sales_connections.config.secret`, comparação direta — **RECOMENDAÇÃO futura**: comparar com timing-safe), upsert idempotente em `sales_daily_metrics` (unique unidade+data), registro em `sales_import_jobs`.
- **Cron:** helper `cron-auth.ts` (`CRON_SECRET`/`CRON_SECRET_PREVIOUS`) presente, sem scheduler obrigatório.
- **n8n:** apenas como orquestrador externo pretendido (migration). **Firebase: não existe** nenhuma referência no código.
- **Storage:** 5 buckets privados com limites (5 MB fotos, 3 MB avatares, 2 MB assinaturas, 10 MB documentos, 20 MB holerites) — assinaturas de URL via `use-signed-url`.

**Oportunidades de reaproveitamento:** ledger de automações já serve como barramento entre produtos (ex.: Estoque abaixo do mínimo → candidato de compra); `notifications` + dispatch já dão destinatário/contexto/prioridade; o mascote pode exibir recados de qualquer produto sem IA.

---

## 11. Mapa de funcionalidades existentes

| Área | Rota(s) | Backend | Estado |
| --- | --- | --- | --- |
| Landing + planos | `/` | `pricing-section` → checkout (parcial) | **FATO:** CTAs Essencial/Equipe indisponíveis (sem Price ID) |
| Login admin | `/auth` | Supabase Auth + Google | Funcional (E2E) |
| Onboarding | `/onboarding` | `pilot.functions` bootstrap | Funcional (corrigido no git log) |
| Dashboard | `/app` | queries diretas + RLS | Funcional |
| Colaboradores/cargos/equipes | `/app/employees`, `/app/roles-teams`, `/app/units` | CRUD + RLS | Funcional |
| Escalas/turnos | `/app/shifts|schedules|schedule-templates|schedule-compliance|schedule-history` | `timesheet.*`, `fixed-schedule.*` + RLS com feature | Funcional (feature `schedules_advanced` no plano) |
| Ponto | `/app/time-entries`, portal `/portal/ponto` | `time_entries`, reviews, geo | Funcional (geolocalização+revisão) |
| Cartão-ponto/timesheet | `/app/point-cards(+id)`, portal cartão-ponto | `point_cards`, `timesheet_*`, entregas | Funcional (duas gerações convivendo) |
| Itens/EPIs | `/app/items`, `/app/deliveries(+id)`, `/app/delivery-rules`, portal itens | `item_deliveries*`, `catalog_items` | Funcional (aceite, evidência, recusa) |
| Estoque | `/app/inventory` | `inventory_*`, `stock_movements/alerts` | Funcional |
| Vendas | `/app/sales` + ingest API | `sales_*` | Funcional (ingestão; conexões por UI parcial) |
| Conformidade/Documentos RH | `/app/conformidade/*`, `/app/documentos/holerites*` | `payslips.*`, `portal-compliance.*` | Funcional (assinatura facial/evidência, disputas) |
| LGPD/Aceite/Jornada | `/app/settings/*` | `policies.*`, `acceptance/privacy_policies` | Funcional |
| Admin plataforma | `/app/admin/piloto` | `pilot.*` (grant de acesso, PIN, cartões) | Funcional (restrita a `platform_admins`) |
| Billing | landing + `/app?checkout=success` | `billing.functions`, webhook | Parcial (só Começo compra) |
| Portal do colaborador | `/portal/*` | `portal.*` (~20 server fns), sessão CPF/PIN | Funcional |
| Automações | `/api/automation/*` | ledger + n8n pretendido | Operacional p/时钟/documentos/epis; envio não implementado |
| Executive / pacotes / produtos | — | — | **Inexistente** |

**NÃO VERIFICADO nesta auditoria (exige Cloud/Stripe):** políticas de storage por pasta; funções SQL fora do Git; preços/portais Stripe ativos; limite de admins enforce completo por plano; estado exato das alterações não commitadas vs produção.

---

## 12. Riscos identificados (classificação)

**ALTO**

1. **Proveniência de papel跨-empresa** (seção 6) — escalonamento de autoridade entre tenants; migration pequena + testes negativos resolvem.
2. **RLS sem `has_feature` na maioria dos domínios** — hoje o risco é limitado (features só vendidas em pacote), mas **torna-se bloqueante** para produtos individuais (cancelar um produto precisa negar acesso no banco, não só no menu).
3. **Storage sem isolamento por pasta versionado** — potencial leitura/escrita entre empresas em `documents`/`payslips` se as policies de pasta não existirem no Cloud; verificar antes de qualquer cutover de Documentos.
4. **Modularização pode quebrar fluxos que assumem shell único**: `ROUTE_FEATURES` trata rota mapeante como liberada; `use-workspace` consulta `units` sem filtro; páginas acopladas ao NAV único do `app-shell`.

**MÉDIO**

5. Monetização: só Começo comprável; webhook não suporta múltiplos itens/produtos; portal do cliente não exposto na UI.
6. Duplicidades (entregas ×2, ponto ×2, `roles` vs `user_roles`) — risco de divergência de dados durante a separação dos produtos.
7. Portal: colisão de CPF entre empresas quebra login; token do portal em localStorage (mitigado por hash server-side e expiração curta).
8. `unit_id` anulável + `has_unit_access(NULL)=true` — linhas "globais da empresa" acessíveis a todos os papéis da empresa.
9. Toolchain beta (Vite 8/Nitro beta/rolldown override) — fragilidade de build/upgrade.
10. Working tree com mudanças não commitadas incluindo billing/brand e `.env` removido — risco de desalinhamento entre código, produção e próximas migrations.

**BAIXO**

11. Webhook registra evento após processar (janela de corrida mínima; mitigada por upsert idempotente).
12. Falta `MYFOODS_AUTOMATION_TOKEN` no `.env.example` (falha fechada, mas onboarding de ops confuso).
13. Segmento `secrets` de `sales_connections` comparado sem timing-safe.
14. Mensagens de erro/í18n e acessibilidade já bons; sem riscos relevantes.

---

## 13. Arquitetura recomendada (menor transformação)

Baseada **exclusivamente** no que foi encontrado (diretriz da seção 5.3 da arquitetura: um app modular, um banco; sem reconstrução):

1. **Núcleo (Core) — já existe em 90%:** auth, empresas, unidades, papéis, colaboradores, audit, notificações, brand, entitlements. Ação: apenas **corrigir proveniência de papéis** e documentar `app_auth` como contrato do Core.
2. **Catálogo de produtos:** tabela `products` (código, nome, ícone) + mapeamento `feature_code → product` (ou coluna `product_code` em `feature_entitlements`). `apply_plan_entitlements` passa a receber conjunto de produtos; `has_feature` permanece a primitiva de RLS (nenhuma policy muda de forma).
3. **Portal central:** nova rota leve `/hub` pós-login listando produtos derivados dos entitlements ativos + estado da assinatura; `/app` permanece como produto inicial (Ponto+extras) — sem reescrita de shell; cada produto futuro ganha prefixo próprio (`/estoque`, `/compras`…) reaproveitando `AppShell` parametrizado.
4. **Contratação individual/pacotes:** migrar de "1 assinatura por empresa" para **`subscriptions` + `subscription_items` (product_code, price_id, status)**; webhook passa a sincronizar por item; `companies.plan_code` vira derivado/somente leitura de compatibilidade durante a transição; pacote = preço que concede N produtos via mesmo mecanismo de entitlements.
5. **RLS por produto:** aplicar `has_feature` nas policies dos domínios que ainda não têm (ponto, itens, entregas, holerites, documentos) — migrations aditivas, uma por domínio, com testes negativos.
6. **Compras/Caixa/Financeiro:** novos domínios com tabelas próprias (`company_id`/`unit_id` obrigatórios), server functions e rotas prefixadas; integração Estoque↔Compras via ledger de automações já existente.
7. **Documentos:** reusar o módulo de holerites/documentos ocupacionais como base do produto (adicionando categorias empresariais e alertas de vencimento via automações).
8. **Segurança prévia obrigatória:** verificar/verter policies de storage por pasta para migrations; timing-safe no sales-ingest; CPF do portal com resolução multi-empresa.

**O que NÃO fazer (RECOMENDAÇÃO):** não separar em 6 apps/bancos; não reescrever autenticação; não tocar nas 23 migrations aplicadas (sempre forward-only); não remover módulos "extra" (EPIs/Vendas/Conformidade) sem decisão de destino.

---

## 14. Plano preliminar de transformação (ordem sugerida, pós-aprovação)

| Etapa | Conteúdo | Risco |
| --- | --- | --- |
| 0 | Reconciliar working tree (commit/stash), congelar baseline, backup do Supabase | — |
| 1 | Fix de segurança: proveniência de papéis + testes negativos E2E | Baixo |
| 2 | Verificação no Cloud: storage por pasta, funções fora do Git, planos Stripe reais | — |
| 3 | Catálogo de produtos + `product_code` nos entitlements (migration aditiva + backfill) | Baixo |
| 4 | RLS com `has_feature` nos domínios restantes (um PR por domínio) | Médio |
| 5 | Hub central `/hub` + navegação por produto (UI pequena, sem reescrita) | Baixo |
| 6 | Billing multi-produto (subscription items, webhook por item, portal) + Price IDs Essencial/Equipe | Médio |
| 7 | Produtos novos na ordem Compras → Caixa → Financeiro (cada um com spec própria) | Médio |
| 8 | Automações entre produtos (estoque→compras; documentos→alertas) + remetente de notificações | Médio |

Cada etapa: migration forward-only + plano de rollback + testes (`npm run typecheck`, `build`, `test:e2e`/`test:migration`) — conforme regras 8–17 de `MYFOODS_ARCHITECTURE.md`.

---

## 15. Dúvidas que precisam de decisão humana

1. **Destino dos módulos fora dos seis produtos:** EPIs/entregas e Uniformes entram em Estoque, em Documentos/RH, ou viram produto próprio? Vendas entra no Financeiro ou permanece módulo?
2. **Portal do Colaborador:** produto transversal (Core) ou parte do MyFoods Ponto? Pode ser contratado separadamente?
3. **Mapeamento dos planos atuais (Começo/Essencial/Equipe) para produtos individuais:** mantém os 3 pacotes como "bundles" e adiciona compra avulsa? Quais preços (a arquitetura proíbe inventar valores)?
4. **Usuários multiempresa:** manter 1 empresa por usuário (planos atuais dizem "1 empresa") ou habilitar multi-vínculo agora?
5. **Papéis:** manter o enum atual de 7 papéis + `user_units` ou migrar para permissões granulares por produto/ação/unidade (arquitetura pede granularidade)?
6. **Storage:** confirmar se as policies por pasta existem no Cloud e devem ser versionadas em migration antes de qualquer mudança.
7. **Stripe:** qual ambiente (live/test) é a verdade atual? Criar novos produtos/preços na mesma conta?
8. **Working tree não commitada (billing/brand, `.env` removido):** qual o estado canônico a adotar como baseline da transformação?
9. **Biometria/facial:** permanece no escopo do produto Documentos/Ponto? Requer revisão LGPD específica antes de qualquer mudança (diretriz da arquitetura).
10. **Executor de automações:** n8n será realmente adotado (requer provisionar `MYFOODS_AUTOMATION_TOKEN`) ou o motor roda só com cron interno (`CRON_SECRET`)?

---

*Fim do relatório. Nenhuma alteração foi aplicada ao projeto; aguardando aprovação humana para o plano (Etapa 1 de `MYFOODS_ARCHITECTURE.md`).*
