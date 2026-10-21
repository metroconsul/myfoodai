# MYFOODS --- Arquitetura do Ecossistema

**Documento:** Especificação arquitetural inicial\
**Versão:** 1.0\
**Status:** Diretriz estratégica aprovada; detalhes técnicos pendentes
de auditoria\
**Objetivo:** Orientar a transformação gradual do MyFoods em uma
plataforma modular de produtos operacionais para restaurantes.

------------------------------------------------------------------------

## 1. Propósito e visão

O MyFoods será um ecossistema de soluções operacionais para restaurantes
e negócios de alimentação. Cada produto resolverá um problema específico
e poderá ser contratado individualmente ou em pacotes.

Os produtos terão interfaces, navegação e experiências próprias,
mantendo uma identidade visual compartilhada e utilizando uma
infraestrutura central comum.

**Posicionamento:** uma plataforma, várias soluções operacionais, com
foco em simplificar a operação e dar visibilidade aos resultados.

O MyFoods deve atender desde pequenos estabelecimentos, nos quais o
proprietário participa da rotina, até redes com várias unidades, nas
quais proprietários acompanham resultados e equipes gerenciam a
operação.

Este documento registra decisões de produto e princípios arquiteturais.
Ele não afirma que a implementação técnica atual já possui todos esses
recursos. O estado real do repositório, banco de dados, autenticação,
pagamentos e políticas de segurança deverá ser descoberto na auditoria.

## 2. Decisões de produto aprovadas

1.  O MyFoods terá um portal central de entrada e seleção de produtos
    (Opção B).
2.  O usuário fará login uma única vez e verá os produtos aos quais tem
    acesso.
3.  Cada produto terá interface e navegação próprias, com identidade
    visual MyFoods compartilhada.
4.  Os produtos poderão ser contratados individualmente.
5.  Também será possível contratar combinações/pacotes de produtos.
6.  O MyFoods Executive ficará para uma fase posterior e será elegível
    somente para organizações com pelo menos dois produtos distintos
    ativos/contratados.
7.  O pacote MyFoods Completo também ficará para uma fase posterior.
8.  A primeira etapa de produtos contempla seis soluções: Ponto,
    Estoque, Compras, Caixa, Financeiro e Documentos.
9.  A transformação deverá preservar as funcionalidades e os dados
    existentes sempre que possível.
10. A implementação será gradual, orientada por auditoria, planejamento
    aprovado, migrações seguras e testes.

## 3. Produtos da primeira etapa

### 3.1 MyFoods Ponto

**Missão:** apoiar a gestão da jornada e dos registros de ponto dos
colaboradores.

Escopo inicial a validar durante a auditoria: - Cadastro e vínculo de
colaboradores, aproveitando o cadastro central. - Registros de entrada,
saída e intervalos, conforme regras de negócio existentes. - Consulta de
registros e histórico. - Tratamento de inconsistências e
justificativas. - Visão e ferramentas administrativas para responsáveis
autorizados. - Portal do colaborador, quando aplicável. - Notificações
operacionais relacionadas a registros e pendências. - Evidências e
validações adicionais somente se já existentes ou aprovadas como
requisito.

O produto não deve duplicar o cadastro central de colaboradores.

### 3.2 MyFoods Estoque

**Missão:** controlar os níveis e movimentações de estoque por
organização e unidade.

Escopo funcional a detalhar: - Catálogo de itens e unidades de medida. -
Categorias. - Saldo por unidade/local de estoque. - Entradas, saídas,
ajustes e transferências, conforme regras aprovadas. - Histórico e
rastreabilidade das movimentações. - Estoque mínimo e alertas. -
Relatórios e inventários.

### 3.3 MyFoods Compras

**Missão:** organizar a necessidade, solicitação, aprovação e
acompanhamento de compras.

Escopo funcional a detalhar: - Listas e solicitações de compra. - Itens,
quantidades e unidade solicitante. - Fluxo configurável de aprovação. -
Fornecedores e informações comerciais. - Status e acompanhamento de
pedidos. - Recebimento e conciliação com estoque, quando integrado. -
Histórico de solicitações e aprovações.

