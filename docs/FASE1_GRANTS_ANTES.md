# Grants de `public` ANTES da migration `20261021125216_least_privilege_grants` (leitura do projeto remoto em 2026-10-21)

Fonte: `pg_class.relacl`, `pg_attribute.attacl`, `pg_default_acl` (somente leitura). Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES t=TRIGGER m=MAINTAIN.

| Escopo | Estado anterior |
|---|---|
| Padrão (maioria das tabelas) | `postgres`, `anon`, `authenticated`, `service_role` = `arwdDxtm` |
| Só `service_role` (sem `anon`/`authenticated`) | `automation_events`, `employee_devices`, `notification_deliveries`, `portal_login_rate_limits` |
| `audit_logs` | `authenticated` = `rwdDxtm` (sem INSERT) |
| `companies` | `authenticated` = `rwdDxtm` (sem INSERT) |
| `employees` | `authenticated` = `awdDxtm` (INSERT/UPDATE em nível de tabela; SELECT só por coluna, sem PIN/contadores) |
| `profiles` | `authenticated` = `rDxtm` + UPDATE por coluna em `active_unit_id, avatar_url, email, full_name` |
| `subscriptions`, `user_roles`, `user_units` | `authenticated` = `arwdDxtm` |
| Privilégios padrão (`ALTER DEFAULT PRIVILEGES`) | `postgres` e `supabase_admin`: tabelas `arwdDxtm`, sequências `rwU`, funções `X` para `postgres, anon, authenticated, service_role` |

Rollback exato: `scripts/security-tests/multitenant/rollback_20261021125216.sql`.
