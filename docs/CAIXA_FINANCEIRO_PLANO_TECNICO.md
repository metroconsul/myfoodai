# MyFoods Caixa & Financeiro — plano técnico (PARA APROVAÇÃO)

Data: 2026-10-24 · Rota: `/caixa-financeiro` · Depende da fundação (`docs/FUNDACAO_APLICATIVOS_PLANO.md`, etapa F1) · Nada foi implementado.

## 1. O que já existe e pode ser reaproveitado
- **Nenhuma tabela financeira** no projeto (nada de caixa, lançamentos, contas, formas de pagamento ou categorias). O módulo financeiro nasce do zero.
- **Reaproveitado:** empresas, unidades, papéis escopados, `app_auth.*` (`in_company`, `has_unit_access`, `has_any_role`, `has_feature`), `audit_logs`, `companies.timezone`, padrão de server functions com cliente do usuário (RLS se aplica), kit de testes SQL em Postgres descartável.
- **Vendas importadas** (`sales_orders`, `sales_daily_metrics`, conexões e importações): por decisão de 2026-10-24, o módulo de Vendas **passa a fazer parte do lado Caixa**, com dashboard próprio (`/caixa-financeiro/caixa/vendas`). As telas e tabelas existentes são reaproveitadas como estão. Os valores importados **não** viram movimentos de caixa automaticamente (não têm forma de pagamento e contariam a venda duas vezes); aparecem como indicadores de vendas ao lado do caixa.
- **Fornecedores** (`suppliers`, sem uso no código) e **custos de estoque** (`stock_movements`): não ligados agora. As tabelas novas têm `source`/`source_ref` para receber Estoque/Compras depois, sem integração fictícia.

## 2. Modelo de dados (migration aditiva, nova)
Valores em `numeric(14,2)`, sempre positivos; o sentido vem do tipo. Datas de período calculadas no fuso da empresa. Toda tabela tem `company_id` (e `unit_id` quando operacional), RLS ligada e trigger que confere que as referências (unidade, conta, categoria, sessão) são da mesma empresa — lição da Fase 1.

| Tabela | Para quê | Campos principais |
|---|---|---|
| `fin_accounts` | Onde o dinheiro está (caixa da unidade, conta bancária informada manualmente, cofre) | `unit_id?`, `name`, `kind` (`cash`,`bank`,`other`), `opening_balance`, `active` |
| `fin_categories` | Categorias de receita/despesa (padrão criado por empresa + personalizadas) | `kind` (`income`,`expense`), `name`, `parent_id?`, `is_system`, `active` |
| `payment_methods` | Formas de pagamento | `name`, `kind` (`cash`,`pix`,`debit`,`credit`,`voucher`,`other`), `settlement_account_id` (conta onde o valor cai), `active` |
| `cash_registers` | Caixas físicos por unidade | `unit_id`, `name`, `account_id` (conta `cash`), `active` |
| `cash_sessions` | Abertura → fechamento de um caixa | `register_id`, `unit_id`, `opened_by`, `opened_at`, `opening_amount`, `closed_by?`, `closed_at?`, `counted_total?`, `expected_total?`, `difference?`, `status` (`open`,`closed`), `notes`. **Único caixa aberto por registro** (índice parcial). |
| `cash_movements` | Tudo que acontece no caixa aberto | `session_id`, `type` (`sale`,`income`,`expense`,`withdrawal`=sangria,`supply`=suprimento), `payment_method_id`, `amount`, `category_id?`, `description`, `created_by`, `created_at`, `reversal_of?`. **Imutável**: correção por estorno. |
| `cash_session_counts` | Conferência por forma de pagamento no fechamento | `session_id`, `payment_method_id`, `expected`, `counted`, `difference` |
| `fin_entries` | Lançamentos financeiros (receitas, despesas, contas a pagar e a receber) | `kind`, `category_id`, `account_id?`, `unit_id?`, `description`, `counterparty`, `amount`, `competence_date`, `due_date?`, `status` (`pending`,`paid`,`canceled`), `paid_at?`, `payment_method_id?`, `recurrence_id?`, `source` (`manual`,`cash_session`; futuro `compras`,`estoque`), `source_ref?`, `created_by` |
| `fin_recurrences` | Modelos de lançamentos recorrentes | `kind`, `category_id`, `amount`, `frequency` (`weekly`,`monthly`,`yearly`), `day`, `starts_on`, `ends_on?`, `active` |

Regras:
- Contas a pagar = `fin_entries` `expense` + `pending`; a receber = `income` + `pending`. "Vencida" é calculada (`due_date < hoje`), não armazenada.
- Fechar o caixa gera, numa única transação (função SQL `SECURITY INVOKER`), um lançamento `paid` por forma de pagamento (`source = cash_session`) na conta de liquidação; sangria/suprimento movem valor entre a conta do caixa e a conta escolhida. Assim o Financeiro reflete o Caixa sem digitação dupla.
- Recorrências: lançamentos gerados de forma idempotente (único por `recurrence_id` + `competence_date`) até 60 dias à frente, quando o app é aberto. Sem cron novo nesta versão.
- Sessão fechada e movimentos não são editados; só `owner/admin` reabrem com motivo registrado em `audit_logs`.

