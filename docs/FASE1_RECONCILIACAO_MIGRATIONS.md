# Fase 1.1 — Reconciliação de migrations (local × Supabase Cloud)

Data: 2026-10-21 · Projeto `MyFoods` (`obfwapckvwjpjzlumlei`) · Baseline Git `bf56a15`
Método: apenas `SELECT` em `supabase_migrations.schema_migrations`, `pg_proc`, `pg_policies`. Nada foi aplicado no Cloud.

## 1. Resumo
| | Quantidade |
|---|---|
| Migrations no remoto | **30** (o relatório anterior dizia 29: erro de contagem) |
| Migrations `.sql` no repo antes da fase | 23 |
| Recuperadas do remoto nesta fase | 7 |
| Migrations `.sql` no repo agora (aprovadas) | **30** (+ 1 rascunho não aprovado, + 1 `.log`) |
| Só no remoto antes da fase | 7 |
| Mesmo nome, timestamp diferente | 2 (conteúdo idêntico) |

## 2. Inventário
Legenda: **=** igual nos dois lados · **R→L** recuperada do remoto · **TS** timestamp diferente.

| Versão (remota) | Nome | Local | Remoto | Situação |
|---|---|---|---|---|
| 20260829134240 | cee32520-… | sim | sim | = (versão/nome; sem SQL no remoto) |
| 20260829134305 | 4390ef54-… | sim | sim | = (idem) |
| 20260829134344 | 5e842d89-… | sim | sim | = (idem) |
| 20260830101855 | ca9a4651-… | sim | sim | = (idem) |
| 20260830105459 | 231a1dc9-… | sim | sim | = (idem) |
| 20260830230759 | c8e79326-… | sim | sim | = (idem) |
| 20260831160253 | ba484a95-… | sim | sim | = (idem) |
| 20260831161250 | 48520154-… | sim | sim | = (idem) |
| 20260831205851 | f24b51ab-… | sim | sim | = (idem) |
| 20260831211015 | 65ed0fae-… | sim | sim | = (idem) — cria o schema `app_auth` |
| 20260831234238 | 3dfa97ec-… | sim | sim | = (idem) |
| 20260901094706 | 6e5371ab-… | sim | sim | = (idem) |
| 20260901094732 | 0ee55254-… | sim | sim | = (idem) |
| 20260901210619 | 92cc989d-… | sim | sim | = (idem) |
| 20260901210645 | d98ae1a0-… | sim | sim | = (idem) |
| 20260901211326 | fc22e870-… | sim | sim | = (idem) |
| 20260901211351 | 5674db99-… | sim | sim | = (idem) |
| 20260901211729 | bad6b544-… | sim | sim | = (idem) |
| 20260905000000 | independent_face_provider | sim | sim | = (idem) |
| 20260905000001 | create_storage_buckets | sim | sim | = (idem) |
| 20260905000002 | stripe_subscription_security | sim | sim | = (idem) |
| 20260906000001 | fix_admin_grant_access_source | **R→L** | sim | recuperada |
| 20260906000002 | enforce_plan_limits | **R→L** | sim | recuperada |
| 20260906000003 | subscription_per_company | **R→L** | sim | recuperada |
| 20260907000000 | employee_push_notifications | **R→L** | sim | recuperada |
| 20260910123351 | harden_auth_rls_and_portal | **R→L** | sim | recuperada |
| 20260910123940 | restrict_sensitive_columns_and_audit | **R→L** | sim | recuperada |
| 20260910220812 | time_entry_visual_evidence | **R→L** | sim | recuperada |
| 20260930000707 (local) / 20260930001123 (remoto) | myfoods_automation_engine | sim | sim | **TS**, conteúdo idêntico |
| 20260930001652 (local) / 20260930001707 (remoto) | automation_events_explicit_client_deny | sim | sim | **TS**, conteúdo idêntico |
| 20261021120000 | tenant_scoped_roles_and_user_units | rascunho | não | **NÃO APROVADO** — ver plano de correção |

Arquivo extra: `20260905000002_stripe_subscription_security.sql.log` (saída de `psql`, não é migration; ignorado pelo Git via `*.log`).

