# Fase 1.2 — Revisão técnica da migration de segurança multitenant

Data: 2026-10-21 · Arquivo revisado: `supabase/migrations/20261021120000_tenant_scoped_roles_and_user_units.sql` (rascunho NÃO APROVADO) · Commit de referência `e24761b`
Escopo: análise e validação. Nenhum SQL foi aplicado no Cloud. O remoto foi consultado só com `SELECT`.
Limite do ambiente: não há Postgres local nem imagem Docker de Postgres; baixar uma exigiria autorização. **Não houve execução técnica do SQL**; a validação é por leitura das definições reais, por consultas de leitura ao catálogo e por uma comparação "antes × depois" calculada sobre os dados atuais.

## 1. Resultado da revisão do SQL

| Item | Veredito |
|---|---|
| Isolamento por `company_id` | OK. Papéis passam a exigir `user_roles.company_id = empresa ativa`; `user_units` passa por `units.company_id`. |
| `auth.uid()` | OK. Sem sessão (`NULL`), todas as funções `*_in` retornam falso (`auth.uid() IS NOT NULL`). `has_role_in`/`user_belongs_to_company` não usam sessão por serem consultas puras; ver achado R2. |
| Integridade usuário↔empresa | OK. Triggers em `user_roles` e `user_units` valem também para `service_role`. |
| `SECURITY DEFINER` e `search_path` | OK. Todas fixam `search_path` (`public`/`public, app_auth`); chamadas de função qualificadas; sem SQL dinâmico. |
| Permissões de execução | OK. `REVOKE … FROM PUBLIC, anon`; `GRANT` só a `authenticated` e `service_role`. As funções legadas mantêm o ACL (o `CREATE OR REPLACE` não o altera). `anon` nem tem `USAGE` em `app_auth` (verificado). |
| Recursão de RLS | Sem risco. Dono das funções e das tabelas é `postgres` (`BYPASSRLS = true`), nenhuma tabela envolvida tem `FORCE ROW LEVEL SECURITY` (verificado). Funções SQL `SECURITY DEFINER` não são inlinadas, então as políticas não reentram. |
| Compatibilidade com `app_auth` existente | OK. Mesmas assinaturas e nomes de parâmetros para `is_company_admin`, `can_manage_payroll`, `can_see_all_units`, `has_role`, `has_unit_access`. A ordem de criação no arquivo respeita as dependências (as `_in` antes das legadas). |
| Compatibilidade com migrations recuperadas | OK. `harden_auth_rls_and_portal` redefine só `has_any_role` e políticas de outras tabelas; nenhuma colide com `user_roles`/`user_units`. `enforce_admin_plan_limit` (trigger em `user_roles`) segue funcionando em conjunto com o novo trigger. |
| Idempotência | OK. `CREATE OR REPLACE`, `DROP POLICY/TRIGGER IF EXISTS`. Reaplicar não duplica nada. |
| Usuário sem empresa selecionada | OK. `current_company_id()` nulo faz `is_company_admin`, `can_manage_payroll`, `can_see_all_units` e `unit_in_company` retornarem falso. Hoje há 8 perfis sem empresa (cadastrados e não onboarded): nenhum tem papéis. |

### Ajuste feito no rascunho
- **R1 (corrigido):** removi `BEGIN;`/`COMMIT;` explícitos. O executor de migrations já é atômico por arquivo; um `COMMIT` interno poderia confirmar antes do registro da versão em `schema_migrations`. O bloco-guarda do início permanece.

### Pontos de atenção (sem alteração)
- **R2 — oráculos de pertinência.** `has_role_in(user, company, role)` e `user_belongs_to_company(user, company)` recebem IDs arbitrários e são executáveis por `authenticated` (necessário para o RLS). Se o schema `app_auth` for exposto na Data API, qualquer logado poderia consultar papéis/pertinência de outro usuário. O risco já existia com `has_role(uuid, role)`. `supabase/config.toml` não define `[api] schemas` (padrão: `public`, `graphql_public`), mas **a configuração do projeto remoto não é legível por SQL**: confirmar no painel (Settings → API → Exposed schemas) que `app_auth` não está listado.
- **R3 — assinatura vencida.** `unit_in_company` e `is_company_admin_in` não consultam `has_valid_access`. Em `user_roles`, o `in_company` da política cobre isso; em `user_units` não (como antes). Efeito: admin de empresa com assinatura vencida ainda gerencia vínculos de unidade da própria empresa. Sem impacto entre empresas.
- **R4 — último dono.** Um `owner` pode apagar o próprio papel e deixar a empresa sem dono. Já ocorria antes; sugere-se uma trava em fase futura.
- **R5 — `has_unit_access(NULL)` retorna verdadeiro**, como antes. Linhas com `unit_id` nulo ficam visíveis a toda a empresa (sempre combinado com `in_company`).
- **R6 — desempenho.** Mais chamadas aninhadas e um JOIN com `units` por avaliação; volume atual (6 empresas) é irrelevante, mas medir antes de escalar.

