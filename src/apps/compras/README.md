# MyFoods Compras (`/compras`) — listas de compras

Listas do que falta, por loja, no estilo das Notas; exportar em PDF e enviar para quem faz as compras (decisão de 2026-10-25).
Sem fornecedores, preços ou estoque. As rotas em `src/routes/_authenticated/compras*.tsx` só ligam endereço → tela.

| Tela | Endereço | Arquivo |
|---|---|---|
| Listas da loja | `/compras` | `pages/listas-page.tsx` |
| Uma lista | `/compras/lista/$id` | `pages/lista-page.tsx` |
| ⚙ Quem faz as compras | `/compras/comprador` | `pages/comprador-page.tsx` |

- **Regras puras** (ordem dos itens, "Leite 6 L" → nome + quantidade, texto do WhatsApp, linhas do PDF, nome do arquivo): `lib/rules.ts` (testes em `lib/listas.test.ts`).
- **PDF** sem dependências: `src/lib/simple-pdf.ts`. **Enviar/baixar** (compartilhar no celular; no computador baixa + WhatsApp): `lib/share.ts`.
- **Quem acessa:** qualquer funcionário com login da empresa com o app; apagar lista e definir comprador: dono/admin/gerente. Regras no banco: `supabase/migrations/20261025112419_compras_listas.sql` (testes: `scripts/security-tests/listas/run.sh`).
- As tabelas da versão anterior (pedidos/recebimentos, `20261025020221_compras_core.sql`) continuam no banco, sem uso.
