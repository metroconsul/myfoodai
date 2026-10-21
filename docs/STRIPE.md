# Stripe Billing

O Checkout usa exclusivamente o catálogo em `src/config/billing.ts`. O navegador
envia apenas `planId` e `cycle`; o servidor resolve o Price ID permitido, associa
usuário e empresa em metadata e `client_reference_id`, e reutiliza o Customer já
gravado para a empresa.

## Variáveis do servidor

```sh
APP_URL=https://SEU-DOMINIO-PUBLICO
STRIPE_API_KEY= # chave restrita ou secreta, somente no servidor
STRIPE_WEBHOOK_SECRET=whsec_...
```

Nunca prefixe nenhuma delas com `VITE_` e não as envie ao Git.

## Webhook de produção

Depois de publicar o servidor Node, configure na Stripe:

`https://SEU-DOMINIO-PUBLICO/api/public/stripe-webhook`

Eventos: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
e `invoice.payment_failed`.

O retorno do Checkout não libera acesso. O webhook confirma a assinatura e grava
o status Stripe no Supabase. Somente `active` e `trialing` liberam uma assinatura
comercial; `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`
e `paused` ficam bloqueados. Concessões administrativas permanecem explícitas.

O Customer Portal está disponível no backend por `createCustomerPortalSession`.
Antes de expor um botão, configure o Customer Portal no Dashboard Stripe.
