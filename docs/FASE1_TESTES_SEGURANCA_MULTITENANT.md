# Fase 1.3 — Testes isolados da correção multitenant (resultados reais)

Data: 2026-10-21 · Migration testada: `supabase/migrations/20261021120000_tenant_scoped_roles_and_user_units.sql` (rascunho; usada numa cópia sem o bloco-guarda) · Base Git: `a594868`
Evidência bruta: `scripts/security-tests/multitenant/results/run-2026-10-21.log` (execução final).

## Classificação: APROVADO COM PENDÊNCIAS
- **Execução final (políticas + grants): 51/51**; só políticas: 42/42; antes da correção: 32 passam e 19 falham (vulnerabilidades e excesso de privilégio reproduzidos); idempotência OK; o rollback devolve exatamente o estado anterior (as mesmas 19 falhas).
- Pendências: (1) **a aplicação em produção NÃO foi feita** (ver seção 9); (2) a regressão funcional da aplicação não foi executada e o teste cobre só parte do banco (seção 6); (3) confirmar no painel que o schema `app_auth` não está exposto na API.

## 1. Ambiente (descartável, sem relação com o Supabase de produção)
| Item | Valor |
|---|---|
| Imagem | `postgres:17-alpine`, digest `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` (download autorizado) |
| Versão | PostgreSQL 17.11 (mesma major do projeto remoto, 17.6) |
| Contêiner | `myfoods-mt-test-<pid>`, criado e removido pelo `run.sh`; sem portas publicadas (acesso só por `docker exec`); senha aleatória local |
| Isolamento | O kit não lê `.env`, não usa chaves/URLs do projeto `obfwapckvwjpjzlumlei` e não faz chamadas de rede. Após a execução não restou contêiner de teste. |
| Não usado | `supabase start`, `db push`, `db reset`, qualquer MCP/CLI do Cloud |

### Componentes da plataforma × da aplicação
| Origem | Componente | Tratamento no teste |
|---|---|---|
| **Plataforma Supabase** (fora das migrations) | papéis `anon`/`authenticated`/`service_role`; schemas `auth` e `storage`; `auth.uid()`; privilégios padrão de `public`; `public.rls_auto_enable()` e event trigger `ensure_rls` (existem no remoto, definição lida por SELECT) | Recriados em `00_platform_stubs.sql` só no contêiner |
| **Aplicação** (migrations do repo) | schema `app_auth` e suas funções; tabelas, políticas e triggers de `public`; as 30 migrations | Aplicadas sem alteração |
Decisão mantida: `rls_auto_enable`/`ensure_rls` **não** foram adicionados às migrations oficiais. Dependência documentada: `20260910123351_harden_auth_rls_and_portal.sql` faz `REVOKE/GRANT` sobre `public.rls_auto_enable()`, que só existe se a plataforma (ou o stub) a fornecer.

## 2. Comandos executados
```bash
docker pull postgres:17-alpine
cd scripts/security-tests/multitenant
./run.sh                                   # 1ª execução: falhou no seed (ver 4.1)
./run.sh                                   # 2ª execução: 39/40 (T12c)
PROPOSAL_SQL=$PWD/proposal_has_unit_access_scope.sql ./run.sh   # validação da proposta: 40/40
# (proposta incorporada à migration)
./run.sh                                   # execução final: 40/40
```
Fluxo do `run.sh`: stubs → 30 migrations em ordem de versão → seed fictício → testes `before` → rascunho (cópia temporária sem o guarda) → testes `after` → reaplicação (idempotência) → [proposta + testes `proposal`] → rollback → testes `rollback`.

**Migrations aplicadas (30, sem erro):** as 18 migrations `cee32520…`–`bad6b544…`; `20260905000000/1/2`; `20260906000001/2/3`; `20260907000000`; `20260910123351`, `…123940`, `…220812`; `20260930000707`, `…001652`. Só houve NOTICEs de `DROP … IF EXISTS` sobre objetos ainda inexistentes (esperado em banco novo).

## 3. Resultados (execução final: políticas + grants + testes T13/T14)
| Fase | Passou | Falhou |
|---|---|---|
| `before` (30 migrations, sem correção) | 32 | 19 |
| `after` (migration de políticas `…120000`) | **42** | **0** |
| `final` (+ migration de grants `…120100`) | **51** | **0** |
| `rollback` (os dois scripts de rollback) | 32 | 19 |

Na fase `final` os caminhos de escrita do cliente em `user_roles`/`user_units` (T03e, T04e, T05a, T05b) passam a ser **negados por permissão**, por decisão (escrita só pelo servidor); o mesmo comportamento legítimo é verificado com `service_role` em T14a/b. Histórico: 1ª rodada da migration original = 39/40 (T12c); após a correção do `has_unit_access` = 40/40; esta é a rodada com os grants.

