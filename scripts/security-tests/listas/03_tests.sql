-- Testes do Compras como listas. Usa t.* e os usuários do kit do Caixa & Financeiro
-- (A: dono; operador de caixa e staff só na loja Centro; financeiro nas duas lojas).
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  fiA constant uuid := 'a0000000-0000-0000-0000-0000000000a3';
  stA constant uuid := 'a0000000-0000-0000-0000-0000000000a4';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  uA1 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  l1 text; l2 text; it text; r text; r2 text; r3 text;
BEGIN
  -- ===== Funcionário cria e usa a lista da própria loja =====
  PERFORM t.as_user(stA);
  l1 := t.val(format($q$insert into public.shopping_lists(unit_id, title, company_id) values (%L, 'Compras de segunda', 'bbbbbbbb-0000-0000-0000-00000000000b') returning id$q$, uA1));
  it := t.val(format($q$insert into public.shopping_list_items(list_id, name, quantity) values (%L, 'Leite', '6 L') returning id$q$, l1));
  PERFORM t.val(format($q$insert into public.shopping_list_items(list_id, name, quantity) values (%L, 'Farinha', '2 sacos') returning id$q$, l1));
  PERFORM t.as_super();
  r := t.val(format($q$select company_id::text from public.shopping_lists where id=%L$q$, l1));
  PERFORM t.record('L01 Funcionário (staff) cria lista e itens; a empresa vem da loja, não do navegador', it NOT LIKE 'err:%' AND r = 'aaaaaaaa-0000-0000-0000-00000000000a', l1 || ' | ' || r);

  PERFORM t.as_user(caA);
  r := t.run(format($q$update public.shopping_list_items set checked = true where id=%L$q$, it));
  r2 := t.run(format($q$update public.shopping_lists set status = 'enviada' where id=%L$q$, l1));
  PERFORM t.as_super();
  r3 := t.val(format($q$select (sent_at is not null)::text from public.shopping_lists where id=%L$q$, l1));
  PERFORM t.record('L02 Operador de caixa marca item comprado e envia a lista (data de envio registrada)', r = 'ok:1' AND r2 = 'ok:1' AND r3 = 'true', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Loja: cada uma com as suas =====
  PERFORM t.as_user(oA);
  l2 := t.val(format($q$insert into public.shopping_lists(unit_id, title) values (%L, 'Lista do Bairro') returning id$q$, uA2));
  PERFORM t.as_user(caA);
  r := t.val('select count(*) from public.shopping_lists');
  r2 := t.attempt(format($q$insert into public.shopping_lists(unit_id) values (%L)$q$, uA2));
  PERFORM t.as_user(fiA);
  r3 := t.val('select count(*) from public.shopping_lists');
  PERFORM t.record('L03 Cada loja vê as suas: operador da Centro não vê nem cria no Bairro; quem tem as duas vê as duas', r = '1' AND r2 LIKE 'err:%' AND r3 = '2', r || ' | ' || r2 || ' | ' || r3);

  -- ===== Apagar lista e definir comprador: só gestão =====
  PERFORM t.as_user(stA);
  r := t.run(format('delete from public.shopping_lists where id=%L', l1));
  r2 := t.attempt(format($q$insert into public.shopping_buyers(unit_id, name, phone) values (%L, 'João', '12999990000')$q$, uA1));
  PERFORM t.as_user(oA);
  r3 := t.run(format($q$insert into public.shopping_buyers(unit_id, name, phone) values (%L, 'João', '12999990000')$q$, uA1));
  PERFORM t.as_user(stA);
  PERFORM t.record('L04 Staff não apaga lista nem define comprador; dono define; staff vê o comprador',
    r = 'ok:0' AND r2 LIKE 'err:%' AND r3 = 'ok:1' AND t.val('select name from public.shopping_buyers') = 'João', r || ' | ' || r2 || ' | ' || r3);
  PERFORM t.as_user(oA);
  r := t.run(format('delete from public.shopping_lists where id=%L', l2));
  PERFORM t.record('L05 Dono apaga lista', r = 'ok:1', r);

  -- ===== Outras empresas =====
  PERFORM t.as_user(oB);
  r := t.val('select count(*) from public.shopping_lists');
  r2 := t.attempt(format($q$insert into public.shopping_lists(unit_id) values (%L)$q$, uA1));
  r3 := t.attempt(format($q$insert into public.shopping_list_items(list_id, name) values (%L, 'X')$q$, l1));
  PERFORM t.record('L06 Outra empresa não vê, não cria lista na loja de A nem adiciona itens', r = '0' AND r2 LIKE 'err:%' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);

  PERFORM t.as_user(oC);
  r := t.attempt($q$insert into public.shopping_lists(unit_id) values ('cccccccc-1000-0000-0000-0000000000c1')$q$);
  PERFORM t.record('L07 Empresa sem o app Compras não cria listas', r LIKE 'err:%', r);

  PERFORM t.as_anon();
  r := t.attempt('select count(*) from public.shopping_lists');
  PERFORM t.record('L08 Visitante sem login não acessa', r LIKE 'err:%', r);
  PERFORM t.as_super();
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
