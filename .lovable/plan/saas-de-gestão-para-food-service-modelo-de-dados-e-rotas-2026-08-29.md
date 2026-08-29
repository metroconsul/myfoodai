# SaaS de gestão para food service — modelo de dados e rotas

Lovable Cloud já está ativo (banco, autenticação, storage e migrations versionadas). Antes de construir as telas, este é o resumo do modelo de dados e das rotas, conforme solicitado.

## Marca configurável

Um único arquivo `src/config/brand.ts` com `BRAND_NAME`, `BRAND_LOGO`, `BRAND_FAVICON`, `PRIMARY_COLOR`, `ACCENT_COLOR`, e tokens CSS centralizados em `src/styles.css` (laranja `#F97316`, fundo creme `#FFF7ED`, superfícies brancas, texto grafite). Nenhum hexadecimal em componentes. Cada empresa também pode sobrescrever marca/cores via `companies`.

## Modelo de dados (todas as tabelas com id, timestamps, RLS e GRANTs)

**Organização**
- `companies` (nome, documento, status, timezone, brand_name, brand_logo_url, primary_color, accent_color)
- `units` (company_id, nome, tipo, endereço, lat/lng, raio de ponto em metros, ativo)

**Acesso**
- `profiles` (usuário do painel, company_id, nome, avatar)
- `app_role` enum: owner, admin, unit_manager, hr, stock_manager, supervisor, staff
- `user_roles` (user_id, role, company_id, unit_id) + função `has_role()` security definer
- `user_units` (acesso por unidade)
- `audit_logs` (usuário, ação, entidade, registro, unidade, metadados)

**Pessoas**
- `roles` (cargos), `teams`
- `employees` (CPF protegido, contatos, código, cargo, equipe, status, admissão, `portal_pin_hash`, avatar, work_regime_id)
- `portal_sessions` + controle de tentativas de login

**Escalas**
- `shifts` (nome, início, fim, crosses_midnight, cor)
- `work_regimes` (6x1, 5x2, 12x36, custom — sem rota própria; editado dentro de colaborador/equipe/modelo)
- `schedule_templates`, `schedule_template_items`
- `schedules`, `schedule_blocks` (múltiplos blocos/dia), `schedule_changes` (versionamento), `shift_swap_requests`

**Ponto**
- `point_policies` (geolocalização obrigatória, tolerância de precisão, bloqueio ou revisão, retenção, mensagem)
- `time_entries` (tipo de batida, horário do dispositivo e do servidor, lat/lng, precisão, endereço, device, status de validação, schedule_block_id)
- `time_entry_reviews` (correções auditáveis)
- `point_cards`, `point_card_deliveries` (destinatário, canal, status, tentativa, erro, token)

**Itens e estoque**
- `catalog_items` (tipo: proteção individual, uniforme, ingrediente, embalagem, limpeza, consumo)
- `employee_item_deliveries` (colaborador, quantidade, tamanho, condição, assinatura, devolução)
- `inventory_items`, `stock_movements` (entrada, saída, ajuste, perda, transferência, inventário), `suppliers`, `inventory_counts`, `inventory_count_items`, `stock_alerts`

**Vendas (camada de adapters)**
- `sales_connections`, `sales_import_jobs`, `sales_orders`, `sales_order_items`, `sales_daily_metrics`

**Notificações**
- `notifications` (evento, template, destinatário, canal, status, tentativas, chave de idempotência, erro)

**Storage**: buckets privados `item-photos`, `avatars`, `signatures`, `documents`.

## Rotas

Painel (autenticado, seletor de unidade no shell):
`/app` dashboard · `/app/units` · `/app/employees` · `/app/roles-teams` · `/app/shifts` · `/app/schedules` · `/app/schedule-templates` · `/app/schedule-compliance` · `/app/schedule-history` · `/app/time-entries` · `/app/point-cards` · `/app/point-policy` · `/app/catalog` · `/app/deliveries` · `/app/inventory` · `/app/sales` · `/app/notifications` · `/app/settings` (marca, usuários, auditoria)

Portal do colaborador (mobile, CPF + PIN, dados apenas do próprio colaborador):
`/portal/login` · `/portal` · `/portal/escala` · `/portal/ponto` · `/portal/cartao-ponto` · `/portal/documentos` · `/portal/perfil`

Público: `/` landing + `/auth` (e-mail/senha e Google).

## Segurança

RLS em todas as tabelas por empresa/unidade via `has_role()` e `user_units`. PIN sempre com hash. Portal autenticado por server functions com token de sessão próprio — nunca acesso direto do cliente às tabelas de outros colaboradores. Geolocalização com finalidade, retenção configurável e acesso restrito. Auditoria em ponto, escala, estoque, envio de cartão e permissões.

## Ordem de entrega

1. Migrations base + auth + storage + RLS + tokens visuais e config de marca
2. Empresas, unidades, colaboradores, cargos, equipes, shell do painel
3. Turnos, regimes contextuais, modelos e escalas + conflitos e histórico
4. Portal CPF+PIN: escala, ponto com geolocalização, cartão de ponto
5. Catálogo, entregas individuais e estoque visual com fotos
6. Vendas (estado sem integração + adapters) e notificações idempotentes
7. Revisão de segurança, acessibilidade e testes

Ao final de cada etapa eu informo tabelas, políticas, rotas e componentes criados.
