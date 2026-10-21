# Arquitetura proposta — MVP MyFoods

## Princípio

O MyFoods registra fatos e aplica regras críticas no backend. O gestor recebe contexto e decide. n8n consome eventos e executa comunicações e integrações; não cria nem altera a verdade operacional diretamente.

## Frontend

O painel do gestor terá seis áreas: Dashboard, Colaboradores, Ponto, Pendências, Documentos e EPIs. A home prioriza contadores simples (ativos, pontos de hoje, divergências, documentos pendentes e EPIs pendentes) e a fila **“O que precisa de você”** com ações explícitas.

O portal mantém CPF + PIN, perfil, bater ponto, histórico/cartão, documentos, EPIs e notificações. O mascote é uma apresentação determinística de pendências/notificações, não uma IA conversacional. Ele recebe uma lista de mensagens classificadas por prioridade e deep link, por exemplo: saída não registrada, EPI aguardando aceite ou documento a vencer.

Ocultar uma área exige três camadas: retirada do menu, gate de rota e verificação de autorização no server function/RLS. O frontend nunca é a fonte de segurança.

## Backend e Supabase

TanStack Start server functions e API routes executam no Node server. Elas devem ser o único ponto de mutação para fluxos que tenham regra de negócio, auditoria ou evento externo. O cliente Supabase continua adequado para leituras protegidas por RLS de baixa complexidade.

Supabase continua como fonte de verdade:

- Postgres: entidades operacionais, autorização por tenant, auditoria e outbox.
- Auth: acesso do gestor; o portal mantém sessão própria hashada enquanto a migração desse modelo não for necessária.
- Storage privado: documentos, assinaturas, fotos/evidências; acesso por URL assinada curta e registro de acesso.
- RLS: sempre filtrar por `company_id` e por acesso à unidade; o service role fica exclusivamente em módulos `.server.ts` ou handlers de servidor.

Não expor `SUPABASE_SERVICE_ROLE_KEY`, `N8N_API_KEY`, segredo de webhook, FCM ou tokens em `VITE_*`, browser, logs ou erros retornados ao usuário.

## Modelo de pendências

Implementar uma leitura agregada inicialmente (não duplicar dados):

| Fonte | Regra MVP | Ação |
| --- | --- | --- |
| `time_entry_reviews` | status `pendente` | Aprovar ou recusar correção |
| `time_entries`/cartões | batida ausente, geolocalização em revisão ou anomalia | Revisar ponto |
| `occupational_documents`/`document_requests` | vencido, vence em breve ou solicitação aberta | Visualizar/cobrar/resolver |
| `item_deliveries` | aguarda aceite, validação ou recusa | Visualizar/reemitir/tratar |

Na fase seguinte, materializar `manager_tasks` somente se desempenho, SLA, atribuição ou histórico de decisão exigirem. Cada decisão grava auditoria e produz evento.

## Contrato de eventos para n8n

Adicionar migration **aditiva** para `integration_events` (outbox): `id` UUID/event_id, `company_id`, `unit_id`, `event_type`, `aggregate_type`, `aggregate_id`, `occurred_at`, `payload` JSONB, `payload_version`, `idempotency_key` único, `status`, `attempts`, `available_at`, `delivered_at`, `last_error`, `created_at`. Índices: `(status, available_at)` e `(company_id, created_at)`. RLS não deve permitir leitura/escrita de usuários comuns.

O backend insere o fato de negócio, `audit_logs` e o evento no mesmo fluxo transacional (idealmente RPC/transaction server-side ou trigger de outbox cuidadosamente limitado). O publicador assíncrono seleciona eventos pendentes, envia e só então marca a entrega. Falhas usam retry com backoff; não há perda silenciosa nem duplicação não tratada.

Eventos iniciais:

- `employee.created`, `employee.updated`
- `clock.created`, `clock.missing`, `clock.anomaly`, `clock.adjustment_requested`
- `document.created`, `document.expiring`, `document.expired`
- `epi.assigned`, `epi.accepted`, `epi.pending`
- `notification.created`

Envelope HTTP para n8n:

```json
{
  "event_id": "uuid",
  "event_type": "clock.created",
  "occurred_at": "2026-09-29T12:00:00.000Z",
  "payload_version": 1,
  "company_id": "uuid",
  "unit_id": "uuid-or-null",
  "payload": {}
}
```

Assinar o corpo bruto com HMAC-SHA-256 usando `N8N_WEBHOOK_SECRET` exclusivamente no servidor. Enviar `X-MyFoods-Event-Id`, `X-MyFoods-Timestamp`, `X-MyFoods-Signature` e versão do payload. n8n deve rejeitar assinatura/timestamp inválidos e deduplicar por `event_id`; o MyFoods também deduplica por `idempotency_key`. Não enviar CPF, foto, arquivo, coordenadas exatas ou documento clínico por padrão: enviar IDs e dados mínimos, e obter informação adicional apenas por endpoint autenticado e auditado se realmente necessário.

## Notificações

Uma regra de domínio cria a notificação/outbox; n8n decide canal, template, retry de fornecedor e follow-up. O retorno de entrega deve atualizar estado com endpoint autenticado e idempotente, sem permitir que n8n mude ponto, aceite, documento ou decisão do gestor. O portal consulta notificações próprias e o mascote apenas as renderiza.

## Operação e observabilidade

- Variáveis novas: `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` e, se houver callback, `N8N_CALLBACK_SECRET`; todas server-only e ausentes de `.env.example` público exceto como nomes vazios/comentados.
- Logar `event_id`, tipo, tentativa e resultado, nunca payload sensível completo ou segredo.
- Criar métricas para eventos pendentes, falhas, latência e pendências vencidas.
- Manter migrations forward-only e validar RLS, tenant isolation, idempotência e assinatura em testes automatizados.