### 3.4 MyFoods Caixa

**Missão:** registrar e acompanhar movimentações operacionais de caixa.

Escopo funcional a detalhar: - Abertura e fechamento de caixa. -
Entradas e saídas. - Sangrias e suprimentos, se aplicável. -
Identificação do operador e da unidade. - Conferência e registro de
divergências. - Histórico de turnos e fechamentos. - Relatórios
operacionais.

O Caixa deve ser conceitualmente distinto do Financeiro. Não presumir
integração automática com adquirentes, bancos ou PDVs sem requisitos e
integrações explicitamente definidos.

### 3.5 MyFoods Financeiro

**Missão:** dar visibilidade sobre receitas, despesas, compromissos e
resultados financeiros.

Escopo funcional a detalhar: - Receitas e despesas. - Categorias e
centros de custo, se necessários. - Contas a pagar e a receber. - Fluxo
de caixa gerencial. - Relatórios por período, unidade e organização. -
Conciliação e importações somente quando houver requisitos e integrações
aprovados.

O Financeiro poderá receber dados do Caixa ou de outros produtos por
integração explícita, com regras de origem, prevenção de duplicidade e
rastreabilidade. Não misturar automaticamente lançamentos operacionais
com lançamentos financeiros.

### 3.6 MyFoods Documentos

**Missão:** organizar documentos empresariais e de colaboradores, com
controle de acesso e vencimentos.

Escopo funcional a detalhar: - Upload, armazenamento e consulta de
documentos. - Organização por organização, unidade e colaborador,
conforme tipo. - Categorias e metadados. - Datas de emissão e
vencimento, quando aplicável. - Alertas de vencimento. - Histórico de
alterações e acesso, conforme necessidade. - Controle de permissões
rigoroso para documentos pessoais e sensíveis.

## 4. Portal Central e experiência de navegação

O portal central será a porta de entrada do ecossistema.

Fluxo esperado:

1.  Usuário acessa o domínio principal do MyFoods.
2.  Realiza autenticação uma única vez.
3.  O sistema identifica sua organização, vínculos, funções e
    permissões.
4.  O portal apresenta os produtos habilitados para aquela organização e
    acessíveis àquele usuário.
5.  O usuário seleciona um produto.
6.  O sistema abre a interface específica do produto sem exigir novo
    login.
7.  O usuário pode retornar ao portal ou alternar entre produtos sem
    autenticar novamente.

Regras: - Exibir apenas produtos contratados/ativos e autorizados para o
usuário. - Não confiar apenas na ocultação de cards ou rotas no
frontend. - Toda operação e consulta deve ser autorizada no backend e,
quando aplicável, nas políticas RLS do Supabase. - A sessão
compartilhada deve respeitar expiração, revogação e segurança. - Um
usuário pode ter acesso a produtos diferentes em unidades diferentes. -
O portal não deve obrigar o cliente a usar uma interface única para
executar todas as tarefas.

## 5. Arquitetura lógica proposta

A arquitetura desejada é modular, com núcleo compartilhado e produtos
separados por domínio funcional.

### 5.1 Núcleo compartilhado (Core)

Responsabilidades esperadas: - Autenticação e sessão. -
Organizações/empresas. - Unidades/filiais. - Usuários e vínculos. -
Colaboradores e seus dados centrais. - Papéis e permissões. - Catálogo
de produtos. - Assinaturas, itens de assinatura e direitos de acesso. -
Configurações comuns. - Notificações e preferências. - Auditoria e
trilhas de eventos, quando aplicável.

### 5.2 Camada de produtos

Cada produto deverá ter: - Rotas e layout próprios. - Componentes
específicos. - Regras de negócio próprias. - Serviços e acesso a dados
delimitados. - Permissões específicas. - Documentação funcional. -
Testes próprios.

