# MyFoods Cardápio Digital (pedido por link e QR code) — diagnóstico e plano

Data: 2026-10-25 · Situação: **aguardando decisões e aprovação** (nada implementado). Substitui o app Estoque na Central.

## 1. O que já existe e pode ser reaproveitado
| Peça | Onde | Uso no cardápio digital |
|---|---|---|
| Itens do cardápio (nome, categoria, preço, ativo, ordem) | ramo `cardapio-caixa` (não aplicado) | Base do cardápio; ganha foto e descrição. A parte de receita/estoque fica de fora. |
| Venda por itens no Caixa | ramo `cardapio-caixa` | Mais tarde: pedido entregue vira venda no caixa com um toque |
| Lojas, empresa, papéis, Central de aplicativos | produção | Cada loja tem seu cardápio, seu link e seus QR codes |
| WhatsApp (link com mensagem pronta) | Compras | Avisar a loja / o cliente |

Não existe nada público (sem login) no sistema hoje: o cardápio será a primeira página aberta a clientes — exige cuidado extra de segurança.

## 2. Como fica
**Cliente (sem login, pelo celular):**
1. Abre o link (`myfoodsai.com/c/nome-da-loja`) ou lê o QR code da mesa (`…?mesa=5`).
2. Vê o cardápio por categoria (foto, descrição, preço), monta o pedido, informa nome (e telefone, se for retirada) e observações.
3. Envia. Recebe uma página do pedido para acompanhar: recebido → em preparo → pronto.

**Loja (app `/cardapio`):**
- **Pedidos** (tela principal, atualiza sozinha com aviso sonoro): novos em destaque; botões Aceitar → Em preparo → Pronto → Entregue (ou Recusar).
- **Cardápio:** itens com foto, descrição, preço, categoria; esgotado/disponível com um toque.
- **Link e QR codes:** link da loja para mandar ao cliente; QR por mesa para imprimir (PDF com os QR codes).
- **Configurações:** loja aberta/fechada, horário, modalidades aceitas, WhatsApp da loja.

## 3. Segurança (página pública)
- O cliente só lê o cardápio de lojas publicadas e só cria pedido por uma função do banco que confere tudo: preço vem do banco (não do celular), item disponível, loja aberta, limites de quantidade e de pedidos por minuto, textos com tamanho máximo.
- O cliente nunca lê pedidos de outros; acompanha o seu por um código secreto no link.
- Dados do cliente (nome, telefone) só visíveis para a equipe da loja.

## 4. Etapas
- **D1 — Banco:** cardápio (itens com foto/descrição), configurações da loja (endereço público/slug, aberta, modalidades), pedidos e itens do pedido, função pública de pedido, acompanhamento por código; app `app_cardapio` na Central; kit de testes (inclusive tentativas de abuso pela página pública).
- **D2 — Página pública** do cardápio e do pedido (leve, rápida no celular).
- **D3 — App da loja** (Pedidos, Cardápio, Link e QR codes, Configurações).
- **D4 — Depois:** pedido entregue vira venda no Caixa; pagamento online (Mercado Pago); delivery com endereço e taxa.

## 5. Decisões pendentes
1. Modalidades no começo: **mesa (QR)** e **retirada no balcão (link)**? Delivery fica para depois?
2. Pagamento no começo: **na hora, no balcão/mesa** (sem pagamento online)?
3. Fotos dos itens: subir no próprio app (armazenamento do Supabase)?
4. QR code: gerar com uma biblioteca pequena e conhecida de QR (a geração do QR é complexa para fazer à mão) — autoriza adicionar?
