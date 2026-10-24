# Fundação dos aplicativos do Grupo MyFoods — plano técnico (PARA APROVAÇÃO)

Data: 2026-10-24 · Base: `main` em `ecd651d` · Nada foi implementado.
Fontes lidas: `docs/MYFOODS_ARCHITECTURE.md`, `AGENTS.md`, `src/routes/_authenticated/*`, `src/components/app-shell.tsx`, `src/hooks/use-workspace.tsx`, `src/config/features.ts`, migrations de entitlements (`20260901211326`, `…211351`), landing (`src/routes/index.tsx`).

## 1. Estado atual (o que existe e importa para a mudança)
| Peça | Como está hoje |
|---|---|
| Autenticação | Supabase Auth único. Guarda `/_authenticated` (`route.tsx`, `ssr:false`) redireciona para `/auth`. Server functions usam `requireSupabaseAuth`. |
| Workspace | `WorkspaceProvider` (empresa, unidades, papéis, plano, entitlements) vive dentro de `/_authenticated/app.tsx`; o mesmo arquivo bloqueia sem assinatura e checa recurso por rota. |
| Rotas | Tudo em `/app/*` (36 telas): Ponto, escalas, colaboradores, documentos, holerites, EPIs, estoque, itens, vendas, unidades, configurações, admin piloto. |
| Menu | `app-shell.tsx`: um único menu "Gestão operacional" (5 itens). |
| Entitlements | Tabela `feature_entitlements(company_id, feature_code, enabled, source)`; 22 códigos granulares (`time_entries`, `inventory`, `payslips`…). No banco: `app_auth.has_feature(company, code)` nas políticas. Plano → códigos via `plan_feature_codes()`; troca de plano chama `apply_plan_entitlements()`, que **desliga todo código fora do plano, exceto `source = 'admin_grant'`**. |
| Papéis | `app_role`: `owner, admin, unit_manager, hr, stock_manager, supervisor, staff` (escopados por empresa desde a Fase 1). |
| Comercial | Venda pelo site desativada; checkout Stripe preservado no código, sem tela. Contratação por WhatsApp. |
| Domínio | Produção hoje em **`myfoodsai.com`** (Vercel). O pedido cita `myfoods.com.br` — ver decisão D1. |

## 2. Estrutura de diretórios proposta
O roteamento do TanStack Start exige arquivos em `src/routes`; eles ficam finos e importam as telas de `src/apps/<app>/`.
```
src/
  apps/
    registry.ts                 # manifesto: id, rota, nome, ícone, descrição, entitlement, status, papéis, menu
    painel/                     # central do cliente (hub)
    ponto/        pages/ components/ nav.ts
    documentos/   pages/ components/ nav.ts
    estoque/      pages/ components/ nav.ts
    compras/      (vazio até ser priorizado)
    caixa-financeiro/
      pages/ components/ nav.ts
      lib/*.functions.ts        # server functions do app
      lib/*.shared.ts           # tipos, rótulos, cálculos puros (testáveis)
  components/app-shell.tsx      # passa a receber o manifesto do app (menu e cor próprios + troca de app)
  hooks/use-workspace.tsx       # inalterado na essência; ganha hasApp()
  config/features.ts            # ganha códigos de app (app_*) e o mapa app → códigos legados
  routes/_authenticated/
    _workspace.tsx              # NOVO layout sem caminho: WorkspaceProvider + gate de empresa/assinatura
    _workspace/painel.tsx …     # rotas de cada app (arquivos finos)
    app.*.tsx                   # mantidos até a migração de cada app; depois viram redirecionamentos
```
Nada de banco, auth ou cliente Supabase duplicado: tudo continua em `src/integrations/supabase/*`.

## 3. Mapa de rotas
| Rota | Conteúdo | Origem |
|---|---|---|
| `/painel` | Central do cliente: cards dos 5 apps + atalhos de empresa | novo |
| `/painel/empresa`, `/painel/unidades`, `/painel/colaboradores`, `/painel/papeis` | Core compartilhado | `/app/units`, `/app/employees`, `/app/roles-teams`, `/app/settings/*` |
| `/painel/admin/piloto` | Admin da plataforma (+ ativar apps por empresa) | `/app/admin/piloto` |
| `/ponto` (+ `/registros`, `/cartoes`, `/escalas`, `/turnos`, `/modelos`, `/conformidade`, `/historico`, `/jornada`) | MyFoods Ponto | `/app/time-entries`, `point-cards`, `schedules*`, `shifts`, `settings/jornada` |
| `/documentos` (+ `/holerites`, `/exames`, `/epis`, `/regras-epi`, `/kits`, `/trocas`, `/pendencias`) | MyFoods Documentos | `/app/documentos/*`, `/app/conformidade/*`, `/app/deliveries*`, `/app/delivery-rules` |
| `/estoque` (+ `/itens`, `/movimentacoes`, `/alertas`) | MyFoods Estoque | `/app/inventory`, `/app/items` |
| `/caixa-financeiro` (+ `/caixa`, `/financeiro/*`) | MyFoods Caixa & Financeiro | novo (ver `CAIXA_FINANCEIRO_PLANO_TECNICO.md`) |
| `/compras` | "Em breve" (só card na central) | — |
| `/app/*` | Redireciona para a rota nova correspondente (links antigos, e-mails, `cancel_url` da Stripe) | legado |
| `/portal/*` | Portal do Colaborador — **inalterado** | — |

