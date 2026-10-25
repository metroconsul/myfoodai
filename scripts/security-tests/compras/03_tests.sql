-- Testes do MyFoods Compras (C1). Usa t.* do kit do Caixa & Financeiro.
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  esA constant uuid := 'a0000000-0000-0000-0000-0000000000a7';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  cA  constant text := 'aaaaaaaa-0000-0000-0000-00000000000a';
  cB  constant text := 'bbbbbbbb-0000-0000-0000-00000000000b';
  uA1 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  uB1 constant text := 'bbbbbbbb-1000-0000-0000-0000000000b1';
  supA constant text := '5a000000-0000-0000-0000-0000000000a1';
  leite constant text := 'ca000000-0000-0000-0000-0000000000a1';
  cafe constant text := 'ca000000-0000-0000-0000-0000000000a2';
  invLeite constant text := '11000000-0000-0000-0000-0000000000a1';
  ord text; ord2 text; itL text; itC text; rec text; rec2 text; rec3 text; r text; r2 text; r3 text;
BEGIN
  -- ===== Pedido =====
  PERFORM t.as_user(oA);
  ord := t.val(format($q$insert into public.purchase_orders(company_id,unit_id,supplier_id) values (%L,%L,%L) returning id$q$, cA, uA1, supA));
  itL := t.val(format($q$insert into public.purchase_order_items(order_id,catalog_item_id,quantity,unit_price) values (%L,%L,20,5.5) returning id$q$, ord, leite));
  itC := t.val(format($q$insert into public.purchase_order_items(order_id,catalog_item_id,quantity,unit_price) values (%L,%L,4,40) returning id$q$, ord, cafe));
  ord2 := t.val(format($q$insert into public.purchase_orders(company_id,unit_id,supplier_id) values (%L,%L,%L) returning id$q$, cA, uA1, supA));
  r := t.val(format($q$select string_agg(number::text, ',' order by number) from public.purchase_orders where id in (%L,%L)$q$, ord, ord2));
  PERFORM t.record('C01 Dono cria pedido com itens; número sequencial por empresa', itL NOT LIKE 'err:%' AND itC NOT LIKE 'err:%' AND r = '1,2', r);

  r := t.attempt(format($q$insert into public.purchase_order_items(order_id,catalog_item_id,quantity) values (%L,'ca000000-0000-0000-0000-0000000000b1',1)$q$, ord2));
  PERFORM t.record('C02 Pedido não aceita produto de outra empresa', r LIKE 'err:%', r);

  r := t.attempt(format($q$update public.purchase_orders set status='recebido' where id=%L$q$, ord2));
  r2 := t.run(format($q$update public.purchase_orders set status='cancelado' where id=%L$q$, ord2));
  r3 := t.attempt(format($q$update public.purchase_orders set status='aberto' where id=%L$q$, ord2));
  PERFORM t.record('C03 Tela não marca recebido; cancelado não volta', r LIKE 'err:%' AND r2 = 'ok:1' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);
  r := t.attempt(format('delete from public.purchase_orders where id=%L', ord2));
  PERFORM t.record('C04 Pedido não pode ser apagado', r LIKE 'err:%', r);

  -- ===== Receber do pedido (parcial), reenvio e restante =====
  rec := t.val(format($q$select public.purchase_receive(%L,NULL,%L,
           jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',20,'unit_cost',5.8,'order_item_id',%L),
                             jsonb_build_object('catalog_item_id',%L,'quantity',2,'unit_cost',41,'order_item_id',%L)),
           'NF 100', '2026-10-25', '2026-11-25', NULL, 'tela-1')$q$, uA1, ord, leite, itL, cafe, itC));
  PERFORM t.as_super();
  r := t.val(format($q$select concat_ws('/', (select quantity::int from public.inventory_items where id=%L),
          (select quantity::int from public.inventory_items where unit_id=%L and catalog_item_id=%L),
          (select status from public.purchase_orders where id=%L),
          (select total_amount from public.purchase_receipts where id=%L),
          (select supplier_id::text = %L from public.purchase_receipts where id=%L))$q$, invLeite, uA1, cafe, ord, rec, supA, rec));
  PERFORM t.record('C05 Receber parte do pedido: estoque entra (cria saldo do café), pedido parcial, total e fornecedor do pedido', r = '24/2/recebido_parcial/198.00/t', r);

  PERFORM t.as_user(oA);
  rec2 := t.val(format($q$select public.purchase_receive(%L,NULL,%L,
           jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',20,'unit_cost',5.8,'order_item_id',%L)), 'NF 100', NULL, NULL, NULL, 'tela-1')$q$, uA1, ord, leite, itL));
  r := t.val(format('select quantity::int::text from public.inventory_items where id=%L', invLeite));
  PERFORM t.record('C06 Clique repetido em confirmar não registra a compra duas vezes', rec2 = rec AND r = '24', rec2 || ' | ' || r);

  rec3 := t.val(format($q$select public.purchase_receive(%L,NULL,%L,
           jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',2,'unit_cost',41,'order_item_id',%L)), 'NF 101')$q$, uA1, ord, cafe, itC));
  r := t.val(format('select status from public.purchase_orders where id=%L', ord));
  r3 := t.val(format($q$select public.purchase_receive(%L,NULL,%L,jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',1)))$q$, uA1, ord, cafe));
  PERFORM t.record('C07 Recebendo o restante o pedido fica recebido; pedido recebido não aceita mais', r = 'recebido' AND r3 LIKE 'err:%', r || ' | ' || r3);

  r := t.val(format('select unit_cost::text from public.catalog_items where id=%L', leite));
  r2 := t.val(format($q$select count(*) from public.stock_movements where source_app='compras' and supplier_id=%L$q$, supA));
  PERFORM t.record('C08 Custo do produto atualizado e entradas com origem Compras e fornecedor', r = '5.80' AND r2 = '3', r || ' | ' || r2);

  -- ===== Recebimentos não podem ser mexidos direto =====
  r := t.attempt(format($q$update public.purchase_receipts set total_amount = 1 where id=%L$q$, rec));
  r2 := t.attempt(format($q$delete from public.purchase_receipts where id=%L$q$, rec));
  r3 := t.attempt(format($q$update public.purchase_order_items set received_quantity = 999 where id=%L$q$, itL));
  PERFORM t.record('C09 Recebimento e quantidade recebida não mudam por edição direta', r LIKE 'err:%' AND r2 LIKE 'err:%' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Cancelar recebimento =====
  r := t.val(format($q$select public.purchase_cancel_receipt(%L,'Nota errada')$q$, rec3));
  r := t.val(format($q$select concat_ws('/', (select quantity::int from public.inventory_items where unit_id=%L and catalog_item_id=%L),
         (select status from public.purchase_orders where id=%L), (select status from public.purchase_receipts where id=%L))$q$, uA1, cafe, ord, rec3));
  PERFORM t.record('C10 Cancelar recebimento devolve o estoque e reabre o pedido', r = '2/recebido_parcial/cancelado', r);

  -- Produto já usado: cancelar não deixa o saldo negativo e nada muda.
  PERFORM t.val(format($q$select public.stock_apply_movement(%L,'saida',20)$q$, invLeite));
  r := t.val(format($q$select public.purchase_cancel_receipt(%L)$q$, rec));
  r2 := t.val(format($q$select concat_ws('/', (select quantity::int from public.inventory_items where id=%L), (select status from public.purchase_receipts where id=%L))$q$, invLeite, rec));
  PERFORM t.record('C11 Não cancela compra cujo produto já foi usado (saldo ficaria negativo)', r LIKE 'err:Saldo insuficiente%' AND r2 = '4/confirmado', r || ' | ' || r2);

  -- ===== Avulso em outra unidade =====
  r := t.val(format($q$select public.purchase_receive(%L,%L,NULL,jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',3,'unit_cost',40)))$q$, uA2, supA, cafe));
  r2 := t.val(format($q$select quantity::int::text from public.inventory_items where unit_id=%L and catalog_item_id=%L$q$, uA2, cafe));
  PERFORM t.record('C12 Compra avulsa em outra unidade cria o saldo lá', r NOT LIKE 'err:%' AND r2 = '3', r || ' | ' || r2);

  -- ===== Acesso =====
  PERFORM t.as_user(esA);
  r := t.val(format($q$select public.purchase_receive(%L,%L,NULL,jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',1)))$q$, uA2, supA, cafe));
  r2 := t.val('select count(*) from public.purchase_orders');
  PERFORM t.record('C13 Estoquista da unidade Centro não recebe em outra unidade e vê só os pedidos dela', r LIKE 'err:%' AND r2 = '2', r || ' | ' || r2);

  PERFORM t.as_user(caA);
  r := concat_ws('/', t.val('select count(*) from public.purchase_orders'), t.val('select count(*) from public.purchase_receipts'));
  r2 := t.val(format($q$select public.purchase_receive(%L,%L,NULL,jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',1)))$q$, uA1, supA, cafe));
  PERFORM t.record('C14 Operador de caixa não vê pedidos nem recebimentos e não recebe', r = '0/0' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_user(oB);
  r := t.val(format($q$select public.purchase_receive(%L,'5a000000-0000-0000-0000-0000000000b1',NULL,jsonb_build_array(jsonb_build_object('catalog_item_id','ca000000-0000-0000-0000-0000000000b1','quantity',7,'unit_cost',3)))$q$, uB1));
  r2 := t.val($q$select string_agg(name||':'||quantity::int, ',') from public.inventory_items$q$);
  PERFORM t.record('C15 Empresa só com Compras (sem Estoque) recebe e vê o saldo entrar', r NOT LIKE 'err:%' AND r2 = 'Farinha B:7', r || ' | ' || r2);
  r := t.val('select count(*) from public.purchase_orders');
  r2 := t.val(format($q$select public.purchase_receive(%L,NULL,NULL,jsonb_build_array(jsonb_build_object('catalog_item_id',%L,'quantity',1)))$q$, uA1, leite));
  PERFORM t.record('C16 Outra empresa não vê pedidos de A nem recebe na unidade de A', r = '0' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_user(oC);
  r := t.attempt($q$insert into public.purchase_orders(company_id,unit_id,supplier_id) values ('cccccccc-0000-0000-0000-00000000000c','cccccccc-1000-0000-0000-0000000000c1','5a000000-0000-0000-0000-0000000000c1')$q$);
  r2 := t.val($q$select public.purchase_receive('cccccccc-1000-0000-0000-0000000000c1',NULL,NULL,jsonb_build_array(jsonb_build_object('catalog_item_id','ca000000-0000-0000-0000-0000000000c1','quantity',1)))$q$);
  PERFORM t.record('C17 Empresa sem o app Compras não cria pedido nem recebe', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_anon();
  r := t.attempt('select count(*) from public.purchase_orders');
  PERFORM t.record('C18 Visitante sem login não acessa', r LIKE 'err:%', r);
  PERFORM t.as_super();
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
