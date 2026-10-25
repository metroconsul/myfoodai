# MyFoods Ponto — diagnóstico e plano de separação

Data: 2026-10-24 · Situação: **P1 implementada** (telas em `/ponto`, sem mudança no banco). P2 (segurança no banco) aguarda aprovação.

## 1. Diagnóstico

### 1.1 O que existe hoje (dentro de `/app`, com o menu geral)
| Tela atual | Rota | O que faz | No menu? |
|---|---|---|---|
| Marcações | `/app/time-entries` | Batidas de um dia, situação da geolocalização, aprovar/recusar pedidos de correção | Sim ("Ponto") |
| Cartões de ponto | `/app/point-cards` (+ `/$id`) | Fechamento do período, preparar e publicar cartões, ver aceite do colaborador (com validação facial) | **Não** (só por link em Documentos → Pendências) |
| Escalas | `/app/schedules` | Escala semanal por colaborador | **Não** |
| Turnos | `/app/shifts` | Cadastro de turnos | **Não** |
| Modelos semanais | `/app/schedule-templates` | Modelos de escala | **Não** |
| Conflitos de escala | `/app/schedule-compliance` | Conflitos/irregularidades das escalas | **Não** |
| Histórico de escalas | `/app/schedule-history` | Alterações e trocas de turno | **Não** |
| Jornada fixa | `/app/settings/jornada` | Horário, intervalo e dias (plano Começo) | **Não** |
| Colaboradores | `/app/employees` | Cadastro, cargo, equipe, PIN do portal | Sim (compartilhado com Documentos/EPIs) |
| Cargos e equipes | `/app/roles-teams` | Cargos, equipes, regimes | **Não** |
| Políticas de aceite | `/app/settings/aceite` | Geocerca, prazo de assinatura, provedores de validação facial | **Não** |
| Dashboard | `/app` | Mistura pendências de ponto, documentos e EPIs | Sim |

Portal do Colaborador (`/portal/*`): bate ponto (`portalPunch`), cartão de ponto com aceite, escala, holerites, itens/EPIs. Usa funções de servidor próprias (sessão por CPF + PIN) e **não depende** das telas de `/app`.

### 1.2 Achados
1. **Telas de ponto escondidas.** 9 das 12 telas não aparecem no menu; só se chega digitando o endereço.
2. **Validação facial na batida não existe hoje.** A batida usa **geolocalização** (dentro/fora do raio, revisão). A coluna e o depósito de foto da batida (`time_entries.evidence_path`, bucket `time-clock-evidence`) existem no banco, mas nenhum código grava foto (0 de 4 batidas em produção têm foto). A validação facial existe no **aceite do cartão de ponto**, na assinatura de holerite e na entrega de EPI.
3. **O banco não confere a contratação do Ponto.** As regras de acesso das tabelas de ponto checam empresa/unidade/papel, mas não `app_ponto`; o bloqueio por contrato hoje é só na tela.
4. **Algumas tabelas aceitam escrita de qualquer papel da empresa** (`schedule_blocks`, `shift_swap_requests`, `timesheet_periods`), e `time_entries`/`time_entry_reviews` podem ser lidas por qualquer papel com acesso à unidade (inclusive operador de caixa).
5. **Dados em produção são poucos** (4 batidas, 2 colaboradores, 2 escalas, 3 cartões): risco baixo para mudar telas e regras.
6. **EPIs pertencem ao app Documentos** (`app_documentos`), não ao Ponto. Colaboradores é cadastro compartilhado.

## 2. Plano (duas etapas, cada uma com aprovação)

### Etapa P1 — App `/ponto` (só telas; sem mudança no banco)
Mesmo modelo do Caixa & Financeiro: layout próprio, cabeçalho "MyFoods Ponto", abas, bloqueio por contratação e papel (`app_ponto` + dono/admin/RH/gerente/supervisor).

