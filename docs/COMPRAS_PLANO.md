# MyFoods Compras — diagnóstico e plano

Data: 2026-10-25 · Situação: **C1, C2 e C3 concluídas** (banco aplicado em produção, app em `/compras`, ativado para a Ramos Food). Decidido: Compras primeiro; depois, cardápio + receitas no Caixa (baixa automática na venda).

## 1. Diagnóstico
| Peça | Situação |
|---|---|
| Fornecedores | `suppliers` existe (nome, documento, contato); tela simples na engrenagem do Estoque |
| Produtos e saldo | Catálogo + saldo por unidade do Estoque; entrada por `stock_apply_movement`, que já aceita origem `compras` e não duplica a mesma linha recebida |
| Pedidos, recebimentos, notas | **Não existem** (nenhuma tabela ou tela) |
| Contas a pagar | `fin_entries` (despesa, vencimento, situação) existe do Caixa & Financeiro, mas a tela financeira foi tirada do escopo |
| App na Central | "MyFoods Compras" aparece como "em breve" (`/compras`), código `app_compras`, papéis dono/admin/gerente/estoquista |

## 2. Como fica para quem usa (simples e automático)
1. **Pedido (opcional):** escolhe o fornecedor; o app **sugere os itens** que estão abaixo do mínimo, com quantidade para voltar ao estoque ideal. Ajusta e **envia pelo WhatsApp** do fornecedor (o texto do pedido vai pronto; você só aperta enviar).
2. **Receber compra:** quando a mercadoria chega —
   - vindo de um pedido: a lista já aparece; você só confere as quantidades e os preços;
   - sem pedido: escolhe o fornecedor e adiciona os produtos.
   Informa nº da nota (opcional) e confirma. **Na hora, tudo entra no estoque da unidade** e o custo do produto é atualizado. O pedido fica "recebido" (ou "recebido em parte").
3. **Errou?** Cancelar o recebimento devolve o estoque (com histórico).

## 3. Plano

### C1 — Banco (migration aditiva + kit de testes; aplicar com autorização)
- Tabelas novas (não existem hoje): `purchase_orders` + `purchase_order_items` (pedido), `purchase_receipts` + `purchase_receipt_items` (recebimento: fornecedor, nota, data, vencimento, valor; linhas com produto, quantidade e custo).
- Função `purchase_receive(...)`: grava o recebimento e dá **entrada no estoque de todas as linhas na mesma operação** (pela `stock_apply_movement`, origem `compras` + id da linha → nunca entra duas vezes); atualiza o recebido do pedido. Produto sem saldo na unidade ganha o saldo na hora.
- Função `purchase_cancel_receipt(...)`: estorna as entradas (saída com origem do cancelamento) e marca como cancelado.
- `stock_apply_movement` passa a aceitar quem gerencia compras (além do estoque) quando a origem é `compras`.
- Acesso: app Compras contratado + dono/admin/gerente/estoquista + unidade. Recebimentos e pedidos não podem ser apagados (só cancelados).
- Guarda vencimento e valor da nota, para que o financeiro possa gerar "conta a pagar" no futuro, sem refazer nada.

### C2 — App `/compras` (mesmo padrão simples do Ponto e Estoque)
| Aba | Conteúdo |
|---|---|
| **Visão geral** | Pedidos em aberto, entregas esperadas, gasto do mês, últimas compras, produtos abaixo do mínimo (botão "Criar pedido") |
| **Pedidos** | Lista e novo pedido com sugestão pelo mínimo; enviar pelo WhatsApp; cancelar |
| **Receber** | Receber de um pedido ou avulso; confirmar = entrada no estoque |
| **Histórico** | Compras por período, fornecedor e produto; preço pago e variação de preço; planilha |
| ⚙ | Fornecedores (o mesmo cadastro do Estoque) |

Central de aplicativos: "MyFoods Compras" deixa de ser "em breve".

### C3 — Verificação e publicação
Testes unitários (sugestão de pedido, totais, texto do WhatsApp), kit SQL (entrada atômica, não duplica, cancelamento devolve, isolamento por empresa/unidade/papel, app não contratado), navegação; aplicar e publicar com autorização.

### Depois (fora desta etapa)
- **Ler a nota fiscal** (XML ou chave da NF-e) para preencher fornecedor, produtos, quantidades e preços sozinho; o app aprende a ligar o código do produto do fornecedor ao seu produto.
- **Conta a pagar automática** no financeiro ao receber (quando o financeiro voltar).
- **Cardápio + receitas no Caixa** (próximo app a mexer): venda por itens baixa o estoque sozinha.

## 4. Como ficou (2026-10-25)
- Migration `20261025020221_compras_core.sql` (aplicada): `purchase_orders`/`purchase_order_items` (número sequencial por empresa; não se apaga, cancela; "recebido" só pelo recebimento; cancelado não volta), `purchase_receipts`/`purchase_receipt_items` (só leitura pela tela), funções `purchase_receive` e `purchase_cancel_receipt`, `stock_apply_movement` aceitando quem gerencia compras quando a origem é `compras`, leitura de saldo e fornecedores para a equipe de compras.
- App `/compras`: Visão geral · Pedidos (sugestão pelo mínimo; enviar pelo WhatsApp; copiar texto; editar; cancelar) · Receber (de um pedido ou avulso; nota, data, vencimento) · Histórico (variação de preço, planilha, cancelar) · ⚙ Fornecedores. Mapa em `src/apps/compras/README.md`.
- Testes: `scripts/security-tests/compras/run.sh` (18) e unitários de sugestão, WhatsApp e preços.
- Conferido em produção (transação desfeita): pedido nº 1 → receber → estoque 14 → 19 e pedido "recebido"; nada ficou gravado.