## 3. Permissões (RLS + server functions)
- Toda política: `in_company(company_id)` **e** `has_feature(company_id, 'app_caixa_financeiro')`; operações de unidade também `has_unit_access(unit_id)`.
- Caixa (abrir, movimentar, fechar, ver vendas da unidade): `owner, admin, unit_manager` e o novo papel **`cashier`** (operador de caixa, aprovado). O operador vê só o caixa e as vendas das unidades vinculadas; não vê o Financeiro.
- Financeiro (dashboard, lançamentos, contas, categorias, relatórios): `owner, admin` e o novo papel **`finance`** (aprovado).
- Grants mínimos desde o início: `anon` sem acesso; `authenticated` sem TRUNCATE/REFERENCES/TRIGGER; sem UPDATE/DELETE em `cash_movements`.
- Escritas pelas server functions com o cliente do usuário (RLS vale) e registro em `audit_logs`.

## 4. Telas
| Rota | Conteúdo |
|---|---|
| `/caixa-financeiro` | Dashboard (seção 5) |
| `/caixa-financeiro/caixa` | Caixas da unidade: abrir (saldo inicial, responsável), situação atual |
| `/caixa-financeiro/caixa/$sessionId` | Caixa aberto: entradas, saídas, sangria, suprimento, venda por forma de pagamento, fechar com conferência |
| `/caixa-financeiro/caixa/historico` | Histórico de caixas com diferenças |
| `/caixa-financeiro/caixa/vendas` | Vendas importadas (módulo atual de `/app/sales`, reaproveitado) com dashboard de vendas |
| `/caixa-financeiro/financeiro/lancamentos` | Receitas e despesas (filtros por período, categoria, unidade) |
| `/caixa-financeiro/financeiro/pagar` e `/receber` | Contas a pagar / a receber, com baixa |
| `/caixa-financeiro/financeiro/fluxo` | Fluxo de caixa (realizado + previsto) |
| `/caixa-financeiro/financeiro/relatorios` | Relatórios por período e indicadores |
| `/caixa-financeiro/configuracoes` | Contas, categorias, formas de pagamento, caixas, recorrências |
Navegação: abas fixas **Caixa | Financeiro** no topo do app, com o menu próprio do Caixa & Financeiro.
- **Caixa:** operação do dia (abrir, movimentar, fechar, histórico) + **Vendas**, com dashboard de caixa e vendas.
- **Financeiro:** centrado em **dashboard** (seção 5); lançamentos, contas a pagar/receber, fluxo e relatórios ficam como telas de apoio a partir dele.

## 5. Dashboard — definições (regime de caixa nesta versão)
| Indicador | Definição |
|---|---|
| Saldo atual | Σ contas ativas (`opening_balance` + lançamentos `paid` de entrada − de saída) |
| Receitas do período | Σ `income` `paid` com `paid_at` no período |
| Despesas do período | Σ `expense` `paid` com `paid_at` no período |
| Resultado | Receitas − Despesas |
| Contas próximas do vencimento | `pending` com vencimento até hoje + 7 dias (vencidas destacadas) |
| Últimas movimentações | 10 últimos lançamentos pagos + movimentos de caixa |
| Situação do caixa | Caixas abertos por unidade, com valor esperado em dinheiro |
Indicadores de desempenho (relatórios): margem do período, despesas por categoria, comparação com o período anterior, ticket médio só quando houver dados de venda. Visão por competência fica para uma segunda versão.

## 6. Fora desta versão (precisa de aprovação específica)
Emissão fiscal, integração bancária/OFX, conciliação automática, processamento de pagamentos, maquininhas/TEF, integração com Vendas, Estoque, Compras e Executive.

## 7. Testes
- **SQL (kit em Postgres descartável, como na Fase 1.3):** isolamento A × B em todas as tabelas novas; papéis (operador não vê financeiro; staff não abre caixa); um caixa aberto por registro; imutabilidade de movimentos; fechamento gera os lançamentos certos; saldo e resultado conferem; recorrência não duplica.
- **Cálculos puros** (`lib/*.shared.ts`: totais, diferença de conferência, períodos no fuso): testes unitários — exige adicionar `vitest` como devDependency (D-CF3).
- **e2e (Playwright):** abrir caixa → movimentar → fechar → ver no dashboard; lançar e baixar conta a pagar. Precisa de um banco de desenvolvimento com Auth (stack local ou branch Supabase) — não roda contra produção.
- `typecheck`, `lint`, `build` e smoke a cada etapa.

## 8. Etapas
1. Migration + kit SQL de testes (sem tela).
2. Configurações (contas, categorias padrão, formas de pagamento, caixas).
3. Caixa (abrir, movimentar, fechar, histórico).
4. Financeiro (lançamentos, pagar/receber, recorrências).
5. Dashboard, fluxo e relatórios.
6. Revisão de segurança + aplicação da migration em produção (somente com autorização).

