# Fase 1.1 — Plano de correção de segurança (RASCUNHO PARA REVISÃO)

Status: **NÃO APROVADO. Nada foi aplicado no Supabase Cloud.** Migration proposta:
`supabase/migrations/20261021120000_tenant_scoped_roles_and_user_units.sql` (começa com um bloco que faz a migration falhar de propósito; remover só após aprovação).
Base: `docs/FASE1_INSPECAO_SUPABASE.md` e `docs/FASE1_RECONCILIACAO_MIGRATIONS.md`.

## 1. Vulnerabilidades

### A — Funções de papel sem escopo de empresa
**Causa técnica.** `app_auth.is_company_admin()`, `can_manage_payroll()`, `can_see_all_units()` e `has_role(uid, role)` fazem `SELECT … FROM user_roles WHERE user_id = … AND role IN (…)` sem `company_id`. Só `has_any_role()` filtra pela empresa atual. Além disso, `user_roles_admin_manage` valida apenas `in_company(company_id) AND is_company_admin()` no `WITH CHECK`: não verifica que o `user_id` alvo pertence àquela empresa.
**Efeito.** Admin da empresa A grava `user_roles(user_id = usuário de B, company_id = A, role = admin)`. Para as funções sem escopo, esse usuário passa a ser admin/RH na própria empresa B. Evidência atual: 0 linhas cruzadas em `user_roles` (sem sinal de exploração).

### B — `user_units` sem isolamento
**Causa técnica.** `user_units` não tem `company_id`. `user_units_admin_manage` usa só `is_company_admin()` e `user_units_select` usa `user_id = auth.uid() OR is_company_admin()`. Como `is_company_admin()` também não tem escopo, qualquer admin lê, insere, altera e apaga vínculos de qualquer empresa. Evidência atual: 0 linhas cruzadas.

## 2. Estratégia
1. Criar funções **`*_in(_company_id)`** com escopo explícito e fazer as funções legadas (mesma assinatura) **delegarem** a elas com `current_company_id()`. Assim as dezenas de políticas existentes ficam corrigidas sem reescrevê-las (menor superfície de regressão).
2. Corrigir as políticas de `user_roles` e `user_units`, e acrescentar **triggers de integridade** que valem para qualquer chamador (inclusive `service_role`).
3. Não tocar em grants nesta etapa (seção 4).

Verificado no código: `user_roles` e `user_units` só são escritas por `supabaseAdmin` (`bootstrapCompany` em `admin.functions.ts`, `pilot.functions.ts`), sempre **depois** do upsert do perfil com `company_id`. O cliente só faz `SELECT` dos próprios papéis. Logo as novas restrições não quebram os fluxos atuais.

## 3. O que a migration cria ou altera
**Novas** (`app_auth`, `SECURITY DEFINER`, `search_path = public, app_auth`, `EXECUTE` só para `authenticated` e `service_role`, nunca `anon`):
`has_role_in(user, company, role)`, `has_any_role_in(company, roles[])`, `is_company_admin_in(company)`, `can_manage_payroll_in(company)`, `can_see_all_units_in(company)`, `user_belongs_to_company(user, company)`, `unit_in_company(unit)`.

**Reescritas, mesma assinatura:** `is_company_admin()`, `can_manage_payroll()`, `can_see_all_units()`, `has_role(uuid, app_role)` (agora filtradas pela empresa ativa) e `has_unit_access(uuid)` (agora exige que a unidade seja da empresa ativa).

**Políticas substituídas:** `user_roles_admin_manage`, `user_units_select`, `user_units_admin_manage`.
- `user_roles`: o alvo precisa ser da empresa (`user_belongs_to_company`); só `owner` cria, altera ou apaga papéis `owner`.
- `user_units`: toda operação exige `unit_in_company(unit_id)` e usuário alvo da mesma empresa; a leitura global some.

**Triggers novos:** `enforce_user_role_company` (`user_roles`) e `enforce_user_unit_company` (`user_units`), `BEFORE INSERT OR UPDATE`, rejeitam linhas cujo usuário e empresa/unidade não coincidem. Não validam linhas existentes (verificado: nenhuma inconsistente).

**Recursão de RLS:** as funções são `SECURITY DEFINER` de dono `postgres`, dono também das tabelas, sem `FORCE ROW LEVEL SECURITY` (verificado em `pg_class`), portanto leem `user_roles`/`profiles`/`units` sem reentrar nas políticas. `pg_temp` não precisa ser acrescentado porque todos os objetos são qualificados por schema ou resolvem em `public`/`app_auth`.

## 4. Análise de grants (nada será revogado nesta etapa)
Uso real no código: o navegador usa a chave publishable com o JWT do usuário (papel `authenticated`); `anon` não consulta tabelas; Portal do Colaborador, webhook Stripe, assinaturas e PIN passam por `supabaseAdmin` (`service_role`).

