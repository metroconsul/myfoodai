# GRUPO MYFOODS — PLANO TÉCNICO DE TRANSFORMAÇÃO

**Data:** 2026-10-20 · **Natureza:** documento de planejamento (Etapa 1 de `MYFOODS_ARCHITECTURE.md`). **Nenhum arquivo, migration, policy, configuração ou dependência foi alterado.**
**Entradas:** `docs/MYFOODS_ARCHITECTURE.md` (diretriz aprovada), `docs/AUDITORIA_TECNICA_MYFOODS.md`, código-fonte e migrations reconfirmados nesta passada.

**Convenção:** **CONFIRMADO** (verificado no código/migrations/Git desta sessão) · **HIPÓTESE** (interpretação a validar) · **RECOMENDAÇÃO** (proposta técnica) · **PENDENTE** (depende de acesso ao Cloud/Stripe ou decisão humana).

---

## 1. Resumo executivo

O MyFoods é uma aplicação única e funcional (TanStack Start/Node, React 19, Supabase com RLS, Stripe) com três domínios maduros — **Ponto**, **Estoque** e **Documentos** — e infraestrutura de núcleo (empresas, unidades, papéis, entitlements, auditoria, automações, portal do colaborador) que já sustenta o modelo de plataforma desejado. **RECOMENDAÇÃO central: evoluir, não reconstruir** — um app, um banco, separação lógica por produto, exatamente como a diretriz da seção 5.3 da arquitetura.

O plano organiza a transformação em **14 fases**, priorizando: (1) reconciliação do working tree (toda a saída do Lovable está não commitada); (2) correção da proveniência de papéis em RLS (falha de segurança real, CONFIRMADA); (3) verificação e versionamento das policies de Storage; (4) política de feature/entitlement consistente em três camadas (RLS, server functions, UI) **sem** feature-gate de tabelas do Core; (5) catálogo de produtos reutilizando `feature_entitlements`; (6) hub central leve; (7) billing multi-produto; (8–10) adaptação de Ponto/Estoque/Documentos; (11–13) Compras, Caixa e Financeiro do zero; (14) validação integrada.

## 2. Estado atual confirmado

### 2.1 Stack e estrutura (CONFIRMADO)

- React ^19.2, TypeScript 5.8 strict, Vite 8.1.5 + Nitro beta, TanStack Start ^1.168.60, Tailwind 4, Supabase JS ^2.112.4, Stripe ^22.4.0, Node ≥ 22.12 (`package.json`, `.nvmrc`).
- 52 rotas de UI + 2 rotas HTTP públicas + 9 endpoints de automação (`src/routes/`); ~80 `createServerFn` em 14 módulos de `src/lib/`.
- 23 migrations SQL (2.384 linhas), forward-only, 2026-08-29 → 2026-09-30; schema privado `app_auth` com helpers de RLS; 60+ tabelas de aplicação; 5 buckets privados.

### 2.2 Git e working tree (CONFIRMADO — crítico para o planejamento)

- `HEAD` = `50fe106 "Add project README"` e ainda contém o **código da era Lovable**: `git show HEAD:src/config/billing.ts` revela `STRIPE_PUBLISHABLE_KEY = "pk_live_51UAcLk…"` hardcoded e `ALLOWED_PRICE_IDS`; `src/integrations/lovable/`, `bun.lock`, `.lovable/` existem no HEAD.
- O **working tree não commitado é, na prática, a migração completa para runtime independente**: ~59 arquivos modificados + 24 não versionados, incluindo `src/lib/stripe.server.ts`, `src/lib/automation.server.ts`, `src/routes/api/automation/`, as migrations `20260905*` e `20260930*`, `docs/`, `scripts/`, `vercel.json`. Diff total: +1.297/−3.436 linhas.
- **RECOMENDAÇÃO (Fase 0):** consolidar esse estado como commit baseline (revisado, sem segredos — o `.env` deletado do tree não deve ser re-adicionado) antes de qualquer fase seguinte. Preservar integralmente, conforme instruído.

### 2.3 Descobertas desta passada que corrigem/afinam a auditoria (CONFIRMADO)

1. **`requireFeature` já existe no servidor** (`src/lib/plan.server.ts:40-63`) e valida `feature_entitlements` — mas só é chamado em `src/lib/fixed-schedule.functions.ts` (2 usos). A camada server de features está quase vazia.
2. **CTAs de pricing já estão ligados ao checkout** no working tree (`src/components/pricing-section.tsx:63,142` → `createCheckoutSession`; `src/lib/pending-checkout.ts` retoma checkout pós-login/OAuth). O item correspondente do `roadmap.md` está, na prática, resolvido — o roadmap está desatualizado.
3. **Limites de plano não são enforceados**: o commit `133660a "Corrigiu limite de admin no plano"` alterou **apenas textos** de `src/config/plans.ts` ("Ilimitado/Até 3/Até 5"). Não há verificação de limites de colaboradores/unidades/admins em `admin.functions.ts`, `pilot.functions.ts` nem em policies de `user_roles`/`units`/`employees` (busca por limites em `src/lib` sem resultados). Limites são hoje declarativos.
4. **`employee_item_deliveries` tem zero referências no código** (aparece só em `src/integrations/supabase/types.ts`) — módulo legado morto em código; pode ter dados no Cloud (PENDENTE verificar).
5. **Caminhos de Storage usam prefixo de empresa por convenção**: `payslips` → `${companyId}/${payslipId}/v${version}.${ext}` (`src/lib/payslips.server.ts:39-41`); `signatures` → `${delivery.company_id}/entregas/${delivery.id}/selfie.jpg` (`src/lib/portal-items.functions.ts:151`); `documents` → `${company.id}/documentos/${employeeId}/${uuid}.${ext}` (`src/routes/_authenticated/app.conformidade.exames.novo.tsx:99`); assinatura de holerite → `${payslip.company_id}/${payslip.id}/assinatura-v${v}.png` (`src/lib/portal-payslips.functions.ts:275`). As **policies versionadas são apenas por bucket** (`20260829134344`).
6. **`suppliers` também tem zero referências no código** (só `types.ts`) — tabela modelada, sem UI; será a base de MyFoods Compras.
7. **Timesheet e point-cards são um sistema só**: `timesheet_entries` é consultado por `card_id` dentro do fluxo de cartões (`src/lib/timesheet.server.ts:184`); as rotas de portal e app de cartão-ponto usam `timesheet.functions`/`portal-timesheet.functions`. A divisão é: `point_cards` = competência/fechamento/entrega; `timesheet_*` = lançamentos, disputas, lotes por cartão.
8. `enforce_single_unit_mode` (trigger `BEFORE INSERT ON units`, `20260901210619:115-133`) reforça o limite de 1 unidade por plano quando `single_unit_mode` — **único limite de plano enforceado no banco** (CONFIRMADO).