Os produtos podem compartilhar componentes de design system,
autenticação, navegação global, notificações e entidades centrais. Não
devem compartilhar indiscriminadamente regras de negócio internas.

### 5.3 Infraestrutura

A arquitetura deverá aproveitar a infraestrutura existente, incluindo
Supabase e Stripe, se a auditoria confirmar seu uso atual e adequação.

Princípio inicial: preferir um único projeto de aplicação modular e uma
infraestrutura de dados compartilhada, com separação lógica por domínio,
em vez de criar seis aplicações e seis bancos independentes.

Isso é uma diretriz, não uma ordem para reestruturar o código antes da
auditoria. O Codex deverá recomendar a menor mudança segura compatível
com a arquitetura atual.

## 6. Multiempresa e multiunidade

O sistema deverá suportar: - Uma organização com uma ou várias
unidades. - Usuários vinculados a uma ou várias organizações, conforme
regras aprovadas. - Colaboradores vinculados à organização e, quando
aplicável, a uma ou mais unidades. - Dados operacionais associados ao
escopo correto (organização, unidade, colaborador, produto). - Usuários
com permissões diferentes entre unidades.

Toda tabela que contenha dados de cliente deverá ter um escopo de
organização claro. Dados específicos de operação deverão também
identificar a unidade quando fizer sentido.

A auditoria deverá mapear o modelo atual e propor migrações compatíveis.
Não criar tabelas paralelas para entidades que já existam sem justificar
a necessidade.

## 7. Perfis e permissões

Perfis iniciais de experiência: - **Proprietário:** acompanha
informações e pode ter visão ampla da organização. - **Administrador:**
configura organização, usuários, produtos e permissões. - **Gerente:**
executa e acompanha operações das unidades autorizadas. -
**Colaborador:** acessa apenas funcionalidades destinadas à sua rotina.

Esses nomes são perfis de referência, não uma autorização automática. O
modelo final deverá permitir permissões granulares por produto, ação e
escopo organizacional/unidade.

Exemplos: - Gerente da Unidade A pode administrar Ponto e Estoque apenas
na Unidade A. - Supervisor regional pode visualizar determinadas
informações de várias unidades. - Proprietário pode visualizar
indicadores consolidados e, se autorizado, detalhes operacionais. -
Colaborador pode registrar ponto e consultar seus próprios documentos,
sem acessar dados de outros colaboradores.

Requisitos de segurança: - Menor privilégio por padrão. - Verificação no
servidor/backend. - RLS no Supabase quando aplicável. - Testes negativos
para impedir acesso cruzado entre organizações e unidades. - Não
considerar `user_metadata` controlável pelo usuário como fonte confiável
de autorização. - Mudanças de papel, vínculo ou acesso devem surtir
efeito de forma segura, inclusive em sessões existentes.

## 8. Catálogo de produtos, contratação e direitos de acesso

O catálogo central deverá representar os produtos comercializáveis e,
futuramente, pacotes.

Conceitos a avaliar na auditoria/modelagem: - Produto. - Plano/preço. -
Assinatura da organização. - Itens/produtos incluídos na assinatura. -
Status de assinatura e de cada item. - Período de vigência. - Limites
comerciais (por exemplo, unidades ou colaboradores), se definidos. -
Direitos de acesso derivados da assinatura. - Histórico de alterações e
eventos de cobrança.

Regras comerciais: 1. Cada um dos seis produtos pode ser contratado
individualmente. 2. Combinações de produtos poderão ser vendidas como
pacotes. 3. Uma organização pode possuir vários produtos. 4. Ativar ou
cancelar um produto não deve cancelar ou bloquear os demais produtos
ativos. 5. A autorização de acesso deve considerar status da assinatura,
produto, organização, usuário, papel e escopo. 6. O frontend pode
ocultar produtos indisponíveis, mas o backend deve negar acesso não
autorizado. 7. Webhooks de pagamento devem ser idempotentes e validar
eventos antes de alterar direitos de acesso. 8. Falhas temporárias de
webhook não devem gerar estados inconsistentes; prever reconciliação e
registro de eventos. 9. Cancelamento, inadimplência, período de carência
e reativação precisam de regras comerciais explícitas antes da
implementação.