Vendas (`/app/sales`, plano Equipe) não pertence a nenhum dos 5 apps: proposta de mantê-la acessível em `/painel/vendas` até decidir se vai para Caixa & Financeiro ou para o Executive (D5).

## 4. Autenticação compartilhada
- Uma sessão Supabase para tudo; `/auth` e o login Google continuam iguais. Depois do login, destino padrão passa de `/app` para `/painel` (o onboarding também termina em `/painel`).
- `_authenticated` continua sendo a única guarda de sessão. O novo `_workspace` carrega `WorkspaceProvider` **uma vez** e é pai de todos os apps, então trocar de app não recarrega empresa/unidades/papéis.
- Server functions: mesmo middleware `requireSupabaseAuth`; cada app ganha `requireApp('<id>')` no servidor (consulta `app_auth.has_feature`), para que a proteção não dependa da interface.
- Portal do Colaborador (CPF + PIN, `service_role`) não muda.

## 5. Permissões (duas camadas)
1. **Acesso ao app** = empresa contratou (entitlement `app_<id>`) **e** o papel do usuário está na lista do manifesto. Ex.: Caixa & Financeiro → `owner, admin, unit_manager` (+ novos papéis da decisão D3); Documentos → `owner, admin, hr, unit_manager`; Estoque → `owner, admin, unit_manager, stock_manager`; Ponto → `owner, admin, hr, unit_manager, supervisor`.
2. **Ação dentro do app** = RLS no banco (`in_company`, `has_unit_access`, `has_any_role`, já escopados por empresa) + checagem na server function.
A interface só esconde; quem decide é o banco. Papéis continuam por empresa (a correção da Fase 1 vale para todos os apps).

## 6. Entitlements
- Novos códigos de produto: `app_ponto`, `app_documentos`, `app_estoque`, `app_compras`, `app_caixa_financeiro`. Os 22 códigos granulares continuam valendo **dentro** de cada app (ex.: `schedules_advanced` só no plano Essencial).
- Card na central: "Contratado" (entitlement ativo) · "Não contratado" (botão "Fale com a MyFoods" → WhatsApp) · "Em breve" (Compras).
- Migration aditiva (nova, sem tocar nas antigas):
  1. backfill: toda empresa ativa recebe `app_ponto` e `app_documentos`; quem tem `inventory`/`items` recebe `app_estoque` — ninguém perde acesso ao que usa hoje;
  2. `source = 'app_contract'` para esses registros;
  3. nova versão de `apply_plan_entitlements` que **não desliga** códigos `app_%` (hoje desligaria tudo que não for do plano ao trocar de plano).
- Ativação/desativação de app por empresa: tela no admin da plataforma (`/painel/admin`), via server function com `service_role` + `audit_logs`. Sem Stripe nesta fase.
- Cliente: `hasApp(id)` no `useWorkspace`; o fallback atual (sem linhas de entitlement → plano) ganha o mesmo mapa.

## 7. Plano de implementação (incremental, um app por vez)
| Etapa | Entrega | Risco | Validação |
|---|---|---|---|
| F1 Fundação | `registry.ts`, layout `_workspace`, `/painel` com cards, shell por app, `hasApp`, migration de entitlements de app + backfill; `/app` continua funcionando | baixo | typecheck/lint/build, e2e smoke, kit SQL (backfill e troca de plano não perdem apps) |
| F2 Mover apps existentes | Ponto → Documentos → Estoque para as rotas novas, um por PR, com redirecionamento de `/app/*` | médio (links e testes) | e2e por app + teste de redirecionamentos |
| F3 Caixa & Financeiro | conforme `CAIXA_FINANCEIRO_PLANO_TECNICO.md` | médio | testes SQL de isolamento + testes de cálculo + e2e |
| F4 Compras | quando priorizado | — | — |
Cada etapa: branch própria, testes no Postgres descartável, migrations aplicadas só com aprovação explícita, sem deploy sem autorização.

## 8. Decisões necessárias
- **D1 Domínio:** o site está em `myfoodsai.com`. O `myfoods.com.br` já é seu e está na Vercel? Ele substitui ou soma ao atual? (Rotas não dependem disso; SEO, `SITE_URL`, redirects de Auth e Stripe sim.)
- **D2 `/app`:** manter redirecionamentos permanentes (recomendado) ou desligar após um prazo.
- **D3 Papéis do financeiro:** criar `finance` (financeiro) e `cashier` (operador de caixa) no `app_role` — migration aditiva — ou usar os papéis atuais (`unit_manager`/`supervisor` operam caixa; só `owner/admin` veem financeiro).
- **D4 Ordem:** o pedido coloca Caixa & Financeiro como primeiro app. Recomendo F1 (fundação, pequena) antes, e só depois F3; F2 pode vir depois de F3.
- **D5 Vendas:** onde fica o módulo de vendas importadas.