## 3. Arquitetura atual e arquitetura desejada

### 3.1 Atual (CONFIRMADO)

```
App único /app (shell + NAV único)  ── sessão Supabase Auth (admin)
Portal /portal (mobile-first)       ── sessão CPF+PIN (colaborador)
Banco único: Core (companies, units, profiles, user_roles, user_units,
employees, audit_logs, notifications, feature_entitlements…) + domínios
(ponto, estoque, entregas/EPIs, documentos/holerites, vendas, billing, automações)
RLS: empresa+unidade em tudo; feature apenas em 5 tabelas; assinatura via
app_auth.has_valid_access(); billing protegido por trigger.
```

### 3.2 Desejada (RECOMENDAÇÃO — menor transformação)

```
CORE (núcleo compartilhado, sem feature-gate):
  auth (Supabase + portal CPF/PIN) · companies · units · profiles · user_roles
  · user_units · employees · roles(cargos) · teams · work_regimes · audit_logs
  · notifications · branding · products (novo) · company_products (novo)
  · feature_entitlements (adaptado) · subscriptions/subscription_items (adaptado)
PRODUTOS (prefixo de rota + módulos lib + tabelas do domínio):
  Ponto        /app (atual)         time/schedule/timesheet/point_card_*
  Estoque      /estoque             inventory_* · stock_* · catalog_items*
  Documentos   /documentos          occupational_documents · document_* · payslip_* · uniform_*
  Compras      /compras             purchase_* (novo) + suppliers (reuso)
  Caixa        /caixa               cash_* (novo)
  Financeiro   /financeiro          finance_* (novo)
  Executive    /executive (futuro)  leitura/agregação
Extras (decisão na seção 12): entregas/EPIs, vendas, conformidade, uniformes
HUB: /hub — catálogo derivado de entitlements, sessão única, sem re-login
```

Princípios: produto = **prefixo de rota + módulos + tabelas + feature codes + preço**; autorização idêntica em 3 camadas (RLS → server function → UI), com RLS como última linha de defesa; integrações entre produtos por **eventos** (`automation_events`) e por FK explícita com origem rastreada, nunca por dependência de contratação.

## 4. Problemas e causas técnicas

### 4.1 P1 — Proveniência de papel entre empresas (PRIORIDADE MÁXIMA)

**Causa técnica (CONFIRMADO).** Os helpers testam só `user_id`+`role`, sem `company_id` do papel:

- `public.has_role(_user_id, _role)` — migration base `20260829134240:85-88`.
- `public.is_company_admin()` — `20260829134240:95-101` (`role IN ('owner','admin')`, sem empresa).
- `public.can_see_all_units()` — `20260829134240:103-109` (mesmo defeito).
- Espelhos idênticos em `app_auth` (migration `20260831211015`): `app_auth.has_role`, `app_auth.is_company_admin`, `app_auth.can_see_all_units`, `app_auth.can_manage_payroll` (este adiciona `hr`).

**Exploração (CONFIRMADO por leitura das policies).** `profiles.company_id` define a empresa do usuário; `in_company(X)` só exige `X = profiles.company_id`. Um usuário com `profiles.company_id = A` e uma linha `user_roles(role='admin', company_id=B)` passa em `is_company_admin()` e obtém poderes de admin **na empresa A** (papéis concedidos em B vazam para A). Agravante específico: **`user_units_admin_manage`** (`20260829134240:717-718`) usa apenas `is_company_admin()` sem predicado de empresa, e `user_units` não tem `company_id` — um admin (mesmo de empresa errada) pode **escrever vínculos usuário↔unidade de qualquer tenant**; `user_units_select` (`:715-716`) permite leitura cruzada por qualquer admin.

**Policies afetadas** (usam os helpers defeituosos): `profiles_admin_manage`, `user_roles_admin_manage` (mitigada parcialmente por `in_company(company_id)` da própria linha), `user_units_admin_manage`/`user_units_select` (não mitigadas), `audit_select`, `units_admin_manage`, `acceptance_policies_admin_write`, `privacy_policies` (equivalente), `payslips_write_hr`/`payslips_update_hr`/`payslips_delete_admin` (via `has_role('hr')`/`is_company_admin`), policies de holerites/documentos com `app_auth.can_manage_payroll`.

**Estratégia de correção (RECOMENDAÇÃO — migration aditiva única).**

1. Criar em `app_auth`: `has_role_in(_company_id uuid, _role app_role)` → `EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.company_id = _company_id AND r.role = _role)`; `is_company_admin_in(_company_id)`; `can_see_all_units_in(_company_id)`; `can_manage_payroll_in(_company_id)`.
2. Reescrever (DROP+CREATE) as policies listadas para usar as variantes `_in` com o `company_id` da linha (padrão já usado por `20260901211729`).
3. `user_units`: trocar para `EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id AND app_auth.in_company(u.company_id)) AND app_auth.is_company_admin_in((SELECT company_id FROM units WHERE id = unit_id))`.
4. Manter os helpers antigos como wrappers deprecated (chamando os novos com `current_company_id()`) para compatibilidade durante a transição; remover em fase posterior.

**Impactos.** Nenhum para o fluxo legítimo atual (1 empresa por usuário). Fecha o vazamento entre tenants. Risco baixo: migration aditiva + reescrita de policies com plano de rollback.

**Testes obrigatórios** (ver seção 13): admin de B não lê/escreve `profiles`, `user_units`, `audit_logs`, `units`, `user_roles`, `payslips` de A; admin de B **não** ganha poderes em A; owner de A gerencia tudo em A; usuário sem papel não admin em nenhuma.