Não inventar preços, limites, período de carência ou política de
inadimplência. Esses dados serão definidos separadamente.

## 9. MyFoods Executive --- fase futura

O Executive não faz parte da primeira entrega.

Regra estratégica aprovada: uma organização só poderá contratar/usar o
MyFoods Executive se tiver pelo menos dois produtos distintos
contratados e ativos.

A elegibilidade não significa que todos os indicadores estarão
disponíveis. O Executive deverá mostrar somente métricas sustentadas
pelos produtos contratados e pelos dados existentes.

O Executive será uma camada de leitura e consolidação, não um novo lugar
para duplicar a operação. A modelagem futura deverá considerar: -
Indicadores por organização e unidade. - Comparações entre unidades. -
Alertas consolidados. - Pendências relevantes. - Visões diferentes para
proprietário, administrador e supervisores. - Definições documentadas de
cada indicador e sua origem.

O pacote MyFoods Completo também fica fora do escopo da primeira etapa.

## 10. Integração entre produtos

Produtos independentes podem compartilhar dados quando houver benefício
operacional e regras explícitas.

Integrações potenciais: - Ponto ↔ colaboradores e unidades. - Estoque ↔
Compras (solicitações, recebimento e atualização de saldo). - Caixa ↔
Financeiro (movimentações e consolidação, conforme regras). - Documentos
↔ colaboradores e organização. - Todos ↔ notificações e núcleo central.

Princípios: - Definir qual produto é a fonte oficial de cada dado. -
Evitar duplicação de registros. - Definir identificadores e relações
estáveis. - Registrar origem e histórico de alterações relevantes. -
Tratar falhas e reprocessamentos. - Não criar dependência obrigatória
entre produtos que podem ser contratados isoladamente. - Um produto deve
continuar funcionando quando outro não estiver contratado, exceto por
recursos de integração claramente identificados.

## 11. Notificações e automações

O MyFoods poderá executar automações baseadas em regras e eventos, sem
exigir IA generativa.

Exemplos: - Inconsistência de ponto → notificação ao gerente
autorizado. - Estoque abaixo do mínimo → alerta e, se habilitado,
sugestão/solicitação de compra. - Solicitação de compra aguardando
aprovação → notificação ao aprovador. - Documento próximo do vencimento
→ alerta ao responsável. - Divergência no fechamento de caixa → aviso ao
perfil autorizado.

Diretrizes: - Notificações devem ter destinatário, contexto, origem e
prioridade. - Respeitar permissões e escopo da unidade. - Evitar
duplicidade e excesso de notificações. - Permitir registro de
entrega/leitura quando aplicável. - Não incluir informações sensíveis no
conteúdo de notificações sem necessidade. - Usar o mecanismo técnico
mais simples e confiável para cada caso. - n8n pode ser usado para
integrações e orquestrações externas, mas operações essenciais e regras
críticas devem permanecer em serviços controlados pelo backend quando
apropriado. - O mascote/assistente atual deve ser preservado se estiver
funcionando. Ele pode comunicar eventos e lembretes sem depender de IA.

## 12. Identidade visual e experiência

Todos os produtos compartilham: - Marca MyFoods. - Tokens de design
(cores, tipografia, espaçamentos, bordas e estados). - Padrões de
acessibilidade. - Componentes globais reutilizáveis. - Padrões de
feedback, carregamento, erros e notificações.

Cada produto terá: - Nome e identificação próprios dentro da marca. -
Layout e navegação adequados à tarefa. - Dashboard específico. - Menus e
ações relacionados ao seu domínio. - Fluxos otimizados para seus
usuários principais.

Não transformar os seis produtos em seis cópias da mesma tela. A
identidade é compartilhada; a experiência é específica.

