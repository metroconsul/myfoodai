# My Foods AI

Crie uma nova aplicação SaaS, começando do zero neste projeto Lovable, com banco de dados próprio no **Lovable Cloud**. O produto será voltado para restaurantes, bares, cafeterias, lanchonetes, padarias, cozinhas profissionais, pequenos varejistas e negócios de alimentação com uma ou mais unidades.

A aplicação deve centralizar a operação de pessoas, ponto, escalas, itens operacionais, estoque e indicadores de vendas. A identidade visual será original, com **laranja como cor principal**, aparência moderna, acolhedora, operacional e premium.

Não importar código, tabelas, usuários ou dados do Ava Safeguard. Este é um produto independente. Podemos usar apenas ideias gerais de experiência e arquitetura como referência, mas o banco, autenticação, nomenclatura, marca e implementação devem ser novos.

Use nomes configuráveis para a marca. Não hardcode um nome definitivo nas telas. Crie placeholders como `BRAND_NAME`, `BRAND_LOGO`, `BRAND_FAVICON`, `PRIMARY_COLOR` e `ACCENT_COLOR` em uma configuração central.

---

## 2. Antes de construir

Primeiro configure o projeto Lovable Cloud e confirme:

- banco de dados ativo;

- autenticação do painel;

- storage para fotos de ingredientes, documentos e assinaturas;

- RLS habilitado em todas as tabelas com dados de empresa;

- variáveis de ambiente e secrets separados do frontend;

- ambiente pronto para desenvolvimento e testes;

- estrutura de migrations versionadas.

Antes de criar as telas finais, apresente um resumo do modelo de dados e das rotas. Não criar telas desconectadas do banco.

Use dados de demonstração apenas em ambiente claramente identificado como demo. Não misture dados fictícios com dados reais.

---

# 3. Arquitetura do produto

O sistema deve ser multiempresa e mult unidade. Uma empresa pode possuir uma ou várias unidades, como lojas, restaurantes, cafeterias ou filiais.

A arquitetura deve separar:

- organização/empresa;

- unidade/filial;

- usuários administrativos;

- colaboradores;

- cargos e equipes;

- turnos e escalas;

- registros de ponto;

- estoque;

- itens operacionais entregues a colaboradores;

- vendas importadas de sistemas externos;

- notificações e auditoria.

O painel web é destinado a proprietários, administradores, gerentes, RH e responsáveis por estoque. O Portal do Colaborador funciona no celular, sem instalação de aplicativo, usando login por CPF + PIN.

---

# 4. Banco de dados no Lovable Cloud

Crie o banco no Lovable Cloud usando migrations seguras e relações explícitas. Toda tabela deve possuir `id`, timestamps e, quando aplicável, `company_id` e `unit_id`.

## 4.1 Empresas e unidades

### `companies`

Campos mínimos:

- `id`;

- `name`;

- `document` opcional;

- `status`;

- `timezone`, com padrão `America/Sao_Paulo`;

- `brand_name`;

- `brand_logo_url`;

- `primary_color`;

- `accent_color`;

- `created_at` e `updated_at`.

### `units`

Campos mínimos:

- `id`;

- `company_id`;

- `name`;

- `type`, como restaurante, bar, cafeteria, varejo, padaria ou cozinha;

- endereço;

- latitude e longitude opcionais;

- raio permitido para ponto, em metros;

- `active`;

- `created_at` e `updated_at`.

Permitir que o usuário selecione a unidade ativa no painel. Todas as consultas e ações devem respeitar empresa e unidade autorizadas.

## 4.2 Usuários e permissões

Criar perfis administrativos vinculados à autenticação do Lovable Cloud. Suportar pelo menos:

- proprietário;

- administrador;

- gerente de unidade;

- RH;

- responsável por estoque;

- supervisor;

- colaborador.

Criar relação entre usuários e unidades. Um gerente de uma unidade não pode visualizar ou alterar dados de outra unidade sem permissão explícita.

