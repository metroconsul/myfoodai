# MyFoods Cardápio Digital

**Cliente (sem login):** `/c/<endereço>` (link) e `/c/<endereço>?mesa=5` (QR da mesa) → `src/routes/c.$slug.index.tsx` + `pages/public-menu-page.tsx`; acompanhamento `/c/<endereço>/pedido/<código>` → `pages/public-order-page.tsx`. Pagamento na conta, no final (mesa) ou no balcão (retirada).

**Loja (`/cardapio`, com login):**

| Aba | Endereço | Arquivo |
|---|---|---|
| Pedidos (atualiza a cada 5 s, som) | `/cardapio` | `pages/pedidos-page.tsx` |
| Mesas (contas abertas, fechar conta) | `/cardapio/mesas` | `pages/mesas-page.tsx` |
| Cardápio (itens, foto, esgotado) | `/cardapio/itens` | `pages/itens-page.tsx` |
| Link e QR code (PDF das mesas) | `/cardapio/divulgar` | `pages/divulgar-page.tsx` |
| ⚙ Configurações (endereço, aberto/fechado…) | `/cardapio/configuracoes` | `pages/config-page.tsx` |

- **Banco:** `supabase/migrations/20261025114204_cardapio_digital.sql`. O cliente só usa as funções `dm_public_menu`, `dm_place_order` (preço do banco, loja aberta, limites, sem duplicar) e `dm_order_status` (código secreto). A equipe lê/atualiza pelas regras de acesso; fechar conta: `dm_close_tab`. Testes: `scripts/security-tests/cardapio-digital/run.sh`.
- **Regras puras** (carrinho, endereço, etapas, conta): `lib/rules.ts`; **QR**: `lib/qr.ts` (biblioteca `qrcode-generator`); **PDF dos QR**: `buildQrSheetPdf` em `src/lib/simple-pdf.ts`; **foto** reduzida no navegador: `lib/photo.ts` (bucket público `menu-photos`, pasta da empresa).
- **Quem acessa:** qualquer funcionário com login (pedidos, mesas, esgotado); dono/admin/gerente (cardápio, configurações, fotos).