## 3. Recuperação
Para as 7 migrations só-remotas, o Supabase guarda o SQL em `schema_migrations.statements`. Os arquivos foram gravados com versão e nome originais, em ordem cronológica, sem acrescentar nem inventar conteúdo.
- Fidelidade: onde o remoto guardava o SQL já separado em comandos (`enforce_plan_limits`, `employee_push_notifications`, `fix_admin_grant_access_source`, `subscription_per_company`), cada comando recebeu `;` final, que o remoto não guarda. Nada mais foi alterado.
- **Verificação de integridade:** comparei o hash MD5 do conteúdo normalizado (sem comentários, espaços e `;`) de cada arquivo com o hash calculado no remoto sobre `statements`. As 7 migrations deram **hash idêntico**.
- Não recuperável: **nenhuma das 7**. Limitação: as 21 migrations anteriores a `20260906` têm `statements` vazio no remoto (foram registradas sem SQL, provavelmente na restauração do projeto). Para elas só é possível comparar versão e nome, não conteúdo.

## 4. Migrations de automação (mesmo nome, timestamps diferentes)
| | Local | Remoto |
|---|---|---|
| `myfoods_automation_engine` | `20260930000707`, 1.270 caracteres | `20260930001123`, 1.103 caracteres |
| `automation_events_explicit_client_deny` | `20260930001652`, 342 caracteres | `20260930001707`, 170 caracteres |

- Hash normalizado idêntico nos dois pares (`f628025e…` e `7df9e651…`). A diferença de tamanho é só de comentários e espaços.
- Objetos: tabela `automation_events` e política RESTRICTIVE `automation_events_deny_client_access` (ver relatório da Fase 1). Efeitos colaterais: nenhum além do já aplicado.
- Nenhuma versão foi escolhida e nada foi sobrescrito. **Decisão humana pendente:** manter os timestamps locais e registrar o desvio, ou renomear os arquivos locais para os timestamps remotos (`…001123`, `…001707`). Enquanto o nome local diferir do remoto, `supabase db push` tentaria reaplicar as duas migrations como novas; por isso o `db push` segue proibido. A opção recomendada é renomear os arquivos locais para os timestamps remotos, que é a única que o histórico remoto reconhece.

## 5. Schema `app_auth`
Correção do relatório anterior: **o schema está no repositório** (`20260831211015_…` o cria; `92cc989d`, `20260905000002` e `20260910123351` o evoluem). O que faltava eram as 7 migrations acima. Não recriei nem alterei o schema.

Funções no remoto (12), todas `SECURITY DEFINER`, `search_path` fixo, `EXECUTE` para `authenticated` e não para `anon`:
| Função | Assinatura | Escopo de empresa |
|---|---|---|
| `current_company_id` | `()` | empresa do perfil de `auth.uid()` |
| `in_company` | `(uuid)` | sim, + `has_valid_access` |
| `has_valid_access` | `(uuid)` | sim |
| `has_feature` | `(uuid, text)` | sim |
| `company_plan` | `(uuid)` | sim |
| `has_any_role` | `(app_role[])` | **sim** (filtra `company_id`) |
| `has_role` | `(uuid, app_role)` | **não** |
| `is_company_admin` | `()` | **não** |
| `can_manage_payroll` | `()` | **não** |
| `can_see_all_units` | `()` | **não** |
| `has_unit_access` | `(uuid)` | **não** (não confere a empresa da unidade) |
| `is_platform_admin` | `(uuid)` | n/a (tabela `platform_admins`) |

Dependências: as quatro funções sem escopo (`is_company_admin`, `has_role`, `can_manage_payroll`, `can_see_all_units`) aparecem 17 vezes na migration de reescrita de políticas (`20260831211015`) e 2 vezes em `92cc989d`, além das políticas criadas depois (contagem exata de políticas remotas: pendente); praticamente todas as 69 tabelas usam `in_company`/`has_unit_access`. As definições remotas das quatro funções sem escopo coincidem com as de `20260831211015`. Spot-check de `in_company`, `has_valid_access`, `has_feature`, `company_plan` e `is_platform_admin`: existem nas migrations locais com a mesma intenção; uma comparação byte a byte só será possível reaplicando o histórico num banco descartável (pendente de aprovação).

## 6. Divergências restantes
1. Timestamps das duas migrations de automação (seção 4).
2. Conteúdo das 21 primeiras migrations não verificável (sem SQL no remoto).
3. Diferenças de estado (não de histórico): só um replay das 30 migrations num Postgres descartável com o stack Supabase mostraria se o schema local reproduz o remoto. Não foi feito (exigiria `supabase start`/`db reset`, proibido nesta fase).
4. Observados no remoto e não representados em migration alguma: nenhum encontrado na amostra consultada (políticas de `public` e `storage`, funções `app_auth`, triggers de `profiles`/`companies`/`user_roles`). A amostra não cobre extensões, índices nem `auth.*`.