Criar tabela de auditoria com usuário, ação, entidade, registro afetado, data, unidade e metadados relevantes.

## 4.3 Colaboradores

### `employees`

Campos mínimos:

- `id`;

- `company_id`;

- `unit_id` principal;

- `full_name`;

- `cpf`, com proteção adequada;

- `phone`;

- `whatsapp_phone`;

- `email` opcional;

- `employee_code`;

- `role_id`;

- `team_id` opcional;

- `employment_status`;

- `hire_date`;

- `portal_pin_hash` ou mecanismo seguro equivalente;

- `avatar_url`;

- `created_at` e `updated_at`.

Não salvar PIN em texto puro. O Portal deve usar fluxo seguro de autenticação por CPF + PIN e limitar tentativas.

Criar `roles` e `teams` vinculados à empresa/unidade para representar cargos como cozinheiro, auxiliar de cozinha, garçom, caixa, gerente, barista e estoquista.

---

# 5. Módulo de Escalas e Turnos

Este é um módulo central do produto.

## 5.1 Turnos

### `shifts`

Campos mínimos:

- `id`;

- `company_id`;

- `unit_id`;

- `name`, como Abertura, Almoço, Jantar ou Fechamento;

- `start_time`;

- `end_time`;

- `crosses_midnight`;

- `color`;

- `active`.

Suportar turno que atravessa meia-noite, como 18:00–02:00.

## 5.2 Regimes de trabalho

### `work_regimes`

Suportar 6x1, 5x2, 12x36 e regime personalizado. Os limites devem ser configuráveis por empresa e não devem ser tratados como aconselhamento jurídico automático.

Campos mínimos:

- `id`;

- `company_id`;

- `name`;

- `regime_type`;

- `weekly_hours_limit`;

- `minimum_rest_minutes`;

- `work_pattern_config` em JSON estruturado;

- `active`.

## 5.3 Modelos e escalas

Criar:

- `schedule_templates`;

- `schedule_template_items`;

- `schedules`;

- `schedule_blocks`;

- `schedule_changes`;

- `shift_swap_requests`.

O regime de trabalho não deve gerar uma página independente no MVP. Ele deve ser configurado dentro do cadastro do colaborador, da equipe ou do modelo de escala, conforme o contexto mais adequado. A estrutura `work_regimes` pode existir no banco para padronizar regras, mas sua edição deve aparecer como um campo ou seção avançada dentro de Escalas/Colaboradores. Não adicionar “Regimes de Trabalho” à sidebar.

O modelo semanal deve permitir definir quais colaboradores ou equipes trabalham em quais turnos e dias. A projeção deve gerar escalas futuras sem duplicidade.

Um colaborador pode possuir mais de um bloco no mesmo dia, por exemplo almoço e jantar, desde que a configuração permita.

Cada escala publicada deve preservar versão, horário, turno, colaborador, unidade, origem, usuário que publicou e data de publicação. Alterações posteriores devem manter o histórico.

## 5.4 Telas de escala

Criar:

- `/app/schedules` para calendário semanal e mensal;

- `/app/shifts` para cadastro de turnos;

- o regime de trabalho como campo contextual no cadastro do colaborador, equipe ou modelo de escala, sem rota própria no MVP;

- `/app/schedule-templates` para modelos semanais;

- `/app/schedule-compliance` para conflitos;

- `/app/schedule-history` para histórico.

A tela de escala deve ter grade por colaborador/dia, edição rápida por seleção e, se implementado drag-and-drop, também alternativa acessível por formulário e teclado.

Exibir conflitos de sobreposição, excesso de horas, intervalo insuficiente, colaborador sem escala e unidade sem cobertura.

---

# 6. Cartão de ponto e geolocalização

## 6.1 Registro de ponto

Criar ou adaptar o módulo para permitir que o colaborador bata ponto pelo Portal mobile com:

- entrada;

- saída para intervalo;