**Rollback.** As policies antigas estão versionadas no Git (`20260829134240`, `20260831211015`); rollback = recriar policies originais + `DROP FUNCTION` das novas. Como é ganho de segurança, o rollback só seria para depuração.

### 4.2 P2 — Controle por produto nas RLS (detalhado na seção 5, matriz)

**CONFIRMADO.** Três camadas desalinhadas: RLS com `has_feature` só em `schedules`, `shifts`, `schedule_templates`, `inventory_items`, `sales_orders` (`20260901211729`); server com `requireFeature` só em `fixed-schedule.functions.ts`; UI com `ROUTE_FEATURES` (`src/config/features.ts:91-104`, 12 prefixos) + `AppShell`/`FeatureBlocked`. **Causa:** as features nasceram como diferenciação de *planos* (bundle único), não como direitos de *produtos* independentes.

### 4.3 P3 — Storage (CONFIRMADO/PENDENTE; plano na seção 7)

Policies no Git são por `bucket_id` apenas (`20260829134344`), enquanto os caminhos já carregam o prefixo da empresa (2.3.5). Isolamento efetivo depende de policies por pasta existentes só no Cloud — **PENDENTE** de inspeção (`supabase/verify.sql` já prevê essa consulta em `pg_policies` de `storage`).

### 4.4 P4 — Duplicidades e inconsistências

| Caso | Evidência (CONFIRMADO) | Diagnóstico | Canônico (RECOMENDAÇÃO) |
| --- | --- | --- | --- |
| `employee_item_deliveries` × `item_deliveries` | 0 × 21 referências no código; `item_deliveries(+_items/_evidence/_events)` tem regras (`delivery_rules`), evidência, eventos e portal | Duplicidade **funcionalmente resolvida** em código; legado só no schema/dados | `item_deliveries` family. `employee_item_deliveries`: arquivar (sem DROP por ora); PENDENTE checar dados no Cloud; migração de histórico só se houver dados e decisão |
| `point_cards` × `timesheet_*` | 29 × 19 refs; `timesheet_entries` liga por `card_id` (`timesheet.server.ts:184`); cartões usam `point_card_events/evidence` e timesheet usa `timesheet_disputes/batches` | **Não é duplicidade**: subsistemas complementares do mesmo produto (fechamento vs lançamentos) | Ambos canônicos com papéis distintos; documentar fronteira; unificar *futuramente* nomes/serviços em um módulo só do Ponto. Sem migração |
| `roles` × `user_roles` | 5 × 5 refs; `roles` = cargos (UI `app.roles-teams.tsx`), `user_roles` = RBAC | Confusão de **nomenclatura**, não funcional | Manter; renomear `roles`→`job_roles` apenas se houver janela de manutenção (baixa prioridade, custo alto de churn) |
| Login por CPF em 2 empresas | `portalLogin` faz `.eq("cpf", cpf).maybeSingle()` global (`src/lib/portal.functions.ts:14-18`); `employees` tem `UNIQUE(company_id, cpf)` | Colisão entre empresas → erro PGRST116 → "Não foi possível conectar" | Ver plano abaixo |

**Plano para o login por CPF (RECOMENDAÇÃO).** (1) Buscar `SELECT ... WHERE cpf = X ORDER BY company_id LIMIT 2`; (2) se 0 → erro genérico; se 1 → fluxo atual; se ≥2 → responder com lista **mínima** (`company_id`, `company_name` da unidade vinculada) e exigir seleção de empresa antes do PIN; (3) validar PIN **da empresa escolhida**, mantendo bloqueio por tentativas por colaborador; (4) sessão continua vinculada a um `employee_id` único (sem ambiguidade); (5) audit do evento com `company_id`. Não enfraquece autenticação (PIN continua obrigatório, mensagens genéricas mantidas). Alternativa (menos recomendada): CPF+código de unidade na tela inicial.

## 5. Matriz de produtos, funcionalidades e tabelas

Legenda de “Enforcement atual”: **RLS-F** = RLS com `has_feature` · **SRV-F** = `requireFeature` no server · **UI** = só frontend · **—** = apenas gate de assinatura (`has_valid_access`).

| Produto | Funcionalidade | Tabelas | Feature atual | Enforcement hoje | Policies a revisar |
| --- | --- | --- | --- | --- | --- |
| **Core (nunca feature-gate)** | Cadastro central | companies, units, profiles, user_roles, user_units, employees, roles, teams, work_regimes, platform_admins, feature_entitlements, audit_logs, notifications, portal_sessions | — | RLS empresa/unidade | Somente correção P1 (`user_units_*`, `profiles_admin_manage`, `user_roles_admin_manage`) |
| **Ponto** | Escalas avançadas | schedules, schedule_blocks, schedule_changes, shift_swap_requests | schedules_advanced | RLS-F + UI | OK (manter); server-F ausente |
| | Turnos/templates | shifts, schedule_templates(+_items) | shifts, schedule_templates | RLS-F + UI | OK |
| | Jornada fixa | fixed_work_schedules | fixed_schedule | SRV-F (único) + UI | Avaliar RLS-F de leitura |
| | Batidas | time_entries, time_entry_reviews, point_policies | time_entries | **UI + assinatura** | `time_entries` (policies `time_entries` unit_all), `time_entry_reviews` |
| | Cartão-ponto/timesheet | point_cards, point_card_deliveries, point_card_events, point_card_evidence, timesheet_periods, timesheet_entries, timesheet_disputes, timesheet_batches | point_cards, schedule_compliance, schedule_history | **UI + assinatura** | Todas as 8 tabelas do grupo |
| **Estoque** | Itens/saldo/movimentos | inventory_items, stock_movements | inventory | RLS-F + UI | OK; adicionar server-F |
| | Inventários/alertas | inventory_counts(+_items), stock_alerts | inventory | **UI + assinatura** | `inventory_counts`, `inventory_count_items`, `stock_alerts` |
| | Catálogo compartilhado | catalog_items | items | **UI + assinatura** | **Não feature-gate** (compartilhado com EPIs); gate no módulo consumidor |
| | Fornecedores | suppliers | — (sem uso) | — | Manter sem gate até Compras definir |
| **Documentos** | Docs ocupacionais/exames | occupational_documents, document_requests, document_acknowledgements, document_access_logs | compliance | **UI + assinatura** (policies usam `clinical_access_level`/papéis) | Adicionar feature `compliance` em escrita |
| | Holerites | payslips, payslip_versions, payslip_signatures, payslip_disputes, payslip_settings, payslip_audit_events | payslips | **UI + assinatura** (policies de RH/admin) | Adicionar feature `payslips` em escrita; **leitura preservada** (retenção legal `legal_hold`) |
| | LGPD/aceite | acceptance_policies, privacy_policies | settings (transversal) | UI | Tratar como Core de Documentos (sem gate por produto) |
| **Extras** | EPIs/entregas | delivery_rules, item_deliveries(+_items/_evidence/_events), employee_item_deliveries (legado) | deliveries, delivery_rules | **UI + assinatura** | `delivery_rules`, `item_deliveries*` (escrita) |
| | Vendas | sales_connections, sales_import_jobs, sales_orders(+_items), sales_daily_metrics | sales | RLS-F **só em sales_orders** | `sales_connections`, `sales_import_jobs`, `sales_daily_metrics` |
| | Uniformes | uniform_kits(+_items), uniform_exchange_requests | (via compliance/deliveries na UI) | **UI** | Definir feature dona (seção 12) |
| **Compras** | — | suppliers (reuso), purchase_* (novo) | purchases (novo) | — | Criar já com feature |
| **Caixa** | — | cash_* (novo) | cash (novo) | — | Criar já com feature |
| **Financeiro** | — | finance_* (novo) | finance (novo) | — | Criar já com feature |