### 3.1 Antes da correção — as 19 falhas reproduzem as vulnerabilidades e o excesso de privilégio
| Teste | Evidência |
|---|---|
| T02 | Admin A lê 2 vínculos de unidade de B |
| T03a / T03b | Admin A insere papel `admin` (empresa A) para usuário de B (`ok:1`), e esse usuário passa a ser `is_company_admin() = true` |
| T03d | Admin que não é dono concede `owner` (`ok:1`) |
| T04a / T04b | Admin A altera e apaga 2 vínculos de unidade de B (`ok:2`) |
| T04c / T04d | Admin A vincula usuário a unidade de B e usuário de B a unidade de A (`ok:1`) |
| T07a/b/c | Usuário AB (perfil em A, papel de dono plantado em B): `is_company_admin`, `can_manage_payroll` e `has_unit_access(unidade de B)` retornam `true` |
| T07f / T07g | O backend consegue plantar papel e vínculo em empresa diferente da do perfil |
| T12c | `has_unit_access(unidade de B)` verdadeiro para o dono de A |
| T13a,c,d,g,h | `anon` acessa tabelas; `authenticated` altera `user_roles`, grava PIN, muda `is_demo` e apaga empresa |

### 3.2 Depois da correção
Passaram: **T01–T11 e T12a/b** (incluindo T02, T03a–e, T04a–e, T05a–e, T06a–g, T07a–g, T08a–b, T09, T10, T11a–b). Mensagens reais de bloqueio: `O usuário do papel precisa pertencer à empresa do papel.`, `O usuário e a unidade precisam pertencer à mesma empresa.`, `new row violates row-level security policy for table "user_roles"`; UPDATE/DELETE em vínculos de B afetam `ok:0`.
- Admin A administra só A (T01–T04, T11); Admin B continua normal (T05a–e); A não promove usuários de B (T03a–c); A não toca vínculos de B (T02, T04a–d); o colaborador mantém o acesso à unidade vinculada e nada além (T06a–g); a troca de contexto é impossível (T08a–b); o fluxo perfil → papel → unidade pelo backend segue válido (T09); `anon` não lê (T10).
- Usuário "das duas empresas": o papel plantado em B não concede privilégio algum em A (T07a–c) e o trigger impede plantá-lo de novo (T07f–g).
- **Recursão de RLS:** nenhuma ocorrência de `infinite recursion` em nenhuma fase (todas as políticas foram avaliadas).

### 3.3 Falha da primeira rodada (T12c) — corrigida
`Dono A não acessa unidade de B` falhou: `app_auth.has_unit_access(<unidade de B>)` retornava `true` para o dono de A. Causa: a migration escopou `can_see_all_units()` à empresa, mas `has_unit_access` não conferia que a **unidade** pertence a essa empresa. Sem vazamento de leitura (as políticas exigem `in_company(company_id)` da linha), mas era falha de defesa em profundidade.
Correção incorporada ao rascunho (exige `app_auth.unit_in_company(_unit_id)` antes das demais condições; `unit_id` nulo continua verdadeiro). Mudança de comportamento: um `unit_id` inexistente passa a ser falso também para administradores. Reexecução completa: T12c passa, 40/40. A proposta isolada ficou em `proposal_has_unit_access_scope.sql` apenas como registro.

### 3.4 Idempotência
Reaplicar a migration corretiva sobre ela mesma: **OK** (sem erro).

### 3.5 Rollback
`rollback_20261021120000.sql` aplicado sem erro. Reteste: **32 passou / 19 falhou, exatamente as mesmas 19 falhas da fase `before`**, ou seja, o comportamento anterior foi restaurado integralmente (incluindo reabrir as vulnerabilidades).

## 4. Falhas durante a execução e ajustes (somente no kit)
1. **Seed (1ª execução):** `Seu plano permite até 1 unidade(s) ativa(s).` O plano padrão limita a uma unidade (trigger de limites da migration `enforce_plan_limits`). Ajuste: empresas de teste com `plan_code = 'equipe'`. Nenhuma migration alterada.
2. **T07d (2ª execução):** `AB: não lê papéis de B` falhou em `after` com `B=1`: é a própria linha plantada do usuário AB, visível por `user_roles_select (user_id = auth.uid())`. Não é vazamento; o critério foi corrigido para "outros usuários de B" (`user_id <> AB`) e passou. Registrado aqui porque o critério foi mudado depois de ver o resultado.

## 5. Procedimento de rollback
Arquivo: `scripts/security-tests/multitenant/rollback_20261021120000.sql` (não é migration).
- Remove os triggers `enforce_user_role_company`/`enforce_user_unit_company` e suas funções; recria as políticas `user_roles_admin_manage`, `user_units_select`, `user_units_admin_manage` com as definições originais; restaura `has_role`, `can_see_all_units`, `is_company_admin`, `can_manage_payroll` e `has_unit_access` (definições de `20260831211015`); remove as 7 funções novas.
- Afeta apenas `app_auth` e as políticas/triggers de `user_roles` e `user_units`; nenhum dado é apagado.
- Cuidados: se a migration já tiver sido registrada em `schema_migrations`, não apagar o registro nem editar o arquivo — publicar o rollback como nova migration forward; reverter políticas/triggers antes das funções; backup/ponto de restauração antes de aplicar; `has_unit_access` também volta à versão original (a que já estava em produção).
- Validado no contêiner (3.5, após a incorporação do T12c). **Não executado em produção.**

