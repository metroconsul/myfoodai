# Roadmap seguro — MVP MyFoods

Cada fase deve terminar com build, typecheck, revisão de RLS/migration e teste dos fluxos afetados. Não apagar módulos ou dados em nenhuma fase inicial.

## 0. Baseline e decisões de produto

- Registrar métricas de uso das áreas que serão ocultadas.
- Confirmar política de foto no ponto: obrigatória/opcional, finalidade, retenção, consentimento e quem pode visualizar.
- Definir quais documentos entram no MVP (ocupacionais, cadastrais ou ambos) e os estados de vencimento.
- Definir SLA/prioridade de pendências e papéis que podem aprovar/rejeitar.

Critério de saída: contrato de MVP e política LGPD aprovados; nenhuma mudança de schema.

## 1. Modo MVP de navegação e dashboard

- Adicionar um modo/feature server-authorized para a experiência MVP.
- Reduzir navegação do gestor às seis áreas; ocultar módulos classificados como `HIDE_FROM_MVP` sem remover rotas ou dados.
- Reescrever dashboard para métricas essenciais e “O que precisa de você”.
- Agregar pendências existentes por consulta, com links para a ação de origem.

Critério de saída: gestor consegue identificar e abrir uma correção de ponto, documento pendente e EPI pendente sem navegar por módulos ERP.

## 2. Consolidar documentos e EPIs

- Criar páginas MVP de Documentos e EPIs sobre as tabelas existentes.
- Simplificar o portal para documentos e EPIs; manter holerites/escala como ocultos quando aplicável.
- Garantir que aceite, recusa, assinatura, URL assinada e logs continuem intactos.

Critério de saída: gestor atribui/acompanha; colaborador visualiza, aceita ou conclui o fluxo; decisão fica auditada.

## 3. Completar ponto e pendências

- Implementar aprovação/recusa de revisão de ponto via server function, com auditoria.
- Definir detecção server-side de batida ausente/anomalia; primeiro como job idempotente e observável.
- Se aprovada no escopo da fase 0, adicionar evidência fotográfica de ponto com migration aditiva, Storage privado, tamanho/MIME limitados, retenção e testes de acesso. Não reaproveitar selfie de EPI sem uma finalidade e consentimento próprios.

Critério de saída: ponto criado, correção solicitada e decisão do gestor aparecem corretamente na fila e no histórico.

## 4. Outbox e integração n8n

- Criar `integration_events` e publicador server-side com HMAC, timestamp, idempotência, retry e dead-letter/visibilidade de falhas.
- Emitir primeiro `employee.*`, `clock.created`, `clock.adjustment_requested`, `document.created` e `epi.assigned/accepted`.
- Criar workflow n8n de homologação que valida assinatura e deduplica por `event_id`; começar com logs/uma notificação não crítica.
- Só depois habilitar lembretes de documentos, EPIs e ponto ausente.

Critério de saída: replay seguro de evento, nenhuma regra crítica fora do MyFoods, e falhas recuperáveis sem duplicar comunicação.

## 5. Notificações e mascote determinístico

- Persistir notificações a partir das regras/outbox e mostrar somente as pertinentes ao colaborador.
- Criar mensagens de prioridade e deep links no portal; o mascote é uma camada visual, não recebe dados além do necessário.
- Medir entrega, leitura e resolução de pendências.

Critério de saída: colaborador vê mensagens acionáveis e o gestor vê a consequência na fila.

## 6. Piloto, endurecimento e retirada posterior

- Pilotar com tenants isolados e feature flag; testar permissões, RLS, arquivos privados, tempos de resposta e eventos duplicados.
- Rodar `npm run build`, `npm run typecheck` e os testes E2E/migration relevantes em cada release.
- Após período acordado de uso e exportação/retenção, planejar migration de arquivamento/retirada de estoque e vendas. Nunca apagar migrations aplicadas nem reescrever histórico publicado.

## Ordem recomendada

1. Fase 0 + 1 (mensagem e foco do produto).
2. Fase 2 (fluxos vendáveis de documentos/EPIs).
3. Fase 3 (pendências reais de ponto e eventual foto).
4. Fase 4 (n8n com outbox confiável).
5. Fases 5 e 6 (automação visível, piloto e remoção adiada).
