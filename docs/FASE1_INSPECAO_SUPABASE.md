# Fase 1 — Inspeção do Supabase Cloud (somente leitura)

Data: 2026-10-21 · Projeto: `MyFoods` (`obfwapckvwjpjzlumlei`, us-west-2, Postgres 17.6) · Repo: `bf56a15` (main)

Escopo: apenas `SELECT` no catálogo e `get_advisors`. Nenhuma migration, DDL, alteração de RLS/Storage ou dado foi executada.
Nenhum teste de exploração foi feito: os achados vêm da leitura de políticas, funções e grants.

## 1. Inventário
- 69 tabelas em `public`, todas com RLS ligada. Nenhuma tabela sem política.
- 6 buckets privados (a referência dizia 5): `avatars`, `documents`, `item-photos`, `payslips`, `signatures`, `time-clock-evidence`.
- Dados: 6 empresas, 14 perfis, 6 `user_roles`, 6 `user_units`; 5 objetos no Storage (`item-photos` 2, `signatures` 3).
- Verificação de dados: 0 linhas de `user_roles` e 0 de `user_units` cruzando empresas. Não há indício de exploração passada nessas tabelas.
- Advisor de segurança: apenas "Leaked Password Protection Disabled".

## 2. Migrations: local × remoto
- Remoto tem 30 migrations (contagem corrigida na Fase 1.1; o primeiro relatório dizia 29); o repositório tinha 23 `.sql` + 1 `.log`.
- **Só no remoto (7), ausentes do repo**: `20260906000001 fix_admin_grant_access_source`, `20260906000002 enforce_plan_limits`, `20260906000003 subscription_per_company`, `20260907000000 employee_push_notifications`, `20260910123351 harden_auth_rls_and_portal`, `20260910123940 restrict_sensitive_columns_and_audit`, `20260910220812 time_entry_visual_evidence`.
- **Mesmo nome, versão diferente**: `myfoods_automation_engine` (local `20260930000707`, remoto `20260930001123`) e `automation_events_explicit_client_deny` (local `…001652`, remoto `…001707`). Conteúdo não comparado.
- Consequência (na data da inspeção): `employee_devices`, `notification_deliveries`, `portal_*`, o bucket `time-clock-evidence`, `protect_profile_tenant_fields`, etc. não existiam em nenhuma migration do repo, e `supabase db push`/`db reset` nesse estado era perigoso.
- **Correção (Fase 1.1):** a afirmação inicial de que o schema `app_auth` não estava no repo estava errada. Ele é criado em `20260831211015_…`; o que faltava eram as 7 migrations acima, já recuperadas (ver `docs/FASE1_RECONCILIACAO_MIGRATIONS.md`).

## 3. Achados de isolamento entre empresas

### ALTO-1 — Funções de papel não são escopadas por empresa
`app_auth.is_company_admin()`, `can_manage_payroll()`, `can_see_all_units()` e `has_role(user, role)` consultam `user_roles` por `user_id` **sem filtrar `company_id`**. Só `has_any_role()` filtra pela empresa atual.
A política `user_roles_admin_manage` (ALL, `in_company(company_id) AND is_company_admin()`) não verifica que o `user_id` alvo pertence à empresa. Um admin da empresa A pode inserir `user_roles(user_id = usuário da empresa B, company_id = A, role = owner/admin/hr)`. Para as funções não escopadas, esse usuário passa a ser admin/RH **na própria empresa B** (folha, unidades, papéis). Cenário realista: um colaborador de B com conta própria cria uma empresa A com uma segunda conta e se promove em B. Requer o UUID do alvo, que o ALTO-2 expõe.

### ALTO-2 — `user_units` sem filtro de empresa
`user_units` não tem `company_id`. `user_units_admin_manage` (ALL) usa só `is_company_admin()` e `user_units_select` usa `user_id = auth.uid() OR is_company_admin()`. Qualquer admin de qualquer empresa pode:
- **ler** todos os vínculos usuário↔unidade de todas as empresas (vaza UUIDs de usuários e unidades de terceiros);
- **inserir, alterar e apagar** vínculos de outras empresas, retirando o acesso a unidades de gerentes de B.

### MÉDIO-3 — Grants excessivos
- `anon` tem INSERT/UPDATE (e provavelmente os demais) em praticamente todas as tabelas; só o RLS (sem política para `anon`) impede. Falta defesa em profundidade.
- `authenticated` tem INSERT/UPDATE em `subscriptions` e UPDATE em colunas de cobrança de `companies` (protegidas só por trigger/RLS).
- `employees`: `portal_pin_hash`, `portal_failed_attempts`, `portal_locked_until` são graváveis pelo cliente (admin/RH). RH poderia gravar um hash escolhido, se conhecer o esquema de hash. A leitura do hash já está bloqueada.
- `companies.status`, `is_demo`, `document` não são cobertos pelo trigger de cobrança.

### MÉDIO-4 — Storage
- Isolamento entre empresas está correto: `documents`, `avatars`, `signatures` e `item-photos` exigem que a 1ª pasta seja o `company_id`; `payslips` não tem política de cliente (acesso só via service role); `time-clock-evidence` é bloqueado por política RESTRICTIVE.
- Dentro da empresa: qualquer usuário autenticado lê/escreve todos os arquivos de `documents` e `signatures`, sem filtro de papel ou unidade.

### BAIXO-5 — Referências cruzadas
Várias políticas de escrita só validam `in_company(company_id)` (ex.: `item_delivery_events_insert`, `timesheet_disputes_write`, `document_access_logs_insert`). Não validam que `employee_id`/`delivery_id` referenciados pertencem à mesma empresa. A leitura continua isolada; o risco é de integridade. Verificar FKs compostas.

### BAIXO-6 — Auth
Proteção contra senhas vazadas desativada. Funções `validate_*` executáveis por `anon` são triggers, sem risco.

### Pontos positivos
`profiles.company_id` é imutável pelo cliente (trigger + grant de coluna); cobrança protegida por trigger; `automation_events` com política RESTRICTIVE `false`; tabelas de portal/dispositivos só para `service_role`; funções `SECURITY DEFINER` com `search_path` fixo.

## 4. Correções recomendadas (nada aplicado)
1. **Reconciliar migrations primeiro**: extrair o SQL das 7 migrations remotas (`supabase_migrations.schema_migrations.statements`) para o repo, alinhar as 2 versões de automação e comparar conteúdo. Não rodar `db push`/`db reset` antes.
2. Nova migration forward, testada num branch/projeto de desenvolvimento:
   - escopar `is_company_admin`, `can_manage_payroll`, `can_see_all_units` e `has_role` por `company_id = app_auth.current_company_id()`;
   - trigger/`WITH CHECK` em `user_roles` exigindo que o `user_id` pertença à empresa do `company_id`;
   - `user_units`: políticas via `units.company_id = current_company_id()` e usuário alvo da mesma empresa; remover leitura global.
3. `REVOKE` dos grants de `anon` nas tabelas (após confirmar que nada depende deles) e dos writes desnecessários de `authenticated` (`subscriptions`, colunas de PIN/cobrança).
4. Storage: políticas por papel para `documents`/`signatures`, se o produto exigir.
5. Ativar leaked password protection (painel Auth).
6. Teste de regressão de isolamento: duas empresas, usuários de cada papel, tentativas cruzadas de SELECT/INSERT/UPDATE/DELETE.
