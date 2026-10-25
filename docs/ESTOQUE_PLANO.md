# MyFoods Estoque — diagnóstico e plano

Data: 2026-10-25 · Situação: **E1, E2 e E3 concluídas** (banco aplicado em produção e app em `/estoque`).

## 1. Diagnóstico

### 1.1 O que já existe
| Peça | Onde | Situação |
|---|---|---|
| Cadastro de produtos (empresa) | `catalog_items` (nome, categoria em texto, tipo, unidade de medida em texto, mínimo/máximo) | Tela "Itens operacionais" em `/app/items`. **Compartilhado com Documentos** (EPIs e uniformes usam o mesmo catálogo). |
| Saldo por unidade | `inventory_items` (quantidade, mínimo, custo, lote, validade, fornecedor, `catalog_item_id` opcional) | Tela "Estoque" em `/app/inventory` |
| Movimentações | `stock_movements` (entrada, saída, ajuste, perda, transferência, inventário; antes/depois; custo; motivo; referência) | Gravadas pela função `applyStockMovement` e pela **entrega de EPIs** (Documentos) |
| Alertas | `stock_alerts` | Criados quando o saldo fica no mínimo ou abaixo |
| Inventário (contagem) | `inventory_counts`, `inventory_count_items` | Tabelas existem, **sem tela** |
| Fornecedores | `suppliers` | Tabela existe, **sem tela** |
| Compras | — | Não existe |

Dados em produção: 1 produto no catálogo (um uniforme), 1 saldo, 3 movimentações, nenhum alerta, inventário ou fornecedor. **Risco baixo para mudar.**

### 1.2 Problemas encontrados
1. **Saldo pode ficar errado.** O saldo é lido, calculado no aplicativo e regravado em passos separados (movimento e saldo não são gravados juntos). Duas movimentações ao mesmo tempo podem perder uma delas; uma falha no meio deixa movimento sem saldo atualizado (ou o contrário). Acontece nos dois lugares que mexem no estoque (estoque e entrega de EPIs).
2. **Histórico pode ser editado.** Gestores conseguem alterar e apagar movimentações direto pelo banco; o histórico não é confiável para auditoria.
3. **Alertas duplicados.** Cada movimentação abaixo do mínimo cria um alerta novo para o mesmo produto.
4. **Transferência procura o produto pelo nome** na outra unidade; se o nome for diferente, a entrada não acontece e o estoque some.
5. **Produto duplicado por unidade.** O saldo repete nome, categoria, unidade e mínimo do catálogo e pode existir sem vínculo com ele; nada impede dois saldos do mesmo produto na mesma unidade.
6. **Acesso no banco.** As tabelas não conferem se a empresa contratou o app Estoque, e qualquer papel com acesso à unidade (caixa, staff, financeiro) lê saldos e custos.
7. Categorias e unidades de medida são texto livre (ex.: "kg", "Kg", "quilo").

## 2. Plano

### E1 — Base no banco (migration aditiva, com kit de testes; aplicar com autorização)
Sem tabelas duplicadas: reaproveita `catalog_items` (produto), `inventory_items` (saldo por unidade), `stock_movements` (histórico), `stock_alerts`, `inventory_counts`, `suppliers`.
- **Movimentação em uma única operação no banco:** função `stock_apply_movement(...)` que trava o saldo, grava o movimento e o novo saldo juntos, confere saldo negativo, cuida do alerta e registra auditoria. Toda tela e integração passa por ela — inclusive a entrega de EPIs (ajuste pequeno em `deliveries.functions.ts`, mesmo comportamento).
- **Histórico só de leitura:** ninguém altera nem apaga movimentações; correção é um novo ajuste.
- **Um produto = um saldo por unidade:** vínculo obrigatório com o catálogo (`catalog_item_id`) e no máximo um saldo por produto/unidade (o único saldo atual é ligado ao seu produto).
- **Transferência pelo produto** (não pelo nome); cria o saldo na unidade de destino se não existir.
- **Um alerta aberto por produto/unidade**, resolvido sozinho quando o saldo volta acima do mínimo.
- **Inventário:** abrir contagem da unidade → informar quantidades contadas → fechar gera os ajustes (movimento "inventário") de uma vez.
- **Preparado para integração:** cada movimento guarda a origem (`source_app`: estoque, documentos, compras, caixa; `source_id`). A mesma origem não gera duas entradas (regra única) — quando o **MyFoods Compras** existir, "compra recebida" chama `stock_apply_movement` com a nota/linha recebida e não duplica. **Caixa & Financeiro** poderá usar o mesmo caminho para baixa por venda e custo. **MyFoods Executive** lê uma visão pronta `stock_position` (saldo e valor por unidade/produto) só leitura.
- **Acesso:** app Estoque contratado + papéis de estoque (dono, admin, gerente, estoquista) + unidade. Documentos continua lendo o catálogo e baixando EPIs pela função (mesma regra de hoje para quem tem o app Documentos).
- Categorias: continuam texto no produto, mas a tela oferece a lista das já usadas (sem tabela nova). Unidades de medida: lista fixa (un, kg, g, L, ml, cx, pct, dz, fardo).