## 13. Princípios de segurança, privacidade e conformidade

-   Aplicar isolamento de dados entre organizações e unidades.
-   Restringir documentos pessoais e dados de colaboradores.
-   Aplicar menor privilégio.
-   Validar entradas no backend.
-   Proteger segredos e chaves; nunca expor credenciais privilegiadas no
    frontend.
-   Usar RLS corretamente no Supabase, se aplicável.
-   Registrar operações administrativas sensíveis.
-   Definir retenção, exclusão e exportação de dados conforme requisitos
    legais e contratuais.
-   Considerar LGPD desde o desenho dos fluxos.
-   Não tratar validação facial ou biometria como simples dado comum;
    qualquer uso deve passar por revisão específica de finalidade, base
    legal, segurança, retenção e acesso.
-   Não executar migrações destrutivas sem backup, plano de reversão e
    aprovação explícita.

## 14. Estratégia de implementação

A implementação deverá ocorrer em etapas pequenas e revisáveis.

### Etapa 0 --- Auditoria (sem alterações funcionais)

Mapear: - Estrutura do repositório. - Stack e versões. - Rotas e
layouts. - Módulos e funcionalidades existentes. - Supabase: tabelas,
views, funções, triggers, buckets, policies e migrations. - Autenticação
e autorização. - Stripe e webhooks. - Variáveis de ambiente (nomes e
uso, nunca revelar valores secretos). - Notificações e integrações. -
Testes, build e deploy. - Dívidas técnicas e riscos.

Entregável: relatório de auditoria com evidências do código e lista de
dúvidas.

### Etapa 1 --- Plano de transformação

Produzir: - Mapa entre arquitetura atual e proposta. - O que será
preservado. - O que será refatorado. - Modelo de dados proposto. - Plano
de permissões e RLS. - Plano de assinaturas e direitos de acesso. -
Rotas e navegação do portal central. - Plano de migração e rollback. -
Testes e critérios de aceite. - Ordem recomendada de implementação.

Nenhuma alteração estrutural deve ser aplicada antes da revisão e
aprovação do plano.

### Etapa 2 --- Núcleo e portal central

Implementar somente após aprovação: - Catálogo e ativação de produtos. -
Portal central e seleção de produtos. - Navegação compartilhada e sessão
única. - Modelo de organização/unidades/usuários, se necessário. -
Permissões e direitos de acesso. - Testes de isolamento e autorização.

### Etapa 3 --- Separação e entrega dos seis produtos

Ordem inicial de trabalho: 1. MyFoods Ponto. 2. MyFoods Estoque. 3.
MyFoods Compras. 4. MyFoods Caixa. 5. MyFoods Financeiro. 6. MyFoods
Documentos.

A ordem poderá ser ajustada após a auditoria, conforme dependências e
maturidade atual.

Cada produto terá especificação funcional própria, revisão de escopo,
implementação, testes e validação antes de avançar.

### Etapa 4 --- Comercialização

-   Landing page principal.
-   Página comercial de cada produto.
-   Contratação individual.
-   Pacotes.
-   Checkout e gestão de assinatura.
-   Ativação/desativação segura de direitos de acesso.

A implementação comercial deve respeitar a integração Stripe já
existente, se validada pela auditoria.

### Etapa 5 --- Automações e evolução

-   Alertas e notificações.
-   Fluxos entre produtos.
-   Relatórios operacionais.
-   Métricas e instrumentação.
-   Preparação futura do Executive, sem implementá-lo nesta primeira
    etapa.

## 15. Regras obrigatórias para o Codex

Estas regras devem ser seguidas em todas as tarefas do projeto:

1.  Antes de alterar código, ler este documento e a documentação
    específica do produto.
2.  Na primeira tarefa, executar apenas auditoria. Não editar código,
    schema, policies, migrations, dados ou configurações.
3.  Não presumir que funcionalidades descritas como objetivo já existem.
4.  Não recriar o projeto, banco ou autenticação sem necessidade
    comprovada.