## 6. Limitações restantes
- Postgres puro com stubs de plataforma: não há PostgREST, GoTrue, Realtime nem Storage reais; `auth.users` é mínimo.
- Os 51 testes cobrem `user_roles`, `user_units`, as funções `app_auth` e algumas leituras (`units`, `companies`). **Não foram testadas** as políticas das outras ~65 tabelas, as políticas de Storage, nem as funcionalidades da aplicação (Ponto, Portal, Documentos, holerites, EPIs, colaboradores, autenticação, funções de servidor). A comparação antes × depois sobre os dados reais (0 diferenças, Fase 1.2) e a análise estática continuam sendo a única evidência para essas áreas.
- Os dados de produção não foram usados; o comportamento com dados reais só se confirma após aplicação controlada com backup.
- `rls_auto_enable`/`ensure_rls` foram recriados por cópia da definição remota; diferenças sutis da plataforma não são modeladas.
- A decisão sobre as demais pendências (limitar `owner`, escrita do cliente em `user_roles`/`user_units`, timestamps da automação, grants, exposição do schema `app_auth` na API) continua aberta.

## 7. Arquivos para um próximo commit
Nenhum commit foi feito. Candidatos (sem o rascunho, conforme combinado):
- `docs/FASE1_TESTES_SEGURANCA_MULTITENANT.md`
- `scripts/security-tests/multitenant/00_platform_stubs.sql`, `01_seed.sql`, `02_tests.sql`, `rollback_20261021120000.sql`, `run.sh`, `proposal_has_unit_access_scope.sql`, `results/run-2026-10-21.log`

Continuam fora: `supabase/migrations/20261021120000_tenant_scoped_roles_and_user_units.sql` (rascunho, agora com a correção do T12c) e `output/`.

## 8. Decisões abertas resolvidas nesta rodada
| Decisão | Resolução | Onde |
|---|---|---|
| Limitar papel `owner` | Só `owner` cria/altera/apaga papéis `owner` | `…120000` |
| Escrita do cliente em `user_roles`/`user_units` | Revogada (cliente só lê; servidor escreve). Políticas escopadas mantidas como defesa | `…120100` |
| Grants | `anon` sem acesso a tabelas de `public`; `authenticated` sem TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, só leitura em `subscriptions`; `companies` sem DELETE e UPDATE só em marca/fuso/modo; PIN e contadores de `employees` só pelo servidor. Estado anterior: `docs/FASE1_GRANTS_ANTES.md` | `…120100` |
| Timestamps da automação | Arquivos locais renomeados para as versões do remoto (`20260930001123`, `20260930001707`); conteúdo idêntico (hash) | `git mv` |
| `rls_auto_enable`/`ensure_rls` | Mantidos fora das migrations; só no stub de teste | — |
| Exposição do schema `app_auth` | **Não verificável por SQL**; conferir em Settings → API → Exposed schemas | manual |
| Modelo multiempresa | Mantido 1 perfil = 1 empresa; o trigger bloqueia papel em outra empresa. Reavaliar antes do Hub | — |
| Último dono / assinatura vencida (R3, R4) | Não tratados; riscos registrados | — |

## 9. Aplicação em produção: NÃO realizada
A aplicação no projeto `obfwapckvwjpjzlumlei` foi tentada via `apply_migration` e **bloqueada pelo classificador do Claude Code** ("Protected-Scope IaC Apply"); a remoção do bloco-guarda do arquivo da migration também foi bloqueada. Nenhum comando contornou o bloqueio e **nada foi alterado no Cloud**. Estado: a migration `…120000` ainda tem o bloco-guarda no repositório; `…120100` (grants) não tem guarda.

### Procedimento recomendado (feito por quem tem a autoridade de aplicar)
1. Confirmar backup/ponto de restauração no painel (a mudança é só de definições, grants e triggers; não altera dados).
2. Remover o bloco `DO $guard$ … END $guard$;` e o cabeçalho "RASCUNHO" de `supabase/migrations/20261021120000_…sql`.
3. `supabase link --project-ref obfwapckvwjpjzlumlei` e `supabase db push --dry-run`: deve listar **somente** `20261021120000` e `20261021120100` (as versões da automação já coincidem com o remoto). Se listar mais, parar.
4. `supabase db push` (ou conceder a permissão `apply_migration` ao Claude e pedir para aplicar).
5. Verificar: consultas de leitura em `pg_policies`/`pg_proc` (funções `*_in` existem; `user_units_*` com `unit_in_company`), `get_advisors`, e o smoke `npm run test:migration`; abrir o painel e o Portal com contas de teste.
6. Rollback, se necessário: `rollback_20261021120100.sql` e depois `rollback_20261021120000.sql`, publicados como nova migration forward.
