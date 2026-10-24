-- Testes da conexão Mercado Pago (migration 20261024185611). Contêiner DESCARTÁVEL, dados fictícios.
-- Usa t.* e o seed do kit do Caixa & Financeiro (empresa A com o app; C sem o app).
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  fiA constant uuid := 'a0000000-0000-0000-0000-0000000000a3';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  cA  constant uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  cB  constant uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  uA1 constant uuid := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  connA uuid;
  r text; r2 text;
BEGIN
  -- Dados como o servidor (service_role/superusuário) gravaria.
  PERFORM t.as_super();
  INSERT INTO public.sales_connections (company_id, unit_id, provider, adapter_type, status, config)
    VALUES (cA, uA1, 'mercado_pago', 'oauth', 'conectado', '{"account":"111"}') RETURNING id INTO connA;
  INSERT INTO public.provider_tokens (connection_id, company_id, provider, provider_user_id, access_token_enc, refresh_token_enc, expires_at)
    VALUES (connA, cA, 'mercado_pago', '111', 'v1:enc-access', 'v1:enc-refresh', now() + interval '180 days');
  INSERT INTO public.provider_oauth_states (state, company_id, unit_id, user_id, provider, code_verifier)
    VALUES ('state-a', cA, uA1, oA, 'mercado_pago', 'verifier-a');

  -- ===== Quem pode conectar =====
  PERFORM t.as_user(oA);
  r := t.val('select public.mp_manage_company()');
  PERFORM t.as_user(fiA);
  r2 := t.val('select public.mp_manage_company()');
  PERFORM t.record('M01 Dono e financeiro podem gerenciar o Mercado Pago', r = cA::text AND r2 = cA::text, r || ' | ' || r2);

  PERFORM t.as_user(caA);
  r := t.val('select public.mp_manage_company()');
  PERFORM t.record('M02 Operador de caixa não gerencia a conexão', r = 'null', r);

  PERFORM t.as_user(oC);
  r := t.val('select public.mp_manage_company()');
  PERFORM t.record('M03 Empresa sem o app Caixa & Financeiro não conecta', r = 'null', r);

  PERFORM t.as_anon();
  r := t.attempt('select public.mp_manage_company()');
  PERFORM t.record('M04 Visitante sem login não executa a função', r LIKE 'err:%', r);

  -- ===== Tokens e estado do OAuth: nunca acessíveis pelo navegador =====
  PERFORM t.as_user(oA);
  r := t.attempt('select count(*) from public.provider_tokens');
  r2 := t.attempt('select count(*) from public.provider_oauth_states');
  PERFORM t.record('M05 Nem o dono lê tokens ou estado do OAuth', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  r := t.attempt(format($q$insert into public.provider_tokens(connection_id,company_id,provider,provider_user_id,access_token_enc,expires_at) values (%L,%L,'mercado_pago','x','x',now())$q$, connA, cA));
  r2 := t.attempt(format($q$insert into public.provider_oauth_states(state,company_id,unit_id,user_id,provider,code_verifier) values ('s2',%L,%L,%L,'mercado_pago','v')$q$, cA, uA1, oA));
  PERFORM t.record('M06 Dono não grava tokens nem estado pelo navegador', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_anon();
  r := t.attempt('select count(*) from public.provider_tokens');
  PERFORM t.record('M07 Visitante não lê tokens', r LIKE 'err:%', r);

  -- ===== Conexão visível só na própria empresa, sem segredo =====
  PERFORM t.as_user(caA);
  r := t.val($q$select count(*) from public.sales_connections where provider='mercado_pago'$q$);
  r2 := t.val($q$select config::text from public.sales_connections where provider='mercado_pago'$q$);
  PERFORM t.record('M08 Equipe da empresa vê a conexão, sem token', r = '1' AND r2 NOT LIKE '%enc%' AND r2 NOT LIKE '%token%', r || ' ' || r2);

  PERFORM t.as_user(oB);
  r := t.val($q$select count(*) from public.sales_connections where provider='mercado_pago'$q$);
  PERFORM t.record('M09 Outra empresa não vê a conexão', r = '0', r);

  -- ===== Integridade =====
  PERFORM t.as_super();
  r := t.attempt(format($q$insert into public.sales_connections(company_id,unit_id,provider) values (%L,%L,'mercado_pago')$q$, cA, uA1));
  PERFORM t.record('M10 Só uma conexão Mercado Pago por empresa', r LIKE 'err:%', r);

  r := t.attempt(format($q$insert into public.sales_connections(company_id,provider) values (%L,'mercado_pago') returning id$q$, cB));
  r2 := t.attempt(format($q$with c as (insert into public.sales_connections(company_id,provider) values (%L,'mercado_pago') returning id)
      insert into public.provider_tokens(connection_id,company_id,provider,provider_user_id,access_token_enc,expires_at)
      select id,%L,'mercado_pago','111','x',now() from c$q$, cB, cB));
  PERFORM t.record('M11 A mesma conta Mercado Pago não fica em duas empresas', r LIKE 'ok:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  r := t.run(format('delete from public.sales_connections where id=%L', connA));
  r2 := t.val('select count(*) from public.provider_tokens');
  PERFORM t.record('M12 Apagar a conexão apaga os tokens', r = 'ok:1' AND r2 = '0', r || ' tokens=' || r2);
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