- retorno do intervalo;

- saída;

- múltiplos blocos no mesmo dia;

- registro associado à unidade e ao bloco de escala;

- horário do dispositivo e horário do servidor;

- latitude;

- longitude;

- precisão da localização;

- endereço aproximado, quando possível;

- dispositivo e navegador;

- status de validação.

Não aceitar a localização como prova absoluta. Armazenar precisão e status, como dentro do raio, fora do raio, localização indisponível ou revisão necessária.

## 6.2 Política de geolocalização

A empresa deve configurar:

- se a geolocalização é obrigatória;

- raio permitido por unidade;

- tolerância de precisão;

- se batida fora do raio é bloqueada ou apenas enviada para revisão;

- retenção de localização;

- mensagem mostrada ao colaborador.

A permissão de localização deve ser solicitada com explicação clara. Se o usuário negar, mostrar orientação sobre a política da empresa e permitir fluxo de revisão quando configurado.

### Tabelas

Criar:

- `time_entries`;

- `time_entry_reviews`;

- `point_policies`;

- `point_cards`;

- `point_card_deliveries`.

`time_entries` deve possuir referência opcional a `schedule_id` e `schedule_block_id`. Validar empresa, unidade e colaborador no backend.

## 6.3 Cartão de ponto

Criar função para consolidar o cartão de ponto por colaborador e período, exibindo:

- dias trabalhados;

- horários registrados;

- horas planejadas;

- horas realizadas;

- atrasos;

- faltas de batida;

- intervalos;

- localização ou status de localização;

- ajustes aprovados;

- assinatura ou ciência do colaborador, quando aplicável.

Criar tela `/app/point-cards` para o gestor visualizar e disparar cartões de ponto.

Permitir envio por WhatsApp, e-mail ou link seguro do Portal, usando a infraestrutura disponível no Lovable Cloud. O envio deve registrar destinatário, data, status, tentativa, erro e link/token. Não colocar dados sensíveis diretamente no texto da URL.

No Portal, criar `/portal/point-card` para o colaborador consultar o cartão e confirmar ciência ou assinar digitalmente, conforme a política configurada.

Não permitir que o colaborador altere registros sem abrir solicitação de correção auditável.

---

# 7. Itens operacionais, proteção e entrega

O produto precisa controlar itens entregues ou utilizados na operação de restaurantes, mas não tratar todos os itens como EPI industrial.

Separar dois conceitos:

1. **Itens de proteção/uso individual**, como luvas descartáveis, toucas, aventais, máscaras e botas, que podem ser associados a colaborador, cargo ou equipe.

1. **Itens de consumo operacional**, como papel-toalha, papel-filme, guardanapos, embalagens, sacos, produtos de limpeza e insumos gerais, que pertencem ao estoque da unidade e não precisam ser atribuídos a uma pessoa.

Criar catálogo central `catalog_items` com:

- `id`;

- `company_id`;

- `name`;

- `category`;

- `item_type`, como proteção individual, uniforme, ingrediente, embalagem, limpeza ou consumo;

- `unit_of_measure`;

- `photo_url`;

- `minimum_stock`;

- `maximum_stock` opcional;

- `active`.

Para itens individuais, criar `employee_item_deliveries` com colaborador, item, quantidade, data, tamanho, condição, responsável, assinatura e devolução opcional.

Para itens de estoque, usar `stock_movements` e não criar fichas individuais.

Se houver assinatura digital de entrega, utilizar storage seguro para a assinatura e uma tabela de documentos/assinaturas com histórico. Não usar campos de CA, NR ou validade normativa de EPI industrial.

---

# 8. Módulo de Estoque

Criar tela `/app/inventory` como uma das principais áreas do produto.

## 8.1 Dashboard de estoque

Exibir:

- valor ou quantidade total em estoque, se houver custo cadastrado;

- itens abaixo do estoque mínimo;

- itens próximos da validade, quando aplicável;