**Estratégia de feature (RECOMENDAÇÃO).**

1. **Não** aplicar `has_feature` em tabelas do Core nem em `catalog_items`/`employees`/`units` — dados compartilhados entre produtos.
2. Padrão por tabela de domínio: **SELECT** sem feature (historial retido, LGPD/retenção) + **INSERT/UPDATE/DELETE** com `has_feature` — replicando o padrão `_select`/`_write` de `20260901211729`. Cancelamento do produto ⇒ escrita bloqueada no banco; leitura histórica preservada; UI oculta.
3. Server: chamar `requireFeature(userId, <feature>)` no início de cada server function do domínio (barato, explícito, independe de RLS) — generalizar o padrão já existente em `fixed-schedule.functions.ts`.
4. Trial/admin-grant: hoje governam a empresa inteira (`app_auth.has_valid_access`) e `feature_entitlements.source IN ('plan','admin_grant')` (`apply_plan_entitlements` nunca desliga `admin_grant` — CONFIRMADO `20260901211326`). Manter essa semântica por produto: concessão administrativa sobrepõe plano e não é revogada por sync de plano.

## 6. Plano de segurança (resumo executivo das correções)

1. **P1 (crítica):** proveniência de papéis — seção 4.1 (Fase 2).
2. **P2:** feature em RLS `_write` por domínio + `requireFeature` nos server functions — seção 5 (Fases 4 e 8–10).
3. **P3:** Storage por pasta — seção 7 (Fase 3).
4. **P4:** login CPF multi-empresa — seção 4.4 (Fase 5).
5. **Endurecimentos de baixo custo:** comparar `x-connection-secret` do `sales-ingest` com `timingSafeEqual` (hoje `===`, CONFIRMADO `src/routes/api/public/sales-ingest.ts:27`); adicionar `MYFOODS_AUTOMATION_TOKEN`, `CRON_SECRET`, `CRON_SECRET_PREVIOUS` ao `.env.example`; revisar expiração/rotação de segredos de `sales_connections`.
6. **Não modificar** nesta etapa: autenticação Supabase/portal, `prevent_client_billing_update`, RLS existente.

## 7. Plano de Storage

**CONFIRMADO:** buckets privados com limites (`20260905000001`): `item-photos` 5 MB, `avatars` 3 MB, `signatures` 2 MB, `documents` 10 MB, `payslips` 20 MB. Policies versionadas por bucket apenas (`20260829134344`). Caminhos com prefixo `{company_id}/...` (ver 2.3.5). Uploads sensíveis passam por service role no servidor (portal/assinaturas/holerites — CONFIRMADO nos `portal-*.functions.ts`), uploads de exames vão direto do cliente com JWT (`app.conformidade.exames.novo.tsx`). Leitura sempre via `createSignedUrl` de curta duração (300–3600 s).

**PENDENTE (inspeção no Cloud, sem alteração):** existência de policies por pasta; objetos fora do padrão `{company_id}/...`; quem são owners dos objetos legados.

**RECOMENDAÇÃO (Fase 3):**
1. Versionar policies por pasta em migration: para cada bucket, policy `SELECT/INSERT/UPDATE/DELETE` exigindo `(storage.foldername(name))[1] = <company_id do usuário>` (via `app_auth.current_company_id()`), substituindo as policies por bucket.
2. `payslips`: leitura restrita a RH/admin da empresa ou ao próprio colaborador (casar `payslip_versions` ↔ `payslips.employee_id`); manter assinaturas via service role.
3. `documents` (exames): aplicar níveis já existentes (`clinical_access_level`: `saude_ocupacional`/`rh_autorizado`/`gestor_autorizado`/`administrativo`) nas policies de pasta, não só na aplicação.
4. `avatars`/`item-photos`/`signatures`: pasta por empresa; assinaturas só escritas por service role (remover write direto do cliente se existir).
5. Migração de objetos fora do padrão: script de inventário (`ls` via service role) → cópia para caminho canônico → verificação de hash → só então política antiga removida.
6. Testes negativos: usuário de A não gera signed URL de objeto de B mesmo conhecendo o caminho.

## 8. Plano de catálogo e entitlements (sem criar tabelas nesta etapa)

**Estrutura recomendada (RECOMENDAÇÃO):**

