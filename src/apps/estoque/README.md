# MyFoods Estoque (`/estoque`)

Onde mexer em cada parte. As rotas em `src/routes/_authenticated/estoque*.tsx` só ligam endereço → tela.

| Aba | Endereço | Arquivo |
|---|---|---|
| Visão geral | `/estoque` | `pages/dashboard-page.tsx` |
| Produtos | `/estoque/produtos` | `pages/produtos-page.tsx` (+ `components/product-dialog.tsx`, `components/movement-dialog.tsx`) |
| Movimentações | `/estoque/movimentacoes` | `pages/movimentacoes-page.tsx` |
| Inventário | `/estoque/inventario` | `pages/inventario-page.tsx` |
| Relatórios | `/estoque/relatorios` | `pages/relatorios-page.tsx` (cálculos em `lib/reports.ts`) |
| ⚙ Fornecedores | `/estoque/fornecedores` | `pages/fornecedores-page.tsx` |

- **Movimentar estoque:** sempre por `applyMovement` (`src/lib/stock.shared.ts`) → função do banco `stock_apply_movement` (atômica; histórico só de leitura). Integrações (Compras, Caixa) usam o mesmo caminho com `sourceApp` + `sourceId` (não duplica).
- **Dados:** produto = `catalog_items` (empresa, compartilhado com Documentos/EPIs); saldo = `inventory_items` (um por produto/unidade); histórico = `stock_movements`; visão `stock_position` para relatórios/Executive.
- **Quem acessa:** `src/routes/_authenticated/estoque.tsx` (app contratado + papéis de `lib/roles.ts`); regras no banco em `supabase/migrations/20261025013105_estoque_core.sql`.
- Abas e engrenagem: `components/estoque-shell.tsx`. Textos, unidades de medida e números: `lib/labels.ts`.
