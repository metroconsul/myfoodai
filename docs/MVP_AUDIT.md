# Auditoria do MVP MyFoods

Data: 2026-09-29. Escopo: leitura do código, rotas, funções de servidor, configuração e migrations existentes. Nenhum dado, migration ou rota foi alterado nesta etapa.

## Estado atual

MyFoods é um SaaS multiempresa e multiunidade para food service. A aplicação usa React 19, Vite 8, TanStack Router/Start, React Query, TypeScript, Tailwind/Radix e Supabase (Auth, Postgres, Storage e RLS). O build é um servidor Node/Nitro; não é uma SPA estática.

Há dois produtos na mesma aplicação:

- Painel autenticado do gestor em `/app`, via Supabase Auth.
- Portal do colaborador em `/portal`, via CPF + PIN e sessão própria com token armazenado somente como hash em `portal_sessions`.

O esquema inicial está em `20260829134240_*.sql`; as migrations posteriores acrescentam cartões de ponto, entregas/EPIs, documentos ocupacionais, holerites, LGPD, planos e cobrança. São migrations incrementais e não devem ser reescritas.

## O que já pode ser reutilizado

| Domínio | Implementação atual | Situação para MVP |
| --- | --- | --- |
| Colaboradores | `employees`, cargos, equipes, vínculo com unidade, status, CPF e PIN | Reutilizar; reduzir a tela ao essencial |
| Ponto | `time_entries`, geolocalização, validação, revisões, cartões e evidências | Reutilizar; incluir foto somente como política explícita |
| Portal | login CPF/PIN, perfil, ponto, histórico, escalas, pendências, itens e documentos | Reutilizar a estrutura; simplificar navegação |
| Documentos | `occupational_documents`, solicitações, ciência/assinatura, logs de acesso e Storage | Reutilizar para “Documentos”; não tratar apenas holerites como documento MVP |
| EPIs | catálogo, regras, entregas, itens, selfie/assinatura, evidências e eventos | Reutilizar como módulo EPI; separar de uniforme/itens genéricos na linguagem da UI |
| Pendências | revisões de ponto, solicitações de documento, entregas pendentes, vencimentos | Agregar numa única fila de ação do gestor |
| Notificações | tabela `notifications`, templates, canal, agenda e chave de idempotência | Reutilizar como caixa de saída, ainda sem orquestrador implementado |
| Auditoria | `audit_logs` e trilhas específicas de cartão, documento, entrega e holerite | Preservar e ampliar ao criar eventos de integração |

## Rotas encontradas

Gestor: dashboard, colaboradores, cargos/equipes, unidades, escalas/turnos/modelos/conflitos/histórico, ponto/cartões, itens/entregas/regras, conformidade/exames/kits/trocas/pendências, holerites, jornada/políticas/LGPD, estoque, vendas e administração piloto.

Portal: início, escala, ponto, pendências, perfil, itens, documentos, cartão de ponto e holerites. A navegação e as funções já suportam ciência e assinatura de documentos e aceite de entregas.

## Classificação para o MVP

### KEEP

- Autenticação do gestor, isolamento de tenant, papéis e auditoria.
- Login de colaborador por CPF + PIN, bloqueio por tentativas e sessão com expiração.
- Colaboradores, unidades (manter para operação multiunidade), cargos como metadado opcional e status de vínculo.
- Registro e histórico de ponto, geolocalização, revisões/correções e cartões de ponto quando houver fechamento.
- Documentos ocupacionais, solicitação, publicação no portal, ciência/assinatura e logs.
- Entregas de EPI, evidência, aceite/recusa e pendências associadas.
- Políticas de privacidade/LGPD, arquivos privados no Storage e URLs assinadas.

### HIDE_FROM_MVP