- entradas recentes;

- saídas recentes;

- perdas/desperdícios;

- itens mais movimentados;

- alertas por unidade;

- dias estimados de cobertura quando houver dados suficientes.

Usar cards visuais, gráficos compactos e filtros por unidade, categoria, período e status.

## 8.2 Cards com fotos

A listagem principal deve usar cards responsivos com:

- foto do ingrediente/produto;

- nome;

- categoria;

- quantidade atual;

- unidade de medida;

- estoque mínimo;

- badge de status: Em estoque, Baixo estoque, Esgotado, Próximo da validade ou Inativo;

- última movimentação;

- ações rápidas de entrada, saída, ajuste e detalhes.

Quando não houver foto, usar um placeholder visual consistente por categoria, sem quebrar o layout.

## 8.3 Cadastro de item

Ao clicar em **Adicionar item**, abrir um formulário ou drawer com:

- nome do produto/ingrediente;

- categoria;

- tipo de item;

- unidade de medida, como kg, g, L, ml, unidade, caixa ou pacote;

- quantidade inicial;

- estoque mínimo;

- estoque máximo opcional;

- custo unitário opcional;

- fornecedor opcional;

- validade opcional;

- lote opcional;

- unidade/filial;

- foto do produto;

- observações.

O upload deve usar Lovable Cloud Storage, validar formato/tamanho, mostrar preview e permitir substituir/remover a imagem.

## 8.4 Movimentações

Criar:

- entrada;

- saída;

- ajuste;

- perda/desperdício;

- transferência entre unidades;

- inventário físico.

Cada movimentação deve registrar item, quantidade, unidade, data, motivo, usuário e referência opcional a fornecedor, venda, receita ou operação.

Não permitir estoque negativo sem configuração explícita. Toda alteração deve gerar histórico.

## 8.5 Tabelas

Criar:

- `inventory_items`;

- `stock_movements`;

- `suppliers`;

- `inventory_counts`;

- `inventory_count_items`;

- `stock_alerts`.

O modelo deve ser preparado para, no futuro, relacionar ingredientes a receitas e vendas, mas não inventar ficha técnica de receita nesta primeira versão se ela não for necessária.

---

# 9. Dashboard de vendas

Criar `/app/sales` como dashboard preparado para receber dados reais de sistemas externos de PDV, ERP ou banco utilizado pelo restaurante.

## 9.1 Camada de integração futura

Criar uma camada de adapters/interfaces para permitir integrações futuras sem acoplar o dashboard a um fornecedor específico.

Criar:

- `sales_connections`;

- `sales_import_jobs`;

- `sales_orders`;

- `sales_order_items`;

- `sales_daily_metrics`.

A conexão deve possuir fornecedor, status, unidade, última sincronização, erro da última sincronização e configuração segura. Não armazenar tokens de terceiros no frontend.

Preparar suporte futuro para:

- API REST;

- webhook;

- importação CSV;

- conexão com banco autorizado;

- sincronização manual;

- sincronização incremental por período.

Não inventar integração com um banco específico agora. Criar uma tela de configuração com estado **Integração ainda não conectada** e instruções para adicionar o provedor posteriormente.

## 9.2 Indicadores

Quando houver dados, exibir:

- vendas brutas;

- vendas líquidas, se disponível;

- quantidade de pedidos;

- ticket médio;

- vendas por dia e horário;

- vendas por unidade;

- vendas por categoria;

- produtos mais vendidos;

- comparativo com período anterior;

- cancelamentos e descontos, se disponíveis;

- margem ou custo somente quando houver dados confiáveis.

Usar gráficos de linha, barras e cards de KPI com filtros por período, unidade, canal, categoria e produto.

Enquanto não houver dados reais, exibir estado vazio informativo. Se houver modo demo, deixar uma indicação visível de **Dados de demonstração**.

---

# 10. Portal do Colaborador

Criar um Portal mobile-first sem instalação de aplicativo, com login por CPF + PIN.