## 2. Evidências empíricas (consultas de leitura no Cloud)
- 69 tabelas; 80 políticas e 1 função (`has_unit_access`) dependem das funções que mudam. Todas as políticas listadas combinam o predicado com `in_company(company_id)` ou com a empresa da própria linha.
- Dados atuais: 14 perfis, 6 empresas, 6 papéis (todos `owner`), 6 `user_units`. 0 usuários com papéis em mais de uma empresa; 0 papéis ou vínculos órfãos ou cruzados; 8 perfis sem empresa e sem papéis.
- **Equivalência antes × depois sobre os dados reais** (cálculo inline, sem criar objetos): `is_company_admin` e `can_manage_payroll` diferem em 0 de 14 usuários; acesso a unidades (`has_unit_access`) difere em 0 de 6 pares usuário×unidade. Ou seja, **nenhum acesso legítimo atual muda**.
- Restrições existentes: `user_roles` tem `UNIQUE(user_id, role, company_id)` e FK `company_id → companies ON DELETE CASCADE`; `user_units` tem `UNIQUE(user_id, unit_id)` e FK de unidade com cascade; `profiles.company_id` é `ON DELETE SET NULL`.

## 3. Matriz multitenant (conceitual — execução técnica pendente de ambiente isolado)
Atores fictícios: Admin A, Admin B, Colaborador A, Colaborador B, Usuário AB (papel nas duas empresas).

| # | Cenário | Mecanismo que decide | Esperado após a migration |
|---|---|---|---|
| 1 | Admin A lê seus papéis | `user_roles_select`: `in_company` + `is_company_admin` | Vê apenas A |
| 2 | Admin A lê papéis admin de B | `in_company(company_id)` falso; `is_company_admin` ignora linhas de B | 0 linhas |
| 3 | Admin A promove usuário de B | `user_belongs_to_company(user, A)` falso + trigger | Negado pela política e pelo trigger |
| 3b | Admin A promove usuário de A a `owner` | exige `has_any_role_in(A, owner)` | Negado (só owner promove owner) |
| 4 | Admin A altera/apaga/insere `user_units` de B | `unit_in_company(unit)` falso + trigger | Negado; leitura retorna 0 linhas |
| 5 | Admin B administra B | mesmas políticas em B | Funciona |
| 6 | Colaborador A (`staff`) | `has_any_role_in` falso; vê só o que `in_company`+`has_unit_access` permitem | Sem acesso administrativo; acesso às unidades vinculadas preservado |
| 7 | Usuário AB | Estruturalmente impossível: o perfil tem 1 `company_id` e o trigger rejeita papel fora dessa empresa | A tentativa de criar o vínculo falha; escopo = empresa do perfil |
| 8 | Trocar de contexto | `profiles.company_id`: `authenticated` só atualiza 4 colunas, trigger bloqueia mudança, INSERT/DELETE revogados (confirmado em `column_privileges`) | Sem caminho cliente para trocar de empresa; `active_unit_id` é validado contra a empresa |

Para executar tecnicamente: Postgres descartável com stubs de `auth.uid()`/papéis, ou branch Supabase de desenvolvimento, aplicando as 30 migrations + o rascunho sem o bloco-guarda.

## 4. Regressão por área
Base: toda política que usa as funções alteradas também exige `in_company`, então só o escopo dos papéis muda, e hoje 0 usuários são afetados.

| Área | Dependência | Risco |
|---|---|---|
| MyFoods Ponto (`time_entries`, `shifts`, `schedules`, `point_cards`, `point_policies`) | `has_unit_access`, `has_any_role` | Nenhum com os dados atuais; marcação pelo portal usa `service_role` |
| Portal do Colaborador | `service_role` (CPF+PIN, sessões, rate limit) | Nenhum direto; rodar `portal-*.spec.ts` |
| Documentos / Conformidade (`occupational_documents`, `document_*`, `uniform_*`, EPIs `item_deliveries`) | `is_company_admin`, `has_role(…,'hr')` | Nenhum com os dados atuais |
| Holerites (`payslips*`) | `can_manage_payroll`, `is_company_admin`, `has_role` | Nenhum atual; validar cenário de RH |
| Gestão de colaboradores (`employees`, `roles`, `teams`) | `has_unit_access`, `has_any_role` | Nenhum |
| Gestão de unidades (`units`, `user_units`) | `is_company_admin`, `has_unit_access` | Alterada de propósito (política de `user_units`); `bootstrapCompany` e conta piloto gravam perfil→papel→vínculo, ordem compatível com os triggers |
| Autenticação | `handle_new_user`, `profiles`, JWT | Sem mudança |
| Funções de servidor | `supabaseAdmin` (ignora RLS, mas dispara os triggers novos) | Falhariam apenas se inserissem papel/vínculo antes de gravar `profiles.company_id` — não é o caso hoje |

## 5. Grants (revisão)
O trecho 4 do pedido chegou truncado ("Confira se…"); revisei os grants conforme o plano anterior.
- O draft **não altera grants** (decisão correta para uma migration de política). Os ACLs das funções novas estão corretos (R2 à parte).
- Pendentes, em migration separada e já analisados em `FASE1_PLANO_CORRECAO_SEGURANCA.md`: `anon` com privilégios amplos em tabelas; `authenticated` com INSERT/UPDATE em `subscriptions`, `user_roles`, `user_units`; colunas de PIN em `employees`; colunas de cobrança e `status/is_demo` em `companies`. Código confirma que só `supabaseAdmin` usa esses caminhos.
- Se o item 4 pedia outra verificação, reenviar o texto completo.

## 6. Conclusão e próximos passos
- A lógica do SQL está consistente com as definições reais e preserva 100% dos acessos atuais; um ajuste (R1) foi feito, quatro pontos de atenção ficam registrados (R2–R6).
- **Falta**: execução técnica em ambiente isolado, confirmação de R2 no painel e as decisões do plano (`owner`, escrita do cliente, timestamps da automação, modelo multiempresa).
- Antes de qualquer aplicação: backup/ponto de restauração, remoção do bloco-guarda por pessoa aprovadora, e reexecução dos cenários 1–8 mais o e2e.