## 9. Decisões específicas
- ~~D-CF1~~ Papéis `cashier` e `finance`: **aprovados** (2026-10-24).
- **D-CF2** Fechamento de caixa gera lançamentos automaticamente (recomendado) ou só relatório.
- **D-CF3** Adicionar `vitest` para testes de cálculo.
- **D-CF4** Ambiente de dev com Auth para o e2e: stack local do Supabase (download de imagens) ou branch Supabase (possível custo).

## 10. Etapa 1 executada (2026-10-24) — local, sem commit, sem aplicar no Supabase
Migration `supabase/migrations/20261024172028_caixa_financeiro_core.sql` + kit `scripts/security-tests/caixa-financeiro/` (**34/34**). Kits anteriores reexecutados sem regressão (multitenant 51/51 na fase final; fundação 11/11).

Decisões de detalhe tomadas na implementação (revisáveis):
- **Sangria e suprimento** são sempre em dinheiro e exigem a conta de destino/origem (ex.: Cofre). No fechamento viram **transferências** entre contas, fora de receitas e despesas.
- **Fechamento** (`close_cash_session`, numa única transação): confere todas as formas com saldo, grava a conferência, lança receitas e despesas por forma de pagamento e categoria, lança as transferências e ajusta a **falta/sobra de dinheiro** na categoria "Diferença de caixa". Depois do fechamento, o saldo da conta do caixa é igual ao dinheiro conferido (teste C12).
- **Estorno** copia forma, valor e categoria do original; não há edição nem exclusão de movimentos.
- **Saldos** (`fin_account_balances`) só aparecem para dono, admin e financeiro.
- **Financeiro por unidade:** o papel `finance` vê lançamentos sem unidade e os das unidades vinculadas a ele; dono e admin veem todas.
- **Configuração inicial** (`fin_bootstrap_company`): contas "Conta bancária", "Cofre" e "Caixa — <unidade>", um caixa por unidade, 12 categorias e 5 formas de pagamento. Idempotente.
- **Recorrências** (`fin_materialize_recurrences`): mensal respeita o último dia do mês; idempotente; horizonte máximo de 400 dias.
- **Reabrir caixa** fechado: não implementado nesta etapa.
- Datas de lançamento no fuso da empresa (`companies.timezone`).

Próximas etapas: telas (configurações, caixa, vendas, financeiro/dashboard) e server functions; o card continua "Em breve" até lá.

## 11. Etapa 1 aplicada e etapa 2 (telas) — 2026-10-24
- **Produção:** `caixa_financeiro_core` aplicada como `20261024172028` (hash normalizado idêntico ao arquivo testado; 9 tabelas, 15 políticas, `anon` sem acesso). Função `cf_transfer_accounts` (lista de contas para sangria/suprimento, só nome e tipo) aplicada como `20261024172328`. Kit SQL: **37/37**.
- **Telas** (código local, sem commit): `/caixa-financeiro` (visão geral: saldo, receitas, despesas, resultado, contas a vencer, despesas por categoria, últimas movimentações, situação do caixa), `/caixa` (abrir), `/caixa/$sessionId` (movimentar, estornar, fechar com conferência), `/caixa/historico`, `/vendas` (módulo de vendas existente, agora também dentro do app; `/app/sales` continua igual), `/financeiro` (a pagar, a receber, pagos no período, cancelados; novo lançamento; baixa; cancelamento), `/configuracoes` (contas, formas de pagamento, categorias, caixas, recorrências).
- Rota de Vendas ficou `/caixa-financeiro/vendas` (aba própria, em vez de `/caixa/vendas`).
- Acesso: card da central agora "disponível"; a tela exige o app contratado (lista real de acessos) e papel de operador ou financeiro. Abas Financeiro e Configurações só para dono, admin e financeiro.
- Recorrências geradas para os próximos 60 dias ao abrir a visão geral (idempotente).
- Testes: `money.test.ts` (cálculo do esperado no caixa igual ao SQL, resultado sem transferências, períodos, conversão de valores) + registro (19/19 no total).

## 12. Escopo reduzido das telas (decisão de 2026-10-24)
O responsável decidiu que o app fica com **Visão geral, Caixa, Vendas e Configurações**, e Configurações o mais simples possível.
- **Removido:** tela Financeiro (contas a pagar/receber, lançamentos manuais, baixa, recorrências) e categoria no registro de movimentos.
- **Visão geral:** baseada no caixa (vendas, outras entradas, saídas, diferenças de caixa, vendas por forma de pagamento, últimas movimentações, situação dos caixas), por período (hoje, 7 dias, mês, mês anterior). Visível para operador e financeiro.
- **Vendas:** vendas registradas no caixa (total, quantidade, ticket médio, lista) para todos; vendas importadas do PDV aparecem na mesma tela quando o plano tem o recurso.
- **Configurações:** só formas de pagamento (ativar/desativar, adicionar) e caixas por unidade (ativar/desativar, adicionar). Contas e categorias são criadas automaticamente em "Preparar o app" e não aparecem.
- **Banco:** inalterado. O fechamento de caixa continua gerando os lançamentos financeiros (base para relatórios futuros), sem tela por enquanto.