| Grant atual | Proposta de menor privilégio | Fluxo que poderia ser afetado | Risco |
|---|---|---|---|
| `anon`: INSERT/UPDATE (e demais) em ~todas as tabelas de `public` | `REVOKE ALL ON ALL TABLES/SEQUENCES IN SCHEMA public FROM anon` + `ALTER DEFAULT PRIVILEGES … REVOKE … FROM anon` | Nenhum conhecido; confirmar com os e2e de landing/login/portal | Baixo |
| `authenticated`: INSERT/UPDATE em `subscriptions` | Revogar INSERT/UPDATE/DELETE (manter SELECT). Escrita só pelo webhook (`service_role`) | Nenhum: `billing.functions.ts` e webhook usam `supabaseAdmin` | Baixo |
| `authenticated`: UPDATE em `companies` (inclui colunas de cobrança) | Restringir a colunas de marca/fuso (`name, brand_*, *_color, timezone, fixed_schedule_mode, single_unit_mode`) | Tela de configurações da empresa (confirmar colunas) | Médio |
| `authenticated`: INSERT/UPDATE de `portal_pin_hash`, `portal_failed_attempts`, `portal_locked_until` em `employees` | `REVOKE INSERT, UPDATE` dessas colunas (PIN é definido por `admin.functions.ts` via `supabaseAdmin`) | Cadastro/edição de colaborador no painel, se enviar essas colunas | Médio |
| `authenticated`: INSERT/UPDATE em `user_roles`, `user_units` | Opção forte: revogar tudo (o app nunca escreve pelo cliente) | Futura tela de convite de usuários | Baixo hoje |
| `authenticated`: UPDATE de `companies.status/is_demo/document` | Incluído na restrição de colunas acima | — | — |

## 5. Riscos de regressão
- **Usuários com múltiplas empresas:** hoje não existem (1 perfil = 1 `company_id`). O escopo adotado é a empresa ativa (`current_company_id()`). O trigger `enforce_user_role_company` impediria papéis em empresa diferente da do perfil: se o produto adotar multiempresa (Hub), a regra precisará migrar para uma tabela de membros.
- Restringir papéis `owner` a owners muda o comportamento de admins que hoje poderiam editá-los. Nenhum código usa esse caminho.
- `has_unit_access` passa a fazer um JOIN em `units` por avaliação de política (impacto de desempenho pequeno nos volumes atuais).
- Qualquer script que insira papel/unidade antes de criar o perfil falharia nos triggers (os fluxos atuais criam o perfil antes).
- A migration nunca foi executada: pode ter erro de sintaxe/permissão.

## 6. Plano de testes (duas empresas fictícias A e B, dados sintéticos)
Executar **em branch/projeto de desenvolvimento ou banco descartável**, nunca no Cloud de produção. Sessão de teste: `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}', true);` dentro de transações com `ROLLBACK`.

Massa: empresas A e B; em cada uma, owner, admin, `hr`, `staff` com perfil, `user_roles` e `user_units`; um colaborador com PIN no Portal.

| # | Cenário | Esperado |
|---|---|---|
| 1 | Admin A lê `user_roles` | Vê só os de A |
| 2 | Admin A lê `user_roles` de B | 0 linhas |
| 3 | Admin A insere papel `admin` para usuário de B (`company_id` = A ou B) | Erro de RLS / trigger |
| 4 | Admin A faz SELECT/INSERT/UPDATE/DELETE em `user_units` de B | 0 linhas / erro |
| 5 | Admin B segue gerenciando papéis e unidades de B | Sucesso |
| 6 | Colaborador (`staff`) lê só o permitido (os próprios papéis, unidades vinculadas) | Sem acesso a dados de RH/folha |
| 7 | Portal do Colaborador (CPF+PIN, ponto, holerite) via e2e `portal-*.spec.ts` | Sem regressão (usa `service_role`) |
| 8 | Folha: `payslips` visível para owner/admin/hr de A, não para `staff`, nada de B | Conforme `can_manage_payroll` |
| 9 | Gestão de unidades (`units`, `user_units` próprias) e `has_unit_access` do gerente | Sem regressão |
| 10 | Usuário com papel plantado em outra empresa (inserido por `service_role` em teste, deve ser rejeitado pelo trigger) e, se multiempresa for introduzido, escopo da empresa ativa | Trigger rejeita; funções ignoram papéis de outras empresas |
| 11 | Fluxos `bootstrapCompany` e provisionamento piloto de ponta a ponta | Perfil → papel → unidade sem erro |
| 12 | `get_advisors` e novas consultas em `pg_policies` | Sem política nova permissiva |

## 7. Critérios de aprovação
- Revisão humana do SQL (inclusive as decisões da seção 8).
- Replay das 30 migrations + rascunho num banco descartável sem erro.
- Os 12 cenários passam; e2e do portal e smoke passam; `typecheck`, `lint`, `build` passam.
- Consulta final mostra 0 linhas cruzadas em `user_roles`/`user_units` e nenhuma função `app_auth` de papel sem escopo.
- Plano de rollback registrado (comentário no fim da migration) e backup/ponto de restauração confirmado antes de aplicar.

## 8. Decisões humanas pendentes
1. Aprovar o SQL e o ambiente de ensaio (branch Supabase ou Postgres descartável).
2. Restringir papel `owner` a owners: sim/não.
3. Revogar escrita de `authenticated` em `user_roles`/`user_units` (opção forte) ou manter políticas escopadas.
4. Aprovar o pacote de revogação de grants (seção 4) como migration separada.
5. Resolver os timestamps das migrations de automação (`docs/FASE1_RECONCILIACAO_MIGRATIONS.md`, seção 4).
6. Definir o modelo de multiempresa antes do Hub.
