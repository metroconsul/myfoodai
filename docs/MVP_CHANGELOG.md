# Changelog do MVP

## 2026-09-29 — Motor de automação n8n

- Adicionados endpoints server-side autenticados em `/api/automation/*` para recepção idempotente de eventos, monitores e dispatch de notificações.
- Supabase continua como fonte de verdade; o n8n apenas consulta candidatos e solicita ações idempotentes ao backend.
- Eventos de ponto, pedido de correção e atribuição/aceite de EPI agora são enviados ao Event Receiver após a gravação principal.
- Incluída migration aditiva para `automation_events`, inacessível a `anon` e `authenticated` e disponível somente ao backend com service role.
- Adicionada policy explícita de negação para clientes na tabela `automation_events`; o advisor de segurança do Supabase não reporta mais problemas relacionados à tabela.
- Secrets de automação permanecem exclusivamente em variáveis server-side.
- Criadas no n8n as credenciais `MyFoods Webhook Inbound` e `MyFoods API Header Auth`, vinculadas aos workflows sem publicar ou ativar nenhum deles.
- Os cinco workflows foram testados manualmente: os três monitores retornaram candidatos válidos, o resumo diário criou seis notificações com seis chaves idempotentes distintas e o Event Receiver processou uma entrega e ignorou sua repetição pelo mesmo `event_id`.
- O teste n8n → backend foi executado por um túnel local temporário; depois da validação, os drafts voltaram a usar `MYFOODS_API_URL`. Antes de publicar, a variável deve apontar para a URL HTTPS estável do backend e a instância deve permitir `$env` em expressões (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`), pois a edição Community não oferece `$vars`.

## 2026-09-29 — Fase 1: experiência operacional mínima

### Painel do gestor

- Menu principal reduzido para Dashboard, Colaboradores, Ponto, Documentos e EPIs.
- Rotas e módulos anteriores foram preservados; apenas deixaram de aparecer na navegação principal.
- Dashboard substituído por “Operação hoje”, com colaboradores ativos, pontos registrados no dia, divergências, documentos pendentes e EPIs pendentes.
- Bloco “O que precisa de você” agrega correções de ponto, documentos vencidos/pendentes, solicitações abertas e aceites/divergências de EPI.
- Todas as consultas continuam limitadas à unidade ativa e às políticas RLS existentes.

### Portal do colaborador

- Navegação principal simplificada para Início, Ponto, Documentos e EPIs.
- Home reorganizada em torno de status de ponto, botão de batida, última batida do dia, total de pendências, recados e atalhos.
- Terminologia de “itens” atualizada para “EPIs” na experiência principal, sem renomear tabelas, rotas ou APIs existentes.
- Rotas antigas de escala, holerites, cartões, perfil e pendências continuam disponíveis por links internos ou acesso direto.

### Assistente e notificações

- Adicionado contrato estruturado `notification_type`, `title`, `message`, `priority`, `action_url` e `metadata`.
- A tabela `notifications` existente é adaptada sem migration: os novos campos podem ser enviados no `payload`, com compatibilidade para eventos legados.
- O assistente MyFoods apresenta notificações estruturadas e, quando não existem mensagens persistidas, lembretes determinísticos derivados de ponto, documentos e EPIs.
- Nenhum LLM ou serviço externo foi adicionado.

### Segurança e compatibilidade

- Nenhuma migration, tabela ou dado foi removido ou alterado.
- Autenticação do gestor e sessão CPF + PIN do colaborador foram preservadas.
- A leitura de notificações do portal resolve a sessão no servidor e filtra pelo `employee_id` autenticado.
- Nenhum secret foi adicionado ao frontend.
- Falha de conexão com o Supabase agora é apresentada como indisponibilidade do serviço no painel e no portal, sem mascará-la como credencial inválida.

### Validação

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado sem erros; 14 avisos preexistentes permanecem fora do escopo desta fase.
- `npm run test:e2e`: 7 testes aprovados e 8 ignorados por dependerem das credenciais opcionais do portal E2E.
- `npm run build`: aprovado. O build ainda informa avisos preexistentes de depreciação de `inputValidator()` do TanStack Start.