Rotas mínimas:

- `/portal/login`;

- `/portal`;

- `/portal/escala`;

- `/portal/ponto`;

- `/portal/cartao-ponto`;

- `/portal/documentos`;

- `/portal/perfil`.

O colaborador poderá:

- consultar sua escala semanal e mensal;

- visualizar o próximo turno;

- bater ponto com localização, conforme a política da unidade;

- consultar seus registros de ponto;

- consultar e confirmar o cartão de ponto;

- visualizar itens individuais recebidos, quando o módulo estiver habilitado;

- solicitar correção de ponto;

- solicitar troca de turno, se habilitado;

- visualizar avisos da empresa.

Nunca mostrar dados de outros colaboradores. Tratar sessão expirada, tentativas inválidas, localização negada, ausência de escala e falha de conexão com mensagens simples.

---

# 11. Notificações e automações

Criar tabela `notifications` e serviços para:

- escala publicada;

- alteração de escala;

- lembrete de turno;

- cartão de ponto disponível;

- cartão de ponto aguardando ciência;

- estoque baixo;

- validade próxima de item;

- solicitação de troca pendente;

- venda ou sincronização com erro, quando integração existir.

A infraestrutura de envio deve estar preparada para WhatsApp e e-mail, mas não assumir credenciais de provedor que ainda não foram fornecidas. Usar filas, status de envio, retry controlado e idempotência.

Não disparar mensagens duplicadas para o mesmo evento. Registrar template, destinatário, payload mínimo, status, erro e data.

---

# 12. Identidade visual laranja

Criar uma identidade visual original e configurável. Direção visual:

- laranja como cor primária de ação e energia;

- fundo creme ou cinza muito claro;

- superfícies brancas;

- texto grafite;

- laranja escuro para hover;

- verde para indicadores saudáveis;

- amarelo para atenção;

- vermelho somente para erro crítico;

- imagens de ingredientes e produtos com bastante destaque;

- cards arredondados;

- sombras suaves;

- sidebar operacional;

- dashboards com alta legibilidade;

- aparência acolhedora, mas profissional.

Tokens iniciais sugeridos:

```css

--brand-primary: #F97316;

--brand-primary-dark: #C2410C;

--brand-primary-soft: #FFEDD5;

--brand-accent: #FDBA74;

--surface: #FFFFFF;

--background: #FFF7ED;

--text: #1C1917;

--muted: #78716C;

--success: #16A34A;

--warning: #EAB308;

--danger: #DC2626;

--border: #E7E5E4;

```

Esses valores devem ficar centralizados e ser facilmente alteráveis. Não espalhar hexadecimais pelos componentes.

A direção pode se inspirar em dashboards modernos de POS, inventário e gestão de restaurantes: cards de KPI, tabelas acionáveis, thumbnails de alimentos, gráficos compactos, filtros claros e foco em decisões operacionais. Não copiar marcas, logos, textos ou layouts de referências existentes.

## Motion

Usar animações leves:

- entrada suave de cards;

- elevação discreta no hover;

- mudança de status com transição de cor e escala curta;

- gráficos aparecendo quando entram no viewport;

- preview de imagem ao adicionar estoque;

- drawer de cadastro com transição curta;

- microinterações de confirmação após entrada/saída de estoque ou batida de ponto.

Respeitar `prefers-reduced-motion`. Não usar scroll-jacking, loops excessivos ou animações que prejudiquem operação rápida.

---

# 13. Segurança, privacidade e permissões

Aplicar RLS em todas as tabelas com dados da empresa. Validar empresa, unidade, usuário e colaborador no backend.

A geolocalização do ponto deve ser tratada como dado sensível operacional. Informar o motivo da coleta, limitar a finalidade, controlar retenção e restringir acesso. Não mostrar mapa ou coordenadas para usuários que não tenham essa permissão.