### E2 — App `/estoque` (telas, no padrão simplificado do Ponto)
Cabeçalho próprio, unidade ativa, sem itens de outros apps. **5 abas:**
| Aba | Conteúdo |
|---|---|
| **Visão geral** | Produtos cadastrados, com estoque baixo, alertas; últimas movimentações, entradas recentes, saídas recentes |
| **Produtos** | Lista com saldo da unidade, mínimo e situação; cadastrar/editar (nome, categoria, unidade de medida, mínimo, custo); botões rápidos **Entrada / Saída / Ajuste** na própria linha |
| **Movimentações** | Histórico com filtros (período, produto, tipo) e planilha; nova movimentação (incl. perda e transferência) |
| **Inventário** | Contagem guiada: lista dos produtos da unidade, digita o contado, revisa diferenças, fecha |
| **Relatórios** | Posição de estoque valorizada, consumo por período, produtos parados; planilha |
| ⚙ | Fornecedores (simples: nome, contato) e preferências |

- `/app/inventory` redireciona para `/estoque`. `/app/items` continua em `/app` para Documentos (EPIs/uniformes); no Estoque, os produtos aparecem com filtro por tipo.
- Central de aplicativos abre `/estoque`.

### E3 — Verificação
Testes unitários (cálculos, relatórios), kit SQL em Postgres descartável (isolamento entre empresas, unidade, papéis, app não contratado, histórico imutável, movimento atômico e sem duplicar origem), navegação por papel; depois publicar com autorização.

### Ordem sugerida
E1 (banco + testes) → aplicar em produção (com OK) → E2 (telas) → publicar (com OK).

### Fora do escopo agora
Ficha técnica / baixa automática por venda, compras e pedidos a fornecedor (ficam para os apps Compras e Caixa), lotes/validade avançados (os campos existem e serão exibidos, sem regras novas).

## 3. Como ficou (2026-10-25)
- Migrations aplicadas: `20261025013105_estoque_core.sql` e `20261025013206_estoque_trigger_grants.sql`.
- Função `stock_apply_movement` (atômica, com origem/idempotência), `stock_open_count` / `stock_close_count`, visão `stock_position`; histórico, alertas e contagens só mudam pelas funções; saldo só muda por movimentação (cadastro com quantidade registra "saldo inicial").
- Código: `src/lib/stock.shared.ts` (chamada única); `applyStockMovement` e a entrega/cancelamento de EPIs passaram a usá-la (se uma baixa de EPI falhar no meio, o que já baixou é devolvido e a entrega é cancelada).
- App `/estoque`: Visão geral · Produtos (com Entrada/Saída/Ajustar na linha; ajuste pelo "saldo correto") · Movimentações · Inventário · Relatórios · ⚙ Fornecedores. Mapa de arquivos em `src/apps/estoque/README.md`. `/app/inventory` redireciona para `/estoque`; `/app/items` continua para Documentos.
- Testes: `scripts/security-tests/estoque/run.sh` (20 testes no banco) e testes unitários de cálculo, números e chamada da função.
- Conferido em produção (transação desfeita): o dono da Ramos Food lê o saldo e movimenta pela função; nada ficou gravado.
