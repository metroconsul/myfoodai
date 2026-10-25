# MyFoods Compras (`/compras`)

Onde mexer em cada parte. As rotas em `src/routes/_authenticated/compras*.tsx` só ligam endereço → tela.

| Aba | Endereço | Arquivo |
|---|---|---|
| Visão geral | `/compras` | `pages/dashboard-page.tsx` |
| Pedidos | `/compras/pedidos`, `/compras/pedidos/$id` | `pages/pedidos-page.tsx`, `pages/pedido-page.tsx` (+ `components/new-order-dialog.tsx`) |
| Receber | `/compras/receber?pedido=` | `pages/receber-page.tsx` |
| Histórico | `/compras/historico` | `pages/historico-page.tsx` |
| ⚙ Fornecedores | `/compras/fornecedores` | o mesmo de `src/apps/estoque/pages/fornecedores-page.tsx` |

- **Receber** chama a função do banco `purchase_receive` (entrada no estoque de todas as linhas numa operação; `client_key` evita registro duplo). **Cancelar** chama `purchase_cancel_receipt` (devolve o estoque). Regras no banco: `supabase/migrations/20261025020221_compras_core.sql`.
- **Sugestão de pedido, texto e link do WhatsApp, variação de preço:** `lib/rules.ts` (testes em `lib/compras.test.ts`).
- Lista de produtos com quantidade e preço (pedido e recebimento): `components/line-editor.tsx` + `lib/lines.ts`.
- Tipos das tabelas novas (até regenerar os tipos do Supabase): `lib/db.ts`. Quem acessa: `src/routes/_authenticated/compras.tsx` + `lib/roles.ts`.