## 9. Decisões registradas (2026-10-24)
| Decisão | Resposta | Efeito no plano |
|---|---|---|
| D1 Domínio | Continua **`myfoodsai.com`** (não `.com.br`) | `SITE_URL`, redirects de Auth e Stripe ficam como estão |
| D2 `/app` | Redirecionar **para sempre** | Ver tabela abaixo |
| D3 Papéis | Criar **`cashier`** (operador de caixa) e **`finance`** (financeiro) | Migration aditiva `ALTER TYPE app_role ADD VALUE` (migration própria, antes das tabelas que usam os papéis) |
| D5 Vendas | **Vai para o Caixa**, com dashboard próprio | `/app/sales` → `/caixa-financeiro/caixa/vendas`; recurso `sales` passa a fazer parte do app Caixa & Financeiro |
| — Financeiro | Lado Financeiro centrado em **dashboard** | Ver `CAIXA_FINANCEIRO_PLANO_TECNICO.md` |

### O que precisa de redirecionamento e por quê
| Endereço antigo | Quem ainda usa | Destino | Manter |
|---|---|---|---|
| `/app` (exato) | link de confirmação de e-mail do cadastro (`auth.tsx`), retorno da Stripe (`success_url`, `return_url`), e-mails já enviados, favoritos | `/painel` | para sempre |
| `/app/<tela>` (todas as 36) | favoritos e links compartilhados entre gestores | rota equivalente do app (mapa da seção 3) | para sempre |
| `/app/<desconhecido>` | — | `/painel` | para sempre |
| `/portal/*`, `/auth`, `/onboarding` | Portal do Colaborador, login | **sem mudança** | — |
Implementação: um único redirecionamento central (mapa antigo → novo) em vez de 36 arquivos. No código, `emailRedirectTo`, `success_url` e `return_url` passam a apontar direto para `/painel` (alteração de código, sem mexer na configuração da Stripe). `supabase/config.toml` já aceita `https://myfoodsai.com/**`.

## 10. Execução da F1 (2026-10-24) — local, sem commit, nada aplicado no Supabase
| Item | Arquivos |
|---|---|
| Papéis `cashier` e `finance` | `supabase/migrations/20261024165246_app_roles_cashier_finance.sql`; enum espelhado em `src/integrations/supabase/types.ts` |
| Acesso por aplicativo | `supabase/migrations/20261024165301_app_entitlements.sql` (`plan_app_codes`, nova `apply_plan_entitlements` que preserva `app_%`, backfill) |
| Registro dos apps e regra de acesso | `src/apps/registry.ts` (+ `registry.test.ts`) |
| Códigos de app, mapa rota legada → app | `src/config/features.ts` |
| Compatibilidade de deploy | `src/hooks/use-workspace.tsx`: sem linhas `app_%` no banco, usa os apps padrão do plano |
| Portão comum | `src/components/workspace-gate.tsx` (usado por `/app` e `/painel`) |
| Central do cliente | `src/routes/_authenticated/painel.tsx`, `painel.index.tsx` |
| Ativação de apps por empresa | `src/routes/_authenticated/painel.admin.aplicativos.tsx`, `src/lib/apps-admin.functions.ts` (admin da plataforma, `audit_logs`) |
| Pós-login → `/painel` | `auth.tsx`, `onboarding.tsx`, `index.tsx`, `billing.functions.ts` (`success_url`/`return_url`), `supabase/config.toml` (localhost) |
| Menu lateral | `app-shell.tsx`: link "Central de aplicativos" e itens filtrados pelo app contratado |
| Testes | `scripts/security-tests/foundation/` (SQL, 11/11), `vitest` (10/10), smoke e2e com `/painel` (5/5) |

Pendente para a F2: mover as telas para `/ponto`, `/documentos`, `/estoque` com o redirecionamento central de `/app/*`, e checar o app também nas server functions existentes (`requireApp`). Hoje o bloqueio por app nas telas legadas é de interface; os dados continuam protegidos pelo RLS por empresa e pelos recursos do plano.

### Aplicação em produção (2026-10-24)
Autorizada pelo responsável. `app_roles_cashier_finance` registrada como `20261024165246` e `app_entitlements` como `20261024165301` (arquivos locais renomeados para essas versões). Verificação somente leitura: enum com `cashier` e `finance`; nova `apply_plan_entitlements` ativa; 6 empresas com os apps esperados (plano Começo: Ponto e Documentos; plano Equipe: Ponto, Documentos e Estoque); ninguém com Compras ou Caixa & Financeiro.