- `products` (novo): `code` (ponto, estoque, documentos, compras, caixa, financeiro, executive), `name`, `description`, `icon`, `sort_order`, `active`. Catálogo do Hub e da cobrança.
- `product_features` (novo): `product_code` ↔ `feature_code` — fonte única do mapeamento; `src/config/features.ts` passa a derivar dela (geração/tipos) para não duplicar regras.
- `company_products` (novo): `company_id`, `product_code`, `status` (`trial`, `active`, `past_due`, `canceled`, `admin_grant`), `source` (`subscription`, `trial`, `admin_grant`), `trial_ends_at`, `granted_by`, histórico em `company_product_events`. **Direito de acesso = função SQL** `app_auth.has_product(company_id, product_code)` que considera `company_products` + plataforma admin; `has_feature` passa a derivar: feature habilitada ⇔ alguma empresa-produto ativa que a inclua. Compatibilidade: durante a transição, `has_feature` também aceita o caminho atual (`plan_code` → `plan_feature_codes`) para não quebrar nada.
- `feature_entitlements` permanece como **cache/materialização** ( trigger de sync como hoje) — evita reescrever 40+ policies de uma vez.
- Pacotes: `bundles` + `bundle_products` (fase de comercialização; o mecanismo de direitos é o mesmo — um pacote concede N `company_products`).
- Histórico: `company_product_events` (mudança de status, origem, actor) + `audit_logs`.

**Relação com Stripe:** assinatura Stripe (customer/subscription/items) é **fato de cobrança**; `company_products` é **direito de acesso**. O webhook reconcilia um no outro. Nunca autorizar lendo Stripe em tempo de request.

## 9. Plano do Hub (`/hub`)

**Fluxo (RECOMENDAÇÃO, sem quebrar fluxos):**

1. `/auth` permanece o login único (e-mail/senha/Google). Após autenticar: se `profiles.company_id` nulo → `/onboarding` (fluxo atual); senão → `/hub` (mudança mínima no redirect de `_authenticated/route.tsx` e `auth.tsx`).
2. `/hub` (rota nova sob `_authenticated`, ~1 tela): lista cards dos produtos derivados de `company_products`/entitlements — contratados (acessíveis), disponíveis para contratar (CTA→checkout), indisponíveis. Reaproveita `use-workspace` (adicionar `products` ao contexto) e o design system.
3. Produtos acessam por prefixos próprios; **`/app` permanece o produto Ponto+extras** (redirects de compatibilidade para links antigos). Nenhum re-login: mesma sessão Supabase; RLS continua a barreira real.
4. Navegação por produto: generalizar `AppShell` com prop `product` (itens de NAV por produto + cor/ícone do produto, mantendo identidade `Acid Operations`); `featureForRoute` passa a resolver produto→features. Portal do colaborador inalterado (transversal).
5. Gate de rota: `RouteFeatureGate` valida o produto da rota (novo mapa `ROUTE_PRODUCTS`) além das features; `FeatureBlocked` reutilizado com CTA para o Hub.

## 10. Plano de Billing (Stripe)

**Estado atual (CONFIRMADO):** checkout só do plano `comeco` (`src/config/billing.ts` — Essencial/Equipe sem `priceId`); CTAs ligados no working tree; webhook (`src/routes/api/public/stripe-webhook.ts`) sincroniza 1 assinatura → `subscriptions` (conflict `user_id`) + `companies` (status/plano), idempotente via `stripe_webhook_events` (registro pós-processamento, 23505); acesso só por `companies.access_source/subscription_status` (`app_auth.has_valid_access`, `plan.server.ts:23-34`); `prevent_client_billing_update` impede cliente alterar billing; Customer Portal no backend (`createCustomerPortalSession`); **limite de 1 assinatura ativa por empresa** no checkout (`billing.functions.ts:32-34`); **limites de plano não enforceados** (2.3.3).

**Plano (RECOMENDAÇÃO):**

1. **Reconciliação local (Fase 0, pré-requisito):** revisar e commitar o working tree (a versão antiga do HEAD tem `pk_live` no código — nunca restaurar); confirmar em qual chave (live/test) o webhook de produção está apontado — PENDENTE ao dono.
2. **Catálogo por produto:** `products` + preços por produto/ciclo na Stripe (produtos Stripe espelhando `products`); config central nova (`src/config/billing.ts` evolui para lista de itens); **decisão humana** sobre manter os pacotes Começo/Essencial/Equipe como bundles (seção 18.3).
3. **Contratação individual:** `checkout.sessions.create` em modo subscription com **múltiplos `line_items`** (1 por produto selecionado) ou assinatura adicional por produto; metadata `{company_id, product_codes[]}`; reuso do `stripe_customer_id` da empresa.
4. **Assinatura × direito:** nova tabela `subscription_items` (ou colunas em `subscriptions`) com `stripe_subscription_item_id`, `stripe_price_id`, `product_code`, `status` — o webhook mapeia cada item → `company_products` (upsert por `(company_id, product_code)`), substituindo o upsert único de hoje (que usa `onConflict: "user_id"` e trata 1 preço).
5. **Webhook:** mesmos eventos + `customer.subscription.updated` reavaliam item a item; idempotência mantida; **reconciliação**: job manual/scheduled (usa `CRON_SECRET`) que compara assinaturas Stripe ativas vs `company_products` e corrige drift, registrando em `audit_logs`.
6. **Cancelamento individual:** `subscription.items` delete na Stripe (ou `cancel_at_period_end` por item quando suportado) → webhook marca `company_products.status='canceled'` no fim do período → `has_feature` deixa de conceder escritas (RLS) e UI oculta; leitura histórica mantida (5).
7. **Upgrade/downgrade/renovação:** via itens da mesma assinatura + Customer Portal por produto; prorratação padrão Stripe; regras de carência/inadimplência **PENDENTES** (arquitetura proíbe inventar política).
8. **Falha de pagamento:** `invoice.payment_failed` → `past_due` → `has_valid_access` já bloqueia (CONFIRMADO: só `active/trialing` pagos passam); comunicado via notificações.
9. **Trial:** hoje trial de empresa inteira; para produto: `company_products.status='trial'` + `trial_ends_at` por produto.
10. **Limites de plano:** enforce no servidor (`requireFeature`/validações de contagem em `pilot.functions`/`admin.functions`) e/ou constraint SQL — **decisão humana** sobre quais limites valem por produto (hoje são só textos).