5.  Não apagar, substituir ou simplificar funcionalidades existentes sem
    aprovação.
6.  Preservar fluxos que já funcionam.
7.  Não fazer refatorações amplas fora do escopo da tarefa.
8.  Não aplicar migrações no ambiente remoto sem plano, backup, revisão
    e aprovação explícita.
9.  Não executar comandos destrutivos ou alterações de produção sem
    autorização.
10. Nunca expor ou registrar valores de segredos, tokens, senhas ou
    chaves privadas.
11. Manter compatibilidade com dados existentes e fornecer plano de
    migração/rollback.
12. Implementar validação no servidor e segurança no banco, não apenas
    no frontend.
13. Criar ou atualizar testes para cada alteração relevante.
14. Executar verificações disponíveis (lint, typecheck, testes e build)
    e informar resultados reais.
15. Ao concluir cada tarefa, apresentar arquivos alterados, migrations
    criadas (sem aplicá-las sem aprovação), riscos, testes e pendências.
16. Se houver ambiguidade que possa afetar dados, segurança, cobrança ou
    comportamento existente, parar e perguntar antes de decidir.
17. Trabalhar em mudanças pequenas, isoladas e revisáveis.
18. Não introduzir IA generativa como dependência dos produtos sem
    requisito e aprovação específicos.

## 16. Critérios gerais de qualidade

A arquitetura será considerada encaminhada corretamente quando: - O
usuário puder entrar por um portal central. - A lista de produtos
refletir contratação e permissões. - Cada produto possuir interface
própria. - Os produtos compartilharem identidade visual e núcleo
comum. - Uma conta puder acessar mais de um produto sem novo login. - O
acesso a dados respeitar organização, unidade, papel e produto. -
Produtos individuais não dependerem da contratação dos demais. - Pacotes
puderem representar múltiplos produtos sem duplicar cadastros. -
Cancelar um produto não afetar os demais. - Dados existentes forem
preservados. - Os fluxos atuais continuarem funcionando. - Testes
cobrirem acesso permitido e negado.

## 17. Questões que a auditoria precisa responder

O Codex não deve adivinhar. Deve identificar e documentar:

1.  Qual framework, linguagem, estrutura e versões são usados?
2.  Como as rotas e layouts estão organizados?
3.  Quais produtos/módulos já existem e em que estado?
4.  Quais funcionalidades estão em produção ou são consideradas
    estáveis?
5.  Como estão modelados usuários, empresas, unidades e colaboradores?
6.  Como funciona a autenticação e a recuperação de sessão?
7.  Quais policies RLS existem e quais tabelas não possuem isolamento
    adequado?
8.  Como Stripe está integrado? Quais produtos, preços, webhooks e
    estados existem?
9.  Quais notificações, serviços externos e automações existem?
10. Há duplicidade de tabelas ou cadastros?
11. Quais dados e fluxos podem ser afetados pela modularização?
12. Qual a menor sequência segura de mudanças?
13. Quais decisões precisam de confirmação do responsável pelo produto?

## 18. Próximos entregáveis

Após este documento:

1.  **Prompt 01 --- Auditoria técnica:** leitura completa e relatório,
    sem alterações.
2.  **Prompt 02 --- Plano de transformação:** proposta técnica baseada
    na auditoria, ainda sem implementação.
3.  **Prompt 03 --- Núcleo/portal central:** somente após aprovação do
    plano.
4.  **Especificações e prompts individuais:** Ponto, Estoque, Compras,
    Caixa, Financeiro e Documentos.
5.  **Prompts de integração e comercialização:** assinaturas, pacotes,
    Stripe, landing pages e automações.

------------------------------------------------------------------------

**Princípio orientador:** o MyFoods deve parecer e funcionar como
produtos especializados para cada necessidade, mas operar sobre uma
plataforma central segura e compartilhada. A evolução deve ser gradual,
sem reconstrução desnecessária e sem comprometer o que já funciona.
