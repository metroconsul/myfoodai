-- Testes do Cardápio Digital. Usa t.* e os usuários do kit do Caixa & Financeiro
-- (A: dono; operador de caixa e staff só na loja Centro; financeiro nas duas lojas).
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  fiA constant uuid := 'a0000000-0000-0000-0000-0000000000a3';
  stA constant uuid := 'a0000000-0000-0000-0000-0000000000a4';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  uA1 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  capp text; pao text; esgot text; inativo text; outro text; r text; r2 text; r3 text; tok text; tok2 text; ret text;
  order_sql constant text := $q$select public.dm_place_order('cafe-centro', %L, %L, %L, %L, NULL, %L::jsonb, %L)$q$;
BEGIN
  -- ===== Gestão monta a loja e o cardápio =====
  PERFORM t.as_user(oA);
  r := t.run(format($q$insert into public.dm_stores(unit_id, slug, display_name, is_open, company_id) values (%L, 'cafe-centro', 'Café Centro', true, 'bbbbbbbb-0000-0000-0000-00000000000b')$q$, uA1));
  capp := t.val(format($q$insert into public.dm_items(unit_id, name, category, price) values (%L, 'Cappuccino', 'Bebidas', 9) returning id$q$, uA1));
  pao := t.val(format($q$insert into public.dm_items(unit_id, name, category, price) values (%L, 'Pão de queijo', 'Salgados', 5.5) returning id$q$, uA1));
  esgot := t.val(format($q$insert into public.dm_items(unit_id, name, price, available) values (%L, 'Torta', 12, false) returning id$q$, uA1));
  inativo := t.val(format($q$insert into public.dm_items(unit_id, name, price, active) values (%L, 'Antigo', 1, false) returning id$q$, uA1));
  outro := t.val(format($q$insert into public.dm_items(unit_id, name, price) values (%L, 'Item do Bairro', 3) returning id$q$, uA2));
  PERFORM t.as_super();
  r2 := t.val(format($q$select company_id::text from public.dm_stores where unit_id=%L$q$, uA1));
  PERFORM t.record('D01 Dono cria a loja (empresa vem da loja) e o cardápio', r = 'ok:1' AND capp NOT LIKE 'err:%' AND r2 = 'aaaaaaaa-0000-0000-0000-00000000000a', r || ' | ' || r2);

  PERFORM t.as_user(stA);
  r := t.attempt(format($q$insert into public.dm_items(unit_id, name, price) values (%L, 'X', 1)$q$, uA1));
  r2 := t.attempt(format($q$update public.dm_items set price = 0.01 where id=%L$q$, capp));
  r3 := t.attempt(format($q$update public.dm_items set available = false where id=%L$q$, pao));
  PERFORM t.record('D02 Equipe não cria item nem muda preço, mas marca esgotado', r LIKE 'err:%' AND r2 LIKE 'err:%' AND r3 = 'ok:1', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Página pública (sem login) =====
  PERFORM t.as_anon();
  r := t.val($q$select jsonb_array_length(public.dm_public_menu('Cafe-Centro')->'items')::text$q$);
  r2 := t.val($q$select (public.dm_public_menu('nao-existe') is null)::text || '/' || (public.dm_public_menu('padaria-c') is null)::text$q$);
  r3 := t.attempt('select count(*) from public.dm_items');
  PERFORM t.record('D03 Visitante vê o cardápio publicado (sem itens fora do cardápio); loja inexistente ou sem o app não aparece; tabelas fechadas',
    r = '3' AND r2 = 'true/true' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  tok := t.val(format(order_sql, 'mesa', '5', 'Ana', NULL,
    jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 2, 'price', 0.01), jsonb_build_object('item_id', esgot, 'quantity', 0))::text, 'cliente-chave-1'));
  r := tok;
  tok := t.val(format(order_sql, 'mesa', '5', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 2, 'price', 0.01))::text, 'cliente-chave-1'));
  PERFORM t.as_super();
  r2 := t.val($q$select concat_ws('/', number, total, status, (tab_id is not null), length(tracking_token)) from public.dm_orders where client_key='cliente-chave-1'$q$);
  PERFORM t.record('D04 Pedido na mesa: preço vem do banco (ignora o do celular), entra na conta da mesa; item inválido recusa o pedido inteiro',
    r LIKE 'err:%' AND r2 = '1/18.00/novo/t/64', r || ' | ' || r2);

  PERFORM t.as_anon();
  tok2 := t.val(format(order_sql, 'mesa', '5', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 2))::text, 'cliente-chave-1'));
  PERFORM t.val(format(order_sql, 'mesa', 'MESA 5'::text, 'Bia', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'cliente-chave-2'));
  PERFORM t.as_super();
  r := t.val($q$select concat_ws('/', (select count(*) from public.dm_orders), (select count(*) from public.dm_tabs where status='aberta'))$q$);
  r2 := t.val($q$select count(distinct tab_id) from public.dm_orders where lower(table_label) = '5'$q$);
  PERFORM t.record('D05 Reenvio do mesmo pedido não duplica; outro pedido da mesa 5 vai para a mesma conta', tok2 = tok AND r2 = '1', (tok2 = tok)::text || ' | ' || r || ' | ' || r2);

  -- ===== Pedidos inválidos =====
  PERFORM t.as_anon();
  r := concat_ws(' | ',
    t.val(format(order_sql, 'mesa', NULL, 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-sem-mesa')),
    t.val(format(order_sql, 'retirada', NULL, 'Ana', '123', jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-sem-tel')),
    t.val(format(order_sql, 'mesa', '2', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', inativo, 'quantity', 1))::text, 'chave-inativo')),
    t.val(format(order_sql, 'mesa', '2', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', outro, 'quantity', 1))::text, 'chave-outra-loja')),
    t.val(format(order_sql, 'mesa', '2', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 51))::text, 'chave-qtd')),
    t.val(format(order_sql, 'mesa', '2', '', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-nome')),
    t.val(format(order_sql, 'mesa', '2', 'Ana', NULL, '[]', 'chave-vazio')));
  PERFORM t.record('D06 Recusa: mesa vazia, telefone inválido, item fora do cardápio, item de outra loja, quantidade alta, sem nome, sem itens',
    r = 'err:Informe a mesa. | err:Informe um telefone com DDD. | err:Um item não está mais no cardápio. | err:Um item não está mais no cardápio. | err:Quantidade inválida. | err:Informe seu nome. | err:Escolha de 1 a 30 itens.', r);

  PERFORM t.as_user(oA);
  PERFORM t.run(format('update public.dm_stores set is_open = false where unit_id=%L', uA1));
  PERFORM t.as_anon();
  r := t.val(format(order_sql, 'mesa', '9', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-fechada'));
  PERFORM t.as_user(oA);
  PERFORM t.run(format('update public.dm_stores set is_open = true where unit_id=%L', uA1));
  PERFORM t.record('D07 Loja fechada não recebe pedido', r LIKE 'err:A loja está fechada%', r);

  -- Limite: 5 pedidos da mesma mesa em 2 minutos.
  PERFORM t.as_anon();
  FOR i IN 1..4 LOOP
    PERFORM t.val(format(order_sql, 'mesa', '5', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-limite-' || i));
  END LOOP;
  r := t.val(format(order_sql, 'mesa', '5', 'Ana', NULL, jsonb_build_array(jsonb_build_object('item_id', capp, 'quantity', 1))::text, 'chave-limite-9'));
  PERFORM t.record('D08 Limite de pedidos seguidos da mesma mesa', r LIKE 'err:Muitos pedidos seguidos%', r);

  -- ===== Acompanhar o pedido =====
  PERFORM t.as_super();
  tok := t.val($q$select tracking_token from public.dm_orders where client_key='cliente-chave-1'$q$);
  PERFORM t.as_anon();
  r := t.val(format($q$select concat_ws('/', d->>'number', d->>'status', jsonb_array_length(d->'items'), (d ? 'customer_phone')) from public.dm_order_status(%L) d$q$, tok));
  r2 := t.val($q$select (public.dm_order_status(repeat('a', 64)) is null)::text$q$);
  r3 := t.attempt('select count(*) from public.dm_orders');
  PERFORM t.record('D09 Cliente acompanha só pelo código secreto; sem dados pessoais; não lê a tabela de pedidos', r = '1/novo/1/f' AND r2 = 'true' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Equipe: andamento dos pedidos e conta =====
  PERFORM t.as_user(caA);
  r := t.run($q$update public.dm_orders set status='aceito' where client_key='cliente-chave-1'$q$);
  r2 := t.run($q$update public.dm_orders set status='pronto' where client_key='cliente-chave-1'$q$);
  r3 := t.attempt($q$update public.dm_orders set status='novo' where client_key='cliente-chave-1'$q$);
  PERFORM t.record('D10 Operador anda com o pedido para frente; não volta de etapa', r = 'ok:1' AND r2 = 'ok:1' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);
  r := t.attempt($q$update public.dm_orders set total = 0 where client_key='cliente-chave-1'$q$);
  PERFORM t.record('D11 Equipe não altera valor do pedido', r LIKE 'err:%', r);

  PERFORM t.as_anon();
  ret := t.val(format(order_sql, 'retirada', NULL, 'Caio', '(12) 98175-9663', jsonb_build_array(jsonb_build_object('item_id', pao, 'quantity', 3))::text, 'chave-retirada'));
  PERFORM t.as_user(caA);
  r := t.val($q$select concat_ws('/', customer_phone, total) from public.dm_orders where client_key='chave-retirada'$q$);
  PERFORM t.run($q$update public.dm_orders set status='entregue' where client_key='chave-retirada'$q$);
  r2 := t.val($q$select (paid_at is not null)::text from public.dm_orders where client_key='chave-retirada'$q$);
  r3 := t.attempt($q$update public.dm_orders set status='cancelado' where client_key='chave-retirada'$q$);
  PERFORM t.record('D12 Retirada: telefone só com números, pago ao entregar; finalizado não muda', ret NOT LIKE 'err:%' AND r = '12981759663/16.50' AND r2 = 'true' AND r3 LIKE 'err:%', ret || ' | ' || r || ' | ' || r2 || ' | ' || r3);

  r := t.val($q$select public.dm_close_tab(tab_id) from public.dm_orders where client_key='cliente-chave-1'$q$);
  r2 := t.val($q$select concat_ws('/', count(*) filter (where paid_at is not null), count(*), min(status), max(status)) from public.dm_orders where lower(table_label)='5'$q$);
  r3 := t.val($q$select public.dm_close_tab(tab_id) from public.dm_orders where client_key='cliente-chave-1'$q$);
  PERFORM t.record('D13 Fechar a conta da mesa marca todos os pedidos dela como pagos e entregues; não fecha duas vezes',
    r NOT LIKE 'err:%' AND r2 = '5/5/entregue/entregue' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Isolamento =====
  PERFORM t.as_user(caA);
  r := t.val($q$select count(*) from public.dm_items where name = 'Item do Bairro'$q$);
  PERFORM t.as_user(oB);
  r2 := t.val('select count(*) from public.dm_orders');
  r3 := t.attempt(format($q$insert into public.dm_items(unit_id, name, price) values (%L, 'Invasor', 1)$q$, uA1));
  PERFORM t.record('D14 Operador não vê a outra loja; outra empresa não vê pedidos nem mexe no cardápio de A', r = '0' AND r2 = '0' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Fotos =====
  PERFORM t.as_user(oA);
  r := t.attempt($q$insert into storage.objects(bucket_id, name) values ('menu-photos', 'aaaaaaaa-0000-0000-0000-00000000000a/aaaaaaaa-1000-0000-0000-0000000000a1/foto.jpg')$q$);
  r2 := t.attempt($q$insert into storage.objects(bucket_id, name) values ('menu-photos', 'bbbbbbbb-0000-0000-0000-00000000000b/x/foto.jpg')$q$);
  PERFORM t.as_user(stA);
  r3 := t.attempt($q$insert into storage.objects(bucket_id, name) values ('menu-photos', 'aaaaaaaa-0000-0000-0000-00000000000a/aaaaaaaa-1000-0000-0000-0000000000a1/foto2.jpg')$q$);
  PERFORM t.record('D15 Foto: gestão envia só na pasta da própria empresa; equipe não envia', r = 'ok:1' AND r2 LIKE 'err:%' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);
  PERFORM t.as_super();
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
