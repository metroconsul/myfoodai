# Plano Começo simplificado + conta piloto da cafeteria

O projeto já tem multiempresa por `companies` (não existem tabelas `organizations`/`organization_members`) e isolamento por `company_id` com RLS. A separação entre a conta administradora e a conta piloto será feita nessa estrutura existente, sem duplicar tabelas.

## O que já existe (verificado)

- `companies` (empresa = tenant), `units`, `employees`, `user_roles` (com `company_id`), `profiles`.
- Cartão de ponto completo: `timesheet_periods`, `point_cards`, `timesheet_entries`, `timesheet_batches`, `timesheet_disputes`, assinatura e auditoria no portal.
- Ponto com foto, geolocalização, geocerca e consentimento já implementados.
- `subscriptions` hoje é por usuário (`user_id`, `plan`, `status`) — sem vínculo com empresa e sem entitlements.
- O cálculo de jornada prevista do cartão vem de `schedule_blocks` (escalas). Sem escala, o "previsto" fica zerado.
- O menu lateral é uma lista fixa em `src/components/app-shell.tsx`, sem filtro por plano.

## Etapa 1 — Plano e permissões por empresa

Migração:
- `companies`: `plan_code` (padrão `comeco`), `subscription_status`, `pilot_account`, `single_unit_mode`, `fixed_schedule_mode`, `trial_ends_at`, `grant_reason`, `granted_by`.
- `subscriptions`: adicionar `company_id`, `stripe_price_id`, `current_period_start`, `cycle`.
- Nova `feature_entitlements` (company_id, feature_code, enabled, source) + GRANTs + RLS de leitura pela própria empresa.
- Nova role de produto `platform_admin` registrada em tabela protegida (`platform_admins`), gravável apenas por service role — é ela que dá acesso total à conta dona do produto, nunca um plano.
- Funções `app_auth.company_plan(uuid)` e `app_auth.has_feature(company_id, feature_code)` (security definer) para uso em RLS e em server functions.

Matriz de recursos por plano em `src/config/features.ts`: o Começo libera visão geral, colaboradores, portal, ponto, cartões de ponto, documentos/pendências, itens e configurações da unidade; bloqueia escalas avançadas, turnos, modelos semanais, conflitos, histórico de escalas, multiunidade, vendas e relatórios avançados.

## Etapa 2 — Autorização real (frontend + backend)

- `useWorkspace` passa a expor `planCode`, `entitlements`, `isPlatformAdmin`.
- `AppShell` filtra os grupos do menu pela matriz de recursos; plataforma admin vê tudo.
- Cada rota bloqueada renderiza uma tela "Recurso não incluído no Plano Começo" com CTA de upgrade — sem quebrar a navegação e sem expor dados.
- Guarda no servidor: middleware/helper `requireFeature(feature_code)` aplicado nas server functions de escalas, turnos, modelos, vendas e criação de unidade adicional; RLS de `units` passa a impedir a segunda unidade quando `single_unit_mode` é verdadeiro.

## Etapa 3 — Jornada fixa

Nova tabela `fixed_work_schedules` (company_id, unit_id, weekdays, start_time, end_time, break_start, break_end, active) com RLS por empresa.

- Tela "Jornada fixa" em configurações da unidade: dias da semana, entrada, saída e intervalo opcional. Nenhum horário é presumido — os campos começam vazios e são obrigatórios.
- Gerador `fixed_schedule`: ao fechar/gerar o cartão de ponto, os blocos previstos do período são materializados como `schedules`/`schedule_blocks` com `source = 'fixed_schedule'`, sem expor a tela de escalas. Assim o cálculo atual de previsto, atrasos, faltas e horas continua funcionando sem gambiarra.
- Portal do colaborador mostra o próximo horário esperado a partir da jornada fixa.
- O cartão de ponto passa a exibir explicitamente: jornada prevista, marcações reais, ajustes autorizados, justificativas, pendências, conferência, assinatura e contestação (a maior parte já existe; o que falta é o bloco de "previsto x realizado" por dia).

## Etapa 4 — Provisionamento seguro da conta piloto

Conta piloto: estabelecimento **Casa Creme'o**, uma única unidade, **Plano Começo anual**.

Tela `/app/admin/piloto`, visível apenas para `platform_admin`, com formulário já pré-preenchido com "Casa Creme'o" (empresa e unidade), plano Começo e ciclo anual — editáveis. Campos restantes: e-mail do gestor, dias e horários da jornada, intervalo, responsável e modo de acesso (trial, concessão administrativa ou assinatura paga). Os horários continuam em branco e obrigatórios, sem valor presumido.

Server function administrativa (não SQL, não senha em código):
- valida que o chamador é `platform_admin`;
- cria o usuário por convite do Supabase Auth (link de definição de senha enviado por e-mail) — nenhuma senha trafega ou é gravada;
- cria a empresa piloto "Casa Creme'o", a unidade, a jornada fixa, o papel `owner` daquela empresa e os entitlements do Começo, com `plan_code = comeco` e ciclo anual;
- registra auditoria em `audit_logs` sem qualquer credencial;
- se o modo for trial ou concessão, grava início, fim, responsável e motivo.

## Etapa 5 — Stripe

- Passar a usar os Price IDs reais do Começo (mensal `price_1UAeTjRzTbFSBgbDKHq91ZYH`, anual `price_1UAeTjRzTbFSBgbD2ASyogbe`) em vez de `price_data` improvisado, com o mapa de preços validado no servidor — o frontend envia apenas `planId` e `cycle`.
- Checkout recebe `client_reference_id = company_id` e metadata com `company_id`, `user_id`, `plan_code`.
- Webhook passa a tratar `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid` e `invoice.payment_failed`, atualizando `companies.plan_code`/`subscription_status` e `subscriptions` por empresa, mantendo a idempotência já existente em `stripe_webhook_events`.
- A empresa do proprietário fica marcada como `platform_admin` e nunca é rebaixada por evento de plano.
- Casa Creme'o usa o preço anual do Começo (`price_1UAeTjRzTbFSBgbD2ASyogbe`, R$ 767,04/ano). Se você optar por trial ou concessão administrativa nos 30 dias de piloto, o plano fica `comeco` com status `trialing`/`admin_grant` e a cobrança anual só é criada quando o checkout for concluído — nunca marcamos como pago sem evento real da Stripe.

## Riscos e pontos de atenção

- `subscriptions` hoje é por usuário; a migração adiciona `company_id` e faz backfill pelo `user_id` — assinaturas órfãs ficam sem empresa e serão listadas no resumo final.
- Materializar a jornada fixa em `schedule_blocks` é a alternativa menos invasiva; a alternativa (reescrever o motor de cálculo) seria mais arriscada.
- Nenhuma funcionalidade é removida: tudo continua disponível para contas com o plano/entitlement correspondente.

## Entrega ao final

Resumo das alterações, tabelas e políticas criadas, funções de servidor, secrets usados, passo a passo para convidar a cafeteria, checklist de teste (admin do produto, gestor piloto, colaborador piloto) e limitações conhecidas.