## 11. Plano de evolução dos seis produtos

### 11.1 MyFoods Ponto (adaptar — CONFIRMADO maduro)
Reuso integral: rotas `/app/time-entries`, `/app/point-cards(+id)`, `/app/shifts`, `/app/schedules`, `/app/schedule-*`; portal `/portal/ponto|escala|cartao-ponto(+id)|pendencias`; tabelas de escala/batidas/timesheet/cartões; geolocalização (`point_policies`, `geo_status`) e revisões. **Adaptações:** feature codes do grupo em RLS `_write` + `requireFeature`; separar visualmente como produto (NAV/branding do produto); consolidar documentação da fronteira `point_cards`↔`timesheet_*` (4.4); dependência declarada do Core (employees/units) e do portal.

### 11.2 MyFoods Estoque (adaptar)
Reuso: `/app/inventory`, `inventory_items`, `stock_movements` (com before/after, transferência entre unidades), `inventory_counts(+_items)`, `stock_alerts`, `catalog_items`. **Adaptações:** features `inventory` nas tabelas restantes; alertas sem remetente (fila `notifications` existe, envio não — CONFIRMADO); integração futura com Compras via `automation_events` (estoque abaixo do mínimo → candidato de compra) e recebimento de pedidos → `stock_movements` com `reference`/origem rastreada. **Dependências:** `catalog_items` compartilhado com EPIs; Vendas é módulo separado (não requisito do Estoque).

### 11.3 MyFoods Documentos (adaptar)
Reuso: módulo ocupacional (`occupational_documents`, `document_requests/acknowledgements/access_logs`, kits/trocas de uniforme), holerites completos (`payslips*` com versões/assinaturas/disputas/retenção), LGPD (`acceptance_policies`, `privacy_policies`), portal `/portal/documentos|holerites|perfil`. **Adaptações:** feature `compliance`/`payslips` nas RLS de escrita; Storage por pasta com níveis clínicos (seção 7); documento **empresarial genérico** (contratos/alvarás com vencimento) é extensão nova do produto; relação com EPIs/exames/uniformes definida na seção 12.

### 11.4 MyFoods Compras (do zero)
Reuso imediato: `suppliers` (modelada, sem UI — CONFIRMADO) e `catalog_items` como catálogo de demanda. **Modelo (RECOMENDAÇÃO):** `purchase_requests` (status: rascunho→pendente→aprovada→rejeitada→pedida→recebida; unidade solicitante), `purchase_request_items` (item, qtd, unidade de medida), `purchase_orders` (+ itens, fornecedor), `purchase_receipts` (+ itens → gera `stock_movements` tipo `entrada` com `reference=purchase_receipt_id` e `source='compras'`), histórico/auditoria via `audit_logs` + `automation_events`. Fluxo de aprovação: aprovador = papel `admin`/`unit_manager` da unidade (mínimo privilégio); configuração de fluxo complexa fica fora do escopo inicial. Feature nova `purchases` desde o nascimento (RLS `_write` + `requireFeature`).

### 11.5 MyFoods Caixa (do zero)
**Modelo:** `cash_sessions` (abertura: unidade, operador, fundo inicial; fechamento: conferido, divergência, status), `cash_movements` (entrada/saida/sangria/reforço; operador; origem), histórico de turnos; relatórios operacionais por unidade. Distinto do Financeiro por diretriz (arquitetura §3.4). Feature nova `cash`. **Sem** integração automática com adquirentes/PDV (proibida por diretriz sem requisito).

### 11.6 MyFoods Financeiro (do zero)
**Modelo:** `finance_accounts` (categorias/centros), `finance_entries` (receita/despesa; contas a pagar/receber com vencimento/baixa), `finance_cashflow` (visão gerencial por período/unidade), relatórios. **Integração Caixa→Financeiro sem duplicar (RECOMENDAÇÃO):** o Financeiro **não copia** lançamentos; cria `finance_entries` com `origin_product='caixa'`, `origin_id=cash_movements.id` e **unique constraint** `(origin_product, origin_id)` — idempotência por chave de origem; a criação é feita por serviço do Financeiro consumindo eventos (`automation_events` do Caixa) ou por ação explícita do usuário (“lançar no Financeiro”), nunca automática sem requisito aprovado (diretriz §3.5/§10). Vendas pode alimentar receita prevista pelo mesmo mecanismo de origem.

### 11.7 MyFoods Executive (somente arquitetura futura)
Camada de leitura: `executive_*` views/agregações derivadas **apenas** dos produtos contratados (`company_products` ativos); elegibilidade = ≥2 produtos ativos (regra da arquitetura §9); nenhuma escrita operacional; fora do escopo inicial, junto com o pacote “Completo”.

## 12. Destino dos módulos adicionais (RECOMENDAÇÃO — decisão humana na seção 18)

| Módulo | Destino recomendado | Justificativa |
| --- | --- | --- |
| **EPIs/entregas** (`item_deliveries*`, `delivery_rules`) | **Funcionalidade interna do Estoque** (fase 1); opção futura: produto “Gestão de EPIs” | Compartilha `catalog_items` com Estoque; portal de aceite já existe; sepadão limpa `items` vs `inventory` |
| **Vendas** (`sales_*`, ingest API) | **Serviço compartilhado do Core** (ingestão de dados), com apresentação dentro do Estoque/Financeiro | É fonte de dados (adquirentes/PDV), não um problema operacional do gestor; o Financeiro consumirá por origem rastreada |
| **Conformidade/exames** | **Interna de Documentos** | Já usa `clinical_access_level`, documentos e portal |
| **Uniformes** (`uniform_*`) | **Interna de Documentos/RH** (ciência e trocas) ou de Estoque (itens) — **PENDENTE decisão** | Duas leituras plausíveis; recomendo Documentos (o fluxo atual é de solicitação/ciência) |
| Portal do Colaborador | **Core compartilhado** (transversal) | Atende Ponto (ponto/escala/cartão) e Documentos (holerites/documentos); contratação separada não recomendada |
| Admin piloto / LGPD settings | **Core** | Administração da plataforma e conformidade |

## 13. Estratégia de testes

