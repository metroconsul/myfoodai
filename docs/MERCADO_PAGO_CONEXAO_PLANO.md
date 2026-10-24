# Conectar Mercado Pago (botão) — plano técnico

Data: 2026-10-24 · Aprovado para iniciar pelo responsável. Escopo: **somente leitura** das vendas recebidas pelo Mercado Pago. Nada de cobrar, pagar, estornar ou movimentar dinheiro.

## 1. Experiência do dono
1. Em **Caixa & Financeiro → Vendas**, botão **"Conectar Mercado Pago"**.
2. Vai para a tela do Mercado Pago, faz login e aprova o acesso.
3. Volta para o MyFoods com "Mercado Pago conectado". As vendas (maquininha Point, Pix, link) passam a aparecer em Vendas, junto das do caixa.
4. Botões **"Sincronizar agora"** e **"Desconectar"**. Situação visível: última sincronização, erro (se houver).

## 2. Como funciona (OAuth do Mercado Pago, fluxo "authorization code" com PKCE)
Fonte: [Mercado Pago — OAuth](https://www.mercadopago.com.br/developers/en/docs/security/oauth/creation).
- Autorização: `https://auth.mercadopago.com/authorization?client_id=…&response_type=code&platform_id=mp&state=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256`.
- Troca do código (válido por 10 min): `POST https://api.mercadopago.com/oauth/token` com `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`, `code_verifier`.
- Token de acesso vale **180 dias**; renovação com `refresh_token` antes de vencer, sem o dono aprovar de novo.
- `redirect_uri` precisa ser **idêntica** à cadastrada no aplicativo do Mercado Pago (URL fixa).
- Avisos (webhooks) configurados **uma vez** no aplicativo da MyFoods ([Webhooks](https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-content/notifications/webhooks)): tópico `payment` (vendas) e `mp-connect` (vínculo/desvínculo de conta). Assinatura HMAC conferida em cada aviso; respostas 200 (senão o MP reenvia).

## 3. Componentes
| Parte | O que é |
|---|---|
| Migration aditiva | `provider_connections` (empresa, unidade padrão das vendas, provedor, conta MP, situação, última sincronização, erro) — leitura para dono/admin/financeiro da empresa; `provider_tokens` (tokens **criptografados**, só `service_role`); `provider_oauth_states` (state + PKCE, expira em 10 min, só `service_role`). |
| Criptografia | AES-256-GCM no servidor com chave em variável de ambiente; tokens nunca vão ao navegador nem a logs. |
| Server function `startMercadoPagoConnect` | Dono/admin, app Caixa & Financeiro ativo → cria state + PKCE e devolve a URL de autorização. |
| Rota `GET /api/public/mercado-pago/callback` | Confere state (uso único, prazo), troca o código, grava tokens, marca conectado, volta para Vendas. |
| Sincronização | `GET /v1/payments/search` com o token da empresa (últimos N dias, paginado) → `sales_orders` (id do pagamento como `external_id`, valor bruto, valor líquido, data de aprovação, canal = tipo de pagamento, cancelado se estornado) e `sales_daily_metrics`. Idempotente. |
| Rota `POST /api/public/mercado-pago/webhook` | Confere assinatura → identifica a conta (user_id) → busca o pagamento → grava. |
| Renovação | Rotina que renova tokens com menos de 30 dias de validade (endpoint de automação já existente, protegido por segredo). |
| Tela | Card do Mercado Pago em Vendas: conectar, sincronizar, desconectar, situação. |
| Testes | Kit SQL (isolamento da tabela de conexões, tokens inacessíveis ao cliente), testes unitários (mapeamento pagamento → venda, PKCE, criptografia), teste com contas de teste do Mercado Pago. |

## 4. O que o responsável faz no painel do Mercado Pago (conta da MyFoods)
1. Em **Suas integrações**, criar o aplicativo "MyFoods".
2. Ativar OAuth (fluxo authorization code, com PKCE).
3. URL de redirecionamento: `https://myfoodsai.com/api/public/mercado-pago/callback`.
4. Webhooks: `https://myfoodsai.com/api/public/mercado-pago/webhook`, eventos **Pagamentos** e **Vinculação de aplicações**.
5. Copiar **Client ID**, **Client Secret** e a **chave secreta do webhook** para as variáveis de ambiente da Vercel (`MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET`) e para o `.env.local` — **feito pelo responsável**, as credenciais não passam pelo assistente.
6. Gerar a chave `CONNECTIONS_ENCRYPTION_KEY` (o assistente informa o comando; o valor é colado só na Vercel e no `.env.local`).

## 5. Limites e riscos
- Só lê vendas do próprio estabelecimento que autorizou; o dono pode desconectar a qualquer momento (no MyFoods ou no Mercado Pago).
- Vendas do Mercado Pago **não** viram movimento de caixa automaticamente (evita contar duas vezes a venda já registrada no caixa).
- Teste de ponta a ponta exige a URL pública (`myfoodsai.com`); o Mercado Pago não aceita `localhost` como redirecionamento em produção.
- Achado ao revisar: a tela atual de conexões de vendas guarda o segredo do webhook em `sales_connections.config`, que hoje é legível por usuários da empresa. A conexão do Mercado Pago **não** usará esse campo; corrigir o caso antigo à parte.

## 6. Como ficou na implementação (2026-10-24)
- **Conexão:** em vez de uma tabela nova `provider_connections`, reaproveita `sales_connections` (`provider = 'mercado_pago'`, `adapter_type = 'oauth'`, `config` só com o número da conta, sem segredo). Assim as vendas usam o `connection_id` de `sales_orders` e a regra de leitura já existente. Índice garante uma conexão Mercado Pago por empresa.
- **Tokens:** `provider_tokens` (AES-256-GCM, só `service_role`; uma conta MP não fica em duas empresas). **Estado OAuth:** `provider_oauth_states` (uso único, 10 min, só `service_role`).
- **Permissão:** função `mp_manage_company()` (dono/admin/financeiro e app Caixa & Financeiro ativo).
- **Vendas:** só `sales_orders` (aprovadas; estornadas/contestadas como canceladas). **Não** grava em `sales_daily_metrics`, para não sobrescrever os totais diários do PDV (a tabela é única por unidade/dia).
- **Renovação do token:** feita na hora de usar (sincronização ou aviso), quando faltam menos de 30 dias. Não precisa de rotina agendada.
- **Ao conectar:** importa os últimos 30 dias. Depois, cada pagamento chega pelo aviso (webhook); "Sincronizar agora" busca de novo os 30 dias.
- **Código:** `src/lib/mercado-pago.{shared,server,functions,db}.ts`, rotas `src/routes/api/public/mercado-pago/{callback,webhook}.ts`, card `src/apps/caixa-financeiro/components/mercado-pago-card.tsx`.
- **Testes:** `src/lib/mercado-pago.test.ts` (mapeamento, PKCE, criptografia, assinatura) e `scripts/security-tests/mercado-pago/run.sh` (12 testes de acesso no banco).
- **Tela Vendas (decisão de 2026-10-24):** uma seção só. As vendas do caixa e as do Mercado Pago aparecem juntas na mesma lista e nos mesmos totais; as estornadas do Mercado Pago aparecem riscadas e não entram na soma. O card "Mercado Pago" (conectar, sincronizar, desconectar) fica logo abaixo dos totais. A seção antiga de vendas do PDV saiu da aba Vendas do app (continua em `/app/sales`).