Não expor CPF, PIN, localização, assinatura, dados de vendas ou tokens em logs públicos. Não colocar secrets em código frontend.

Toda ação de estoque, ponto, escala, envio de cartão e alteração de permissões deve possuir trilha de auditoria.

---

# 14. Ordem de implementação

Implemente em incrementos, validando o produto ao final de cada etapa:

1. criar projeto Lovable Cloud, autenticação, storage, schema base e RLS;

1. criar empresas, unidades, usuários, permissões, colaboradores, cargos e equipes;

1. criar shell do painel, seleção de unidade e tokens visuais laranja;

1. criar Portal CPF + PIN;

1. criar turnos, configuração contextual de regime, modelos e escalas;

1. criar Portal de escala;

1. criar ponto com múltiplos blocos e geolocalização;

1. criar cartão de ponto, ciência e disparo;

1. criar catálogo de itens e módulo de entregas individuais;

1. criar estoque visual com fotos e movimentações;

1. criar dashboard de vendas com estado sem integração e camada de adapters;

1. criar notificações e automações idempotentes;

1. revisar segurança, RLS, privacidade, responsividade e acessibilidade;

1. criar testes e ativar o produto somente após validação.

---

# 15. Critérios de aceitação

Considere o MVP concluído somente quando:

- o banco estiver criado no Lovable Cloud;

- autenticação, storage, RLS e permissões estiverem funcionando;

- houver suporte a empresas e múltiplas unidades;

- gestores puderem cadastrar colaboradores, cargos e equipes;

- gestores puderem cadastrar turnos, configurar o regime no contexto correto e projetar escalas;

- a escala suportar múltiplos blocos no mesmo dia e turnos que atravessam meia-noite;

- colaboradores puderem consultar a escala no Portal;

- colaboradores puderem bater ponto pelo celular com geolocalização configurável;

- o gestor puder revisar registros e disparar cartão de ponto;

- o colaborador puder consultar e confirmar o cartão de ponto;

- itens como luvas, toucas, aventais, máscaras e botas puderem ser entregues individualmente;

- itens como papel, embalagens, limpeza e ingredientes puderem ser controlados no estoque;

- o estoque tiver cards com fotos, cadastro por formulário e histórico de movimentações;

- o dashboard de vendas estiver pronto para receber API, webhook, CSV ou outro adapter futuro;

- o sistema não inventar dados de vendas quando não houver integração;

- WhatsApp e e-mail estiverem preparados com eventos idempotentes;

- a marca, logo e cores puderem ser alterados em um único local;

- o Portal mostrar somente dados do próprio colaborador;

- os dados de localização forem protegidos e auditáveis;

- a aplicação for responsiva, acessível e utilizável em operação de restaurante;

- os testes cobrirem autenticação, RLS, ponto, geolocalização, estoque, escalas, permissões e estados de erro.

Ao final de cada etapa, informe quais tabelas, políticas, rotas, componentes e funções foram criados. Não avançar para a etapa seguinte se a anterior estiver quebrada.

## Nota de conformidade

Os limites de jornada, retenção de geolocalização, notificações e tratamento de dados pessoais devem ser revisados conforme a legislação e as políticas aplicáveis à operação. O sistema deve tornar essas regras configuráveis e não assumir que um valor padrão serve para todas as empresas.

## Referências de direção

Use como referência de padrões de produto, e não como material para copiar:

- [Oracle — 8 Essential Restaurant Management System Features](https://www.oracle.com/apac/food-beverage/restaurant-pos-systems/restaurant-management-system-features/)

- [Geckoboard — Inventory Dashboard Example](https://www.geckoboard.com/dashboard-examples/operations/inventory-dashboard/)

- [Dribbble — POS Dashboard Designs](https://dribbble.com/tags/pos-dashboard)

- [ThemeForest — Restaurant POS Templates](https://themeforest.net/search/restaurant%20pos)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://myfoodai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0fd3e0f8-d690-4aad-a6a1-00b71206d9cb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