**Já existentes (CONFIRMADO — `e2e/`):** `migration.smoke.spec.ts` (landing/auth sem erros; guards de 8 URLs; OAuth redireciona ao Supabase; fontes locais); `portal-login.spec.ts`/`portal-session.spec.ts` (CPF/PIN e sessão); `migration.functions.spec.ts` (compatibilidade de PIN/sessão e visão facial independente); `npm run typecheck`/`build`/`lint`; `scripts/audit.mjs` (integridade de imports/tabelas).

**A criar (RECOMENDAÇÃO), por camada:**

1. **RLS (novo, crítico):** suíte SQL automatizada (pgTAP ou script Node via service role + sessões JWT) cobrindo: isolamento entre empresas (SELECT/INSERT/UPDATE/DELETE negados fora da empresa) para as tabelas do Core e dos 6 produtos; **prova da correção P1** (admin de B × dados de A; papel de B não autoriza em A; multi-empresa por vínculo quando existir); isolamento entre unidades (gerente da unidade A não vê B); papéis (`hr` grava payslips, `staff` não; `unit_manager` na unidade; platform admin bypass); feature gating (sem contratação → escrita negada, leitura histórica permitida; admin_grant concede; trial expirado bloqueia).
2. **Storage:** cross-company signed-URL negada; upload fora da pasta da empresa negado; níveis clínicos de `documents`; limites de tamanho.
3. **Portal:** multi-empresa por CPF (novo fluxo da 4.4); bloqueio por tentativas; revogação de sessão; acesso a documento de outro colaborador negado.
4. **Billing/Stripe (com mocks + ambiente de teste):** checkout por produto/pacote; webhook idempotente (mesmo `event_id` 2×); `invoice.payment_failed` → bloqueio; cancelamento de 1 produto não afeta os demais; downgrade remove direito no fim do período; reconciliação corrige drift; `prevent_client_billing_update` rejeita tentativa client-side.
5. **APIs públicas:** `sales-ingest` (segredo inválido/expirado; tenant/unit mismatch; payload inválido; idempotência por `unit_id+metric_date`); automação (token ausente/errado → 401; tenant/employee mismatch; dedupe).
6. **Regressão dos módulos existentes:** smoke expandido para as 30 rotas `/app` e rotas do portal com sessão real; check de ausência de erros de console; verificação de rotas ocultas por feature retornando `FeatureBlocked` e **negando no banco** (teste negativo por trás do UI).
7. **Manuais:** LGPD (face/localização), onboarding real, OAuth Google real (hoje interceptado apenas — CONFIRMADO em `VALIDATION.md`).

## 14. Estratégia de migração e rollback (nada executa agora)

1. **Backups:** `pg_dump` lógico + snapshot do Storage antes de cada fase; backup testado por restore em projeto staging Supabase (projeto separado, nunca produção).
2. **Migrations incrementais forward-only** (`AGENTS.md` proíbe reescrever aplicadas); cada migration: aditiva primeiro (expand), uso/troca depois (contract) em fase posterior; nenhuma migration destrutiva sem plano de reversão e aprovação explícita (arquitetura §13).
3. **Compatibilidade temporária:** helpers `_in` novos + wrappers antigos; `has_feature` aceita caminho plano **e** caminho produto em paralelo; `companies.plan_code` mantido como derivado até billing novo estar validado; redirects de rotas antigas.
4. **Validação de integridade pós-migration:** `supabase/verify.sql` (RLS on em todas as tabelas, buckets, providers, policies) + contagens de linhas antes/depois + testes RLS da seção 13 contra staging.
5. **Rollback por fase:** policies/tables novas → DROP/recriar do Git; código → revert do commit da fase; dados → restore do backup da fase (janela de manutenção); Stripe → nenhuma alteração sem modo teste.
6. **Logs/auditoria:** cada fase registrada em `audit_logs` (ações administrativas) e no changelog do repositório; segredos nunca em logs.

## 15. Fases de implementação (prioridade/risco; nada executado nesta etapa)

| # | Fase | Prioridade / Risco | Conteúdo essencial (arquivos/tabelas) | Pré-requisito da fase seguinte |
| --- | --- | --- | --- | --- |
| 0 | **Baseline & reconciliação** | Alta / Baixo | Revisar e commitar working tree (saída Lovable completa: `src/lib/stripe.server.ts`, `automation.server.ts`, migrations `20260905*`/`20260930*`, `docs/`); remover segredos do histórico futuro; atualizar `roadmap.md`; backup + staging | Repo limpo; staging pronto; `verify.sql` rodando no Cloud |
| 1 | **Verificações de Cloud** | Alta / — | Inventário: policies de `storage` por pasta, funções SQL fora do Git, dados em `employee_item_deliveries`, preços/portais Stripe reais, chave live/test | Fecha os PENDENTES das seções 7 e 10 |
| 2 | **Fix P1 — papéis** | **Máxima / Médio** | Migration aditiva: `app_auth.has_role_in/is_company_admin_in/can_see_all_units_in/can_manage_payroll_in` + reescrita das policies (4.1), inclusive `user_units_*`; suíte RLS negativa | Correção validada em staging e produção |
| 3 | **Storage por pasta** | Alta / Médio | Versionar policies por `{company_id}/…`; ajustes `documents` (níveis clínicos) e `payslips` (RH/próprio); inventário de objetos fora do padrão | Isolamento de arquivos comprovado por teste |
| 4 | **Feature policy por domínio** | Alta / Médio | Padrão `_select`/`_write` com `has_feature` em: time/point_card/timesheet (8 tabelas), `inventory_counts(+items)`, `stock_alerts`, `item_deliveries*`/`delivery_rules`, `occupational_document*`, `payslips*`, `sales_connections/import_jobs/daily_metrics`; `requireFeature` nos server functions correspondentes | Escrita condicionada a contratação em todos os domínios |
| 5 | **Core do catálogo + login CPF multi-empresa** | Alta / Médio | Migration: `products`, `product_features`, `company_products(+events)`, `has_product()`; `has_feature` híbrido (plano↔produto); fix do portal (4.4); seed dos 3 produtos existentes | Direitos por produto consultáveis; portal robusto a colisão de CPF |
| 6 | **Hub central** | Média / Baixo | Rota `/hub`; `use-workspace` com produtos; `AppShell` parametrizado por produto; `ROUTE_PRODUCTS`; redirects de compatibilidade; `/app` = Ponto+extras | Navegação entre produtos sem re-login; UI reflete contratação |
| 7 | **Billing modular** | Alta / Alto | `subscription_items` (mapeamento item→produto); webhook multi-item; checkout por produto/pacote; cancelamento individual; reconciliação; Price IDs Essencial/Equipe/produtos; decisão sobre limites enforceados | Compra/cancelamento individual funcionando fim-a-fim em modo teste |
| 8 | **Adaptação Ponto** | Média / Baixo | Consolidar features (Fase 4 já cobre); NAV/branding próprio; documentação da fronteira point_cards↔timesheet; portal intacto | Ponto operando como produto isolável |
| 9 | **Adaptação Estoque** | Média / Baixo | Features restantes; alertas com remetente (canal); contrato de integração com Compras (eventos) | Estoque isolável + pronto p/ receber compras |
| 10 | **Adaptação Documentos** | Média / Médio | Features; storage clínico (Fase 3); extensão “documentos empresariais” (categorias/vencimentos) opcional | Documentos isolável |
| 11 | **Compras (novo)** | Média / Médio | `purchase_*` já com feature `purchases`; UI `/compras`; recebimento→`stock_movements` (origem rastreada); aprovação por papel/unidade | Compras MVP: solicitar→aprovar→pedir→receber |
| 12 | **Caixa (novo)** | Média / Médio | `cash_sessions`/`cash_movements` com feature `cash`; UI `/caixa`; eventos p/ Financeiro | Fechamento com divergência auditável |
| 13 | **Financeiro (novo)** | Média / Alto | `finance_*` com feature `finance`; origem idempotente `(origin_product, origin_id)`; fluxo gerencial; relatórios | Lançamentos de Caixa/Vendas conciliados sem duplicidade |
| 14 | **Validação integrada & comercialização** | Alta / Médio | Suíte completa (seção 13) em staging; criterios da arquitetura §16; páginas comerciais por produto; pacotes; Executive **não** implementado | Go/no-go de comercialização |

