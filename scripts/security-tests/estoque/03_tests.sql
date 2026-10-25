-- Testes do MyFoods Estoque (E1). Usa t.* do kit do Caixa & Financeiro.
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  stA constant uuid := 'a0000000-0000-0000-0000-0000000000a4';
  esA constant uuid := 'a0000000-0000-0000-0000-0000000000a7';
  hrA constant uuid := 'a0000000-0000-0000-0000-0000000000a8';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  cA  constant text := 'aaaaaaaa-0000-0000-0000-00000000000a';
  uA1 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  prod constant text := 'ca000000-0000-0000-0000-0000000000a1';
  item constant text := '11000000-0000-0000-0000-0000000000a1';
  itemC constant text := '11000000-0000-0000-0000-0000000000c1';
  r text; r2 text; r3 text; cnt text;
BEGIN
  -- ===== Cadastro e saldo inicial =====
  PERFORM t.as_user(oA);
  r := t.run(format($q$insert into public.catalog_items(id,company_id,name,item_type,unit_of_measure,minimum_stock) values (%L,%L,'Leite','ingrediente','L',0)$q$, prod, cA));
  r2 := t.run(format($q$insert into public.inventory_items(id,company_id,unit_id,catalog_item_id,name,item_type,unit_of_measure,quantity,unit_cost)
                        values (%L,%L,%L,%L,'Leite','ingrediente','L',10,4.5)$q$, item, cA, uA1, prod));
  PERFORM t.as_super();
  r3 := t.val(format($q$select concat_ws('/', (select quantity from public.inventory_items where id=%1$L)::int,
                         (select count(*) from public.stock_movements where inventory_item_id=%1$L and reason='Saldo inicial no cadastro'))$q$, item));
  PERFORM t.record('E01 Dono cadastra produto com saldo inicial e o histórico registra', r LIKE 'ok:%' AND r2 LIKE 'ok:%' AND r3 = '10/1', r || ' | ' || r2 || ' | ' || r3);

  PERFORM t.as_user(oA);
  r := t.run(format($q$insert into public.inventory_items(company_id,unit_id,catalog_item_id,name,item_type,unit_of_measure) values (%L,%L,%L,'Leite','ingrediente','L')$q$, cA, uA1, prod));
  PERFORM t.record('E02 O mesmo produto não tem dois saldos na mesma unidade', r LIKE 'err:%', r);

  -- ===== Movimentação atômica =====
  r := t.val(format($q$select (public.stock_apply_movement(%L,'entrada',5,5.0,'Compra'))->>'after'$q$, item));
  r2 := t.val(format($q$select (public.stock_apply_movement(%L,'saida',20))->>'after'$q$, item));
  PERFORM t.as_super();
  r3 := t.val(format('select quantity::int::text from public.inventory_items where id=%L', item));
  PERFORM t.record('E03 Entrada soma; saída maior que o saldo é recusada e nada muda', r = '15.000' AND r2 LIKE 'err:Saldo insuficiente%' AND r3 = '15', r || ' | ' || r2 || ' | ' || r3);

  PERFORM t.as_user(oA);
  r := t.attempt(format('update public.inventory_items set quantity = 999 where id=%L', item));
  r2 := t.attempt(format('update public.inventory_items set minimum_stock = 3 where id=%L', item));
  PERFORM t.record('E04 Saldo não muda por edição direta (só por movimentação); mínimo pode ser editado', r LIKE 'err:%' AND r2 = 'ok:1', r || ' | ' || r2);

  r := t.attempt('update public.stock_movements set quantity = 1');
  r2 := t.attempt('delete from public.stock_movements');
  r3 := t.attempt(format($q$insert into public.stock_movements(company_id,unit_id,inventory_item_id,movement_type,quantity) values (%L,%L,%L,'entrada',100)$q$, cA, uA1, item));
  PERFORM t.record('E05 Histórico não pode ser alterado, apagado nem inventado', r LIKE 'err:%' AND r2 LIKE 'err:%' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Integração: mesma origem não duplica (ex.: compra recebida) =====
  r := t.val(format($q$select (public.stock_apply_movement(%L,'entrada',3,NULL,'NF 1',NULL,NULL,NULL,'compras','nf-1:linha-1'))->>'duplicate'$q$, item));
  r2 := t.val(format($q$select (public.stock_apply_movement(%L,'entrada',3,NULL,'NF 1',NULL,NULL,NULL,'compras','nf-1:linha-1'))->>'duplicate'$q$, item));
  PERFORM t.as_super();
  r3 := t.val(format('select quantity::int::text from public.inventory_items where id=%L', item));
  PERFORM t.record('E06 Compra recebida reenviada não entra duas vezes', r = 'false' AND r2 = 'true' AND r3 = '18', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Alertas: um aberto por produto, resolvido sozinho =====
  PERFORM t.as_user(oA);
  PERFORM t.run(format('update public.inventory_items set minimum_stock = 15 where id=%L', item));
  PERFORM t.val(format($q$select public.stock_apply_movement(%L,'saida',4)$q$, item));
  PERFORM t.val(format($q$select public.stock_apply_movement(%L,'perda',1)$q$, item));
  r := t.val(format('select count(*) from public.stock_alerts where inventory_item_id=%L and resolved_at is null', item));
  PERFORM t.val(format($q$select public.stock_apply_movement(%L,'entrada',10)$q$, item));
  r2 := t.val(format('select count(*) from public.stock_alerts where inventory_item_id=%L and resolved_at is null', item));
  PERFORM t.record('E07 Abaixo do mínimo gera um só alerta, que some ao repor', r = '1' AND r2 = '0', r || ' -> ' || r2);

  -- ===== Transferência pelo produto (cria o saldo no destino) =====
  r := t.val(format($q$select (public.stock_apply_movement(%L,'transferencia',4,NULL,'Para o Bairro',NULL,NULL,%L))->>'after'$q$, item, uA2));
  r2 := t.val(format($q$select quantity::int::text from public.inventory_items where unit_id=%L and catalog_item_id=%L$q$, uA2, prod));
  PERFORM t.record('E08 Transferência tira de uma unidade e entra na outra pelo produto', r = '19.000' AND r2 = '4', r || ' | ' || r2);

  -- ===== Inventário =====
  cnt := t.val(format($q$select public.stock_open_count(%L,'Contagem teste')$q$, uA1));
  r := t.val(format($q$select public.stock_open_count(%L)$q$, uA1));
  PERFORM t.run(format($q$update public.inventory_count_items set counted_quantity = 17 where count_id=%L$q$, cnt));
  r2 := t.val(format('select public.stock_close_count(%L)', cnt));
  r3 := t.val(format('select quantity::int::text from public.inventory_items where id=%L', item));
  PERFORM t.record('E09 Inventário: um aberto por vez; ao fechar o saldo vira o contado', r LIKE 'err:%' AND r2 = '1' AND r3 = '17', r || ' | ' || r2 || ' | ' || r3);
  r := t.attempt(format($q$update public.inventory_count_items set counted_quantity = 1 where count_id=%L$q$, cnt));
  PERFORM t.record('E10 Inventário fechado não pode ser editado', r = 'ok:0', r);

  r := t.val(format($q$select concat_ws('/', quantity::int, stock_value) from public.stock_position where inventory_item_id=%L$q$, item));
  PERFORM t.record('E11 Visão de posição (relatórios/Executive) traz saldo e valor', r = '17/85.00', r);

  -- ===== Acesso por papel e unidade =====
  PERFORM t.as_user(esA);
  r := t.val('select count(*) from public.inventory_items');
  r2 := t.val(format($q$select (public.stock_apply_movement(%L,'saida',1))->>'after'$q$, item));
  r3 := t.val(format($q$select public.stock_apply_movement(id,'saida',1) from public.inventory_items where unit_id=%L$q$, uA2));
  PERFORM t.record('E12 Estoquista da unidade Centro só vê e movimenta a própria unidade', r = '1' AND r2 = '16.000' AND (r3 = 'null' OR r3 LIKE 'err:%'), r || ' | ' || r2 || ' | ' || r3);
  r := t.val(format($q$select public.stock_apply_movement(%L,'transferencia',1,NULL,NULL,NULL,NULL,%L)$q$, item, uA2));
  PERFORM t.record('E13 Estoquista não transfere para unidade a que não tem acesso', r LIKE 'err:%', r);

  PERFORM t.as_user(hrA);
  r := t.val('select count(*) from public.inventory_items');
  r2 := t.val(format($q$select (public.stock_apply_movement(%L,'saida',1,NULL,'Entrega EPI',NULL,NULL,NULL,'documentos','entrega-1:0'))->>'after'$q$, item));
  r3 := t.val(format($q$select public.stock_apply_movement(%L,'saida',1)$q$, item));
  PERFORM t.record('E14 RH (Documentos) lê o saldo e baixa entrega de EPI, mas não faz movimentação comum', r = '2' AND r2 = '15.000' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  PERFORM t.as_user(caA);
  r := concat_ws('/', t.val('select count(*) from public.inventory_items'), t.val('select count(*) from public.stock_movements'), t.val('select count(*) from public.suppliers'));
  r2 := t.val(format($q$select public.stock_apply_movement(%L,'saida',1)$q$, item));
  PERFORM t.record('E15 Operador de caixa não vê estoque, histórico nem fornecedores e não movimenta', r = '0/0/0' AND r2 LIKE 'err:%', r || ' | ' || r2);
  PERFORM t.as_user(stA);
  r := t.val('select count(*) from public.stock_movements');
  PERFORM t.record('E16 Staff não vê o histórico', r = '0', r);

  PERFORM t.as_user(oC);
  r := t.val('select count(*) from public.inventory_items');
  r2 := t.val(format($q$select public.stock_apply_movement(%L,'saida',1)$q$, itemC));
  PERFORM t.record('E17 Empresa sem o app Estoque não vê nem movimenta o próprio estoque', r = '0' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_user(oB);
  r := t.val('select count(*) from public.inventory_items');
  r2 := t.val(format($q$select public.stock_apply_movement(%L,'entrada',1)$q$, item));
  PERFORM t.record('E18 Outra empresa não vê nem movimenta o estoque de A', r = '0' AND r2 LIKE 'err:%', r || ' | ' || r2);

  -- ===== Servidor (integrações futuras) =====
  PERFORM t.as_super();
  EXECUTE 'SET LOCAL ROLE service_role';
  r := (public.stock_apply_movement(item::uuid, 'entrada', 2, NULL, 'Teste servidor', NULL, NULL, NULL, 'compras', 'nf-2:linha-1'))->>'after';
  EXECUTE 'RESET ROLE';
  PERFORM t.record('E19 Servidor (integração) movimenta pela mesma função', r = '17.000', r);

  r := t.val(format($q$select string_agg(movement_type::text||':'||coalesce(quantity_before::int,0)||'>'||coalesce(quantity_after::int,0), ',' order by occurred_at, created_at)
                      from public.stock_movements where inventory_item_id=%L$q$, item));
  r2 := t.val(format($q$select count(*) from public.stock_movements where inventory_item_id=%L and quantity_after <> quantity_before + case
                      when movement_type in ('entrada') then quantity when movement_type in ('saida','perda','transferencia') then -quantity
                      when movement_type = 'ajuste' then quantity else quantity - quantity_before end$q$, item));
  PERFORM t.record('E20 Histórico fecha com o saldo (cada movimento: antes ± quantidade = depois)', r2 = '0', r);
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