| Aba | Conteúdo | Origem |
|---|---|---|
| **Visão geral** | Hoje: presentes, batidas, fora do raio, correções pendentes, cartões aguardando aceite, conflitos de escala | Novo, com consultas já usadas em `/app` (só a parte de ponto) |
| **Registros** | Histórico de batidas com filtro por período e colaborador | `time-entries` (ganha filtro de período/colaborador) |
| **Ocorrências** | Pedidos de correção (aprovar/recusar), batidas fora do raio/em revisão, conflitos de escala | Correções de `time-entries` + `schedule-compliance` |
| **Jornadas** | Escalas · Turnos · Modelos · Histórico de escalas · Jornada fixa (sub-abas conforme o plano) | Telas atuais, sem reescrever |
| **Funcionários** | Colaboradores · Cargos e equipes | `employees` + `roles-teams` (mesmo componente usado em `/app`) |
| **Relatórios** | Cartões de ponto (fechamento e publicação) + exportar batidas em CSV | `point-cards` + exportação nova (pequena) |
| **Configurações** | Geocerca e regras de aceite do ponto | `settings/aceite` |

Como:
- Mover o conteúdo das telas para `src/apps/ponto/pages/*` (como foi feito com `sales-page`), deixando as rotas finas. Sem reescrever lógica.
- Rotas antigas (`/app/time-entries`, `/app/point-cards`, `/app/schedules`…) **redirecionam** para o endereço novo em `/ponto` — links e favoritos continuam funcionando.
- Central de aplicativos abre `/ponto`; o item "Ponto" sai do menu de `/app`. Colaboradores continua acessível também em `/app` para Documentos/EPIs.
- Nada de Estoque, Compras, Caixa ou Documentos na navegação do Ponto.
- **Portal do Colaborador: nenhuma alteração.**
- Verificação: typecheck, lint, testes, navegação por papel (dono, RH, supervisor, operador de caixa sem acesso) e empresa sem o app.

### Etapa P2 — Segurança no banco (migration aditiva, aprovação própria)
- Regras das tabelas de ponto passam a exigir o app Ponto contratado (`app_ponto`) para leitura/escrita pela equipe.
- Leitura de batidas/correções só para papéis de gestão do ponto; escrita em `schedule_blocks`, `shift_swap_requests`, `timesheet_periods` só para esses papéis.
- O Portal usa o servidor (service_role) e não é afetado; a rotina de automação também não.
- Kit de testes em Postgres descartável (mesmo padrão dos kits anteriores), depois aplicação em produção com sua autorização.

### Fora do escopo (decidir à parte)
- **Foto/validação facial na batida.** Seria funcionalidade nova no Portal (que o pedido diz para não alterar). A estrutura no banco já existe; recomendo uma etapa separada, se quiser.
- Telas de Documentos/EPIs continuam em `/app` até a separação do app Documentos.

## 3. Como ficou a P1 (2026-10-24, versão simplificada)
- **5 abas + engrenagem:** Hoje · Registros · Cartões · Escalas · Equipe · ⚙ Configurações (só dono/admin/RH).
  - **Hoje** junta a visão geral e as ocorrências: presentes agora, batidas de hoje, "precisa de você" (pedidos de correção com aprovar/recusar e batidas para revisar dos últimos 7 dias), cartões sem aceite e últimas batidas.
  - **Registros:** período + colaborador + "Baixar planilha" (CSV).
  - **Cartões:** cartões de ponto (fechamento, publicação, aceite).
  - **Escalas (uma tela só):** a unidade escolhe "Todos no mesmo horário" (jornada fixa) ou "Escala por semana" (grade colaborador × dia; dia vazio = folga; "usar de segunda a sexta"; "Copiar semana anterior"; "Publicar para a equipe"; avisos de sobreposição, descanso < 11h e > 44h/semana; "Horários prontos" = turnos como atalho). No modo por semana a jornada fixa fica desligada (`setFixedScheduleActive`), para não preencher sozinha os dias de folga. Modelos e Histórico saíram da tela (dados mantidos no banco); o histórico é navegar pelas semanas.
  - **Equipe:** Colaboradores · Cargos e equipes.
- Telas existentes movidas sem reescrever para `src/apps/ponto/pages/`; mapa de arquivos em `src/apps/ponto/README.md`.
- Endereços antigos de ponto em `/app` redirecionam para `/ponto`. Colaboradores, Cargos e Políticas de aceite continuam também em `/app` (compartilhados com Documentos/EPIs).
- Central de aplicativos abre `/ponto`; o item "Ponto" saiu do menu de `/app`. Portal do Colaborador sem alteração.
- Pedidos de correção agora aparecem por unidade ativa (antes a lista era da empresa toda). Datas do app usam o dia local (não UTC).