- Escalas avançadas, turnos, templates, conflitos, histórico de escala e trocas de turno. Manter jornada fixa como apoio ao ponto, sem expor o conjunto avançado inicialmente.
- Holerites: preservar dados e rotas, mas retirar do menu padrão; “Documentos” passa a ser a porta principal.
- Uniformes, kits por função, trocas/devoluções e validação facial: manter implementações, expor somente se o piloto de EPI exigir.
- Cargos/equipes, múltiplas unidades e configurações finas: manter acessíveis apenas em configuração/administrativo, não no menu de operação diário.
- Planos, billing Stripe e administração de pilotos: manter fora da navegação operacional do gestor.

### REMOVE_LATER

- Estoque: inventário, movimentos, contagens, alertas e fornecedores.
- Vendas: conexões, ingestão, pedidos, métricas e gráficos de vendas.
- Regras de entrega que não atendam EPI (ingredientes, embalagens, limpeza e consumo).
- Relatórios ou cards de dashboard derivados de estoque/vendas.

Nada desta categoria deve ser apagado antes de telemetria de uso, exportação/retenção de dados e uma migration de retirada aprovada.

### REFACTOR

- Dashboard: substituir a visão operacional de escala/estoque/vendas por uma fila “O que precisa de você”.
- Navegação do gestor: reduzir para Dashboard, Colaboradores, Ponto, Pendências, Documentos e EPIs. O bloqueio visual deve coexistir com autorização no servidor/RLS.
- Documentos: consolidar a linguagem e entradas hoje separadas entre `conformidade` e `holerites`.
- Itens/entregas: apresentar EPI como domínio primário; manter suporte de uniforme separado, sem confundir ambos.
- Notificações: transformar de tabela isolada em outbox confiável para automações e caixa de entrada/mascote do portal.
- Eventos: centralizar emissão no backend após a transação; hoje há auditoria dispersa, mas não um contrato de eventos n8n.
- Criações e atualizações sensíveis hoje feitas diretamente pelo cliente (por exemplo, cadastro de colaborador) devem migrar gradualmente para server functions, para validar regras, registrar auditoria e emitir eventos em uma única unidade de trabalho.

## Riscos e pontos a resolver antes de lançar

1. **Foto no ponto não existe no fluxo atual.** Há selfie para aceite de entrega, mas `time_entries` não possui referência de evidência fotográfica. Isso requer uma migration aditiva, bucket/políticas e regra de retenção antes de ser prometido.
2. **Eventos n8n não existem.** A tabela `notifications` não é outbox transacional; um webhook não deve ser disparado diretamente do navegador nem antes de persistir a mudança.
3. **Pendências não são uma entidade unificada.** As fontes existem, mas o dashboard terá de agregá-las com prioridade, responsável, link de ação e estado.
4. **O dashboard atual consulta estoque e vendas.** Enquanto o menu não for reduzido, o MVP continuará comunicando um ERP amplo.
5. **A configuração de recursos é orientada a planos, não a “modo MVP”.** Só ocultar itens no frontend não é controle de acesso; a mudança deve incluir gate de rota e autorização no backend.
6. **Dados pessoais e sensíveis.** CPF, geolocalização, documentos ocupacionais, biometria e assinaturas exigem minimização, retenção, acesso por papel e logs. A foto de ponto deve ter finalidade e consentimento/política documentados.
7. **Webhook Stripe tem deduplicação persistida após a sincronização.** A operação é majoritariamente idempotente por upsert, mas o padrão recomendado para os novos eventos é reservar/processar a chave antes de efeitos externos e registrar tentativas.
8. **Worktree já contém alterações do usuário.** Esta etapa não as modifica. Qualquer implementação posterior deve ser feita sem sobrescrever arquivos já alterados sem revisão de diff.

## Conclusão

O núcleo do MVP já existe. A primeira entrega de produto deve ser uma simplificação de experiência e uma camada confiável de pendências/eventos, não uma reconstrução do banco. A sequência está em [MVP_ROADMAP.md](MVP_ROADMAP.md).