Classificação de risco: **Alto** — Fases 2, 3, 4, 7, 13 (tocam RLS/segurança/cobrança). Todas com backup + staging + rollback (seção 14).

## 16. Dependências e bloqueios

- **Bloqueio duro:** Fases 2–13 exigem Fase 0 (baseline) e 1 (verificações Cloud). Fase 7 exige decisão de pacotes/preços (18.3). Fase 6 depende de 5. Fases 11–13 dependem de 4 (features) e 5 (catálogo).
- **PENDENTES externos:** acesso de leitura ao Supabase Cloud (policies de storage, funções fora do Git, dados legados); Dashboard Stripe (preços, chave live/test, portal); provisionamento de `MYFOODS_AUTOMATION_TOKEN`/`CRON_SECRET` se automações forem usadas entre produtos; decisão de política comercial (carência/inadimplência/limites).
- **Dependências técnicas internas:** `has_feature` híbrido (5) antes do billing novo (7); Storage (3) antes de expandir Documentos (10); `stock_movements` com origem antes do recebimento de Compras (11).

## 17. Critérios gerais de conclusão (derivados da arquitetura §16)

1. Login único + `/hub` listando somente produtos contratados/autorizados. 2. Cada produto com interface e navegação próprias sob identidade compartilhada. 3. Acesso a dados respeitando empresa/unidade/papel/produto — **provado por testes negativos automatizados**. 4. Cancelamento de um produto bloqueia sua escrita no banco sem afetar os demais. 5. Pacotes sem duplicar cadastros (mecanismo de direitos único). 6. Dados e fluxos atuais preservados (regressão verde: rotas `/app`, portal, checkout `comeco`). 7. Storage com isolamento por empresa comprovado. 8. `typecheck`/`build`/`lint`/e2e verdes a cada fase. 9. Migrations forward-only com rollback documentado. 10. Nenhum segredo em código/front (inclui não restaurar o `pk_live` do HEAD).

## 18. Decisões que ainda precisam de aprovação humana

1. **Commit do baseline (Fase 0):** aprovar a consolidação do working tree (saída Lovable) como commit único revisado — inclui confirmar que o `.env` removido não volta e que `docs/AUDITORIA_TECNICA_MYFOODS.md`/`PLANO_TECNICO_*` entram no Git.
2. **Fix P1 (Fase 2):** aprovar a migration de proveniência de papéis e a suíte RLS negativa (prioridade máxima recomendada).
3. **Modelo comercial:** manter Começo/Essencial/Equipe como pacotes (bundles) + produtos avulsos? Quais preços por produto (arquitetura proíbe inventar valores)? Limites (colaboradores/unidades/admins) passam a ser enforceados no servidor?
4. **Destino dos módulos extras** (seção 12): EPIs→Estoque; Vendas→Core; Conformidade→Documentos; **Uniformes→Documentos ou Estoque?** Portal do Colaborador transversal no Core?
5. **Storage (Fase 3):** autorizar a inspeção no Cloud e a migration de policies por pasta (com inventário de objetos fora do padrão antes).
6. **Stripe (Fase 7):** qual conta/ambiente (live/test) é a verdade atual; criação de produtos/preços na conta existente; Janela para trocar webhook de produção.
7. **Multiempresa por usuário:** manter 1 empresa por usuário (planos atuais) ou habilitar multi-vínculo (impacta `profiles`, helpers `_in` e portal)?
8. **Compras/Caixa/Financeiro:** aprovar os modelos mínimos das seções 11.4–11.6 (tabelas, fluxos, integração por origem idempotente) antes das specs funcionais individuais.
9. **Biometria/facial:** permanece? Se sim, revisão LGPD específica (base legal/retenção) antes de qualquer mudança — exigência da arquitetura §13.
10. **n8n/automações:** adotar n8n como orquestrador (provisionar `MYFOODS_AUTOMATION_TOKEN`) ou operar só com cron interno?

---

*Fim do plano. Nenhum arquivo além deste documento foi criado/alterado. Aguardando aprovação explícita para iniciar a Fase 0.*
