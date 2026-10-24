-- Testes do MyFoods Caixa & Financeiro (F3, etapa 1). Contêiner DESCARTÁVEL, dados fictícios.
-- t.run = executa e mantém (fluxo do caixa); t.attempt = executa e sempre reverte (tentativas indevidas).
CREATE SCHEMA IF NOT EXISTS t;
CREATE TABLE IF NOT EXISTS t.results (id serial PRIMARY KEY, name text, passed boolean, detail text);

CREATE OR REPLACE FUNCTION t.record(_name text, _passed boolean, _detail text DEFAULT '')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = t, pg_temp AS
$$ INSERT INTO t.results(name, passed, detail) VALUES (_name, coalesce(_passed, false), _detail) $$;

CREATE OR REPLACE FUNCTION t.as_user(_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;
CREATE OR REPLACE FUNCTION t.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $$;
CREATE OR REPLACE FUNCTION t.as_super() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'RESET ROLE'; PERFORM set_config('request.jwt.claim.sub', '', true); END $$;

CREATE OR REPLACE FUNCTION t.run(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE _sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN 'ok:' || n;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'err:' || SQLERRM;
  END;
END $$;
CREATE OR REPLACE FUNCTION t.attempt(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE _sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__ok__' || n;
  EXCEPTION WHEN OTHERS THEN
    IF left(SQLERRM, 6) = '__ok__' THEN RETURN 'ok:' || substr(SQLERRM, 7); END IF;
    RETURN 'err:' || SQLERRM;
  END;
END $$;
CREATE OR REPLACE FUNCTION t.val(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  BEGIN EXECUTE _sql INTO r; RETURN coalesce(r, 'null');
  EXCEPTION WHEN OTHERS THEN RETURN 'err:' || SQLERRM; END;
END $$;
GRANT USAGE ON SCHEMA t TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  fiA constant uuid := 'a0000000-0000-0000-0000-0000000000a3';
  stA constant uuid := 'a0000000-0000-0000-0000-0000000000a4';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  cA  constant uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  cB  constant uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  uA1 constant uuid := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant uuid := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  r text; r2 text;
  regA1 uuid; regA2 uuid; regB uuid; accCaixaA1 uuid; accCofreA uuid;
  pmCashA uuid; pmPixA uuid; pmCashB uuid; catFornA uuid; catFornB uuid;
  sessA uuid; sessB uuid; salePix uuid; revPix uuid; anyMov uuid; recA uuid; entA uuid;
BEGIN
  -- ===== Configuração inicial =====
  PERFORM t.as_user(oA);
  r := t.run('select public.fin_bootstrap_company()');
  PERFORM t.as_super();
  r2 := t.val(format($q$select concat_ws('/',
      (select count(*) from public.fin_accounts where company_id=%1$L),
      (select count(*) from public.cash_registers where company_id=%1$L),
      (select count(*) from public.fin_categories where company_id=%1$L),
      (select count(*) from public.payment_methods where company_id=%1$L))$q$, cA));
  PERFORM t.record('C01 Dono configura o app: 4 contas, 2 caixas, 12 categorias, 5 formas de pagamento', r LIKE 'ok:%' AND r2 = '4/2/12/5', r || ' ' || r2);
  PERFORM t.as_user(oA);
  r := t.run('select public.fin_bootstrap_company()');
  PERFORM t.as_super();
  PERFORM t.record('C01b Configuração é idempotente', r LIKE 'ok:%' AND t.val(format('select count(*) from public.fin_categories where company_id=%L', cA)) = '12', r);

  PERFORM t.as_user(caA);
  r := t.attempt('select public.fin_bootstrap_company()');
  PERFORM t.record('C02 Operador de caixa não configura o app', r LIKE 'err:%', r);

  PERFORM t.as_super();
  SELECT id INTO regA1 FROM public.cash_registers WHERE unit_id = uA1;
  SELECT id INTO regA2 FROM public.cash_registers WHERE unit_id = uA2;
  SELECT id INTO accCaixaA1 FROM public.fin_accounts WHERE company_id = cA AND unit_id = uA1;
  SELECT id INTO accCofreA FROM public.fin_accounts WHERE company_id = cA AND name = 'Cofre';
  SELECT id INTO pmCashA FROM public.payment_methods WHERE company_id = cA AND kind = 'cash';
  SELECT id INTO pmPixA FROM public.payment_methods WHERE company_id = cA AND kind = 'pix';
  SELECT id INTO catFornA FROM public.fin_categories WHERE company_id = cA AND name = 'Fornecedores';

  PERFORM t.as_user(fiA);
  r := t.run(format('update public.fin_accounts set opening_balance = 100 where id = %L', accCaixaA1));
  PERFORM t.record('C03 Financeiro define o saldo inicial da conta do caixa', r = 'ok:1', r);

  -- ===== Abertura =====
  PERFORM t.as_user(caA);
  r := t.run(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 100)', regA1));
  PERFORM t.record('C04 Operador abre o caixa da sua unidade', r = 'ok:1', r);
  PERFORM t.as_super();
  SELECT id INTO sessA FROM public.cash_sessions WHERE register_id = regA1 AND status = 'open';
  PERFORM t.as_user(caA);
  r := t.attempt(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 0)', regA1));
  PERFORM t.record('C04b Não abre dois caixas no mesmo registro', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 0)', regA2));
  PERFORM t.record('C04c Operador não abre caixa de unidade não vinculada', r LIKE 'err:%', r);
  PERFORM t.as_user(fiA);
  r := t.attempt(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 0)', regA2));
  PERFORM t.record('C04d Financeiro não opera caixa', r LIKE 'err:%', r);
  PERFORM t.as_user(stA);
  r := t.attempt(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 0)', regA1));
  r2 := t.val('select count(*) from public.cash_sessions');
  PERFORM t.record('C04e Colaborador comum não abre nem vê caixas', r LIKE 'err:%' AND r2 = '0', r || ' vê=' || r2);

  -- ===== Contas para sangria (operador vê nomes, não saldos) =====
  PERFORM t.as_user(caA);
  r := t.val('select string_agg(name, '','' order by name) from public.cf_transfer_accounts()');
  PERFORM t.record('C04f Operador lista contas para sangria (só nomes)', r LIKE '%Cofre%', r);
  PERFORM t.as_user(oB);
  r := t.val(format('select count(*) from public.cf_transfer_accounts() where id = %L', accCofreA));
  PERFORM t.record('C04g Dono de B não vê as contas de A na lista', r = '0', r);
  PERFORM t.as_user(stA);
  r := t.val('select count(*) from public.cf_transfer_accounts()');
  PERFORM t.record('C04h Colaborador comum não lista contas', r = '0', r);

  -- ===== Movimentos =====
  PERFORM t.as_user(caA);
  r := concat_ws(' ',
    t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,100)', sessA, pmCashA)),
    t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,50)', sessA, pmPixA)),
    t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,category_id) values (%L,''expense'',%L,20,%L)', sessA, pmCashA, catFornA)),
    t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,counter_account_id) values (%L,''withdrawal'',%L,30,%L)', sessA, pmCashA, accCofreA)),
    t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,counter_account_id) values (%L,''supply'',%L,10,%L)', sessA, pmCashA, accCofreA)));
  PERFORM t.record('C05 Operador registra venda, venda Pix, saída, sangria e suprimento', r = 'ok:1 ok:1 ok:1 ok:1 ok:1', r);
  r := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,counter_account_id) values (%L,''withdrawal'',%L,5,%L)', sessA, pmPixA, accCofreA));
  r2 := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''withdrawal'',%L,5)', sessA, pmCashA));
  PERFORM t.record('C05b Sangria só em dinheiro e com conta de destino', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);
  r := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,0)', sessA, pmCashA));
  PERFORM t.record('C05c Valor precisa ser positivo', r LIKE 'err:%', r);

  PERFORM t.as_super();
  SELECT id INTO salePix FROM public.cash_movements WHERE session_id = sessA AND payment_method_id = pmPixA;
  PERFORM t.as_user(caA);
  r := t.attempt(format('update public.cash_movements set amount = 1 where id = %L', salePix));
  r2 := t.attempt(format('delete from public.cash_movements where id = %L', salePix));
  PERFORM t.record('C06 Movimento não pode ser alterado nem apagado', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  r := t.run(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,reversal_of) values (%L,''sale'',%L,1,%L)', sessA, pmCashA, salePix));
  PERFORM t.as_super();
  SELECT id INTO revPix FROM public.cash_movements WHERE reversal_of = salePix;
  r2 := t.val(format('select payment_method_id::text || ''/'' || amount from public.cash_movements where id = %L', revPix));
  PERFORM t.record('C07 Estorno copia o original (forma e valor), ignorando o que foi enviado', r = 'ok:1' AND r2 = pmPixA::text || '/50.00', r || ' ' || r2);
  PERFORM t.as_user(caA);
  r := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,reversal_of) values (%L,''sale'',%L,1,%L)', sessA, pmPixA, salePix));
  r2 := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount,reversal_of) values (%L,''sale'',%L,1,%L)', sessA, pmPixA, revPix));
  PERFORM t.record('C07b Não estorna duas vezes nem estorna um estorno', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  r := t.val('select count(*) from public.fin_entries');
  r2 := t.attempt(format('insert into public.fin_entries(company_id,kind,description,amount) values (%L,''expense'',''x'',1)', cA));
  PERFORM t.record('C08 Operador não vê nem lança no financeiro', r = '0' AND r2 LIKE 'err:%', 'vê=' || r || ' ' || r2);

  -- ===== Isolamento entre empresas =====
  PERFORM t.as_user(oB);
  PERFORM t.run('select public.fin_bootstrap_company()');
  r := concat_ws('/',
    t.val(format('select count(*) from public.cash_sessions where company_id=%L', cA)),
    t.val(format('select count(*) from public.cash_movements where company_id=%L', cA)),
    t.val(format('select count(*) from public.payment_methods where company_id=%L', cA)),
    t.val(format('select count(*) from public.fin_accounts where company_id=%L', cA)));
  PERFORM t.record('C09 Dono de B não vê caixas, movimentos, formas nem contas de A', r = '0/0/0/0', r);
  r := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,999)', sessA, pmCashA));
  r2 := t.attempt(format('select public.close_cash_session(%L, ''[]''::jsonb)', sessA));
  PERFORM t.record('C09b Dono de B não movimenta nem fecha caixa de A', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);
  PERFORM t.as_super();
  SELECT id INTO regB FROM public.cash_registers WHERE company_id = cB LIMIT 1;
  SELECT id INTO pmCashB FROM public.payment_methods WHERE company_id = cB AND kind = 'cash';
  SELECT id INTO catFornB FROM public.fin_categories WHERE company_id = cB AND name = 'Fornecedores';
  PERFORM t.as_user(oB);
  PERFORM t.run(format('insert into public.cash_sessions(register_id, opening_amount) values (%L, 0)', regB));
  PERFORM t.as_super();
  SELECT id INTO sessB FROM public.cash_sessions WHERE register_id = regB AND status = 'open';
  PERFORM t.as_user(oB);
  r := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,10)', sessB, pmCashA));
  r2 := t.attempt(format('insert into public.fin_entries(company_id,kind,description,amount,category_id) values (%L,''expense'',''x'',1,%L)', cB, catFornA));
  PERFORM t.record('C09c B não usa forma de pagamento nem categoria de A', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);
  r := t.attempt(format('insert into public.fin_entries(company_id,kind,description,amount) values (%L,''expense'',''x'',1)', cA));
  PERFORM t.record('C09d B não lança no financeiro de A', r LIKE 'err:%', r);

  -- ===== Fechamento =====
  PERFORM t.as_user(caA);
  r := t.attempt(format('select public.close_cash_session(%L, ''[]''::jsonb)', sessA));
  PERFORM t.record('C10 Fechamento exige a conferência do dinheiro', r LIKE 'err:%', r);
  r := t.run(format('select public.close_cash_session(%L, %L::jsonb, ''fechamento de teste'')', sessA,
    json_build_array(json_build_object('payment_method_id', pmCashA, 'counted', 155))::text));
  PERFORM t.as_super();
  r2 := t.val(format('select status || ''/'' || expected_total || ''/'' || counted_total || ''/'' || difference from public.cash_sessions where id = %L', sessA));
  PERFORM t.record('C10b Operador fecha: esperado 160, conferido 155, falta 5', r LIKE 'ok:%' AND r2 = 'closed/160.00/155.00/-5.00', r || ' ' || r2);
  PERFORM t.as_user(caA);
  r := t.attempt(format('select public.close_cash_session(%L, ''[]''::jsonb)', sessA));
  r2 := t.attempt(format('insert into public.cash_movements(session_id,type,payment_method_id,amount) values (%L,''sale'',%L,1)', sessA, pmCashA));
  PERFORM t.record('C10c Caixa fechado não fecha de novo nem recebe movimentos', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_super();
  r := t.val(format($q$select string_agg(kind || ':' || amount || ':' || coalesce((select name from public.fin_accounts a where a.id = account_id), '-'), ' ' order by kind, amount)
    from public.fin_entries where source = 'cash_session' and source_ref = %L$q$, sessA));
  PERFORM t.record('C11 Fechamento gera os lançamentos certos (Pix estornado não gera nada)',
    r = 'expense:5.00:Caixa — A Centro expense:20.00:Caixa — A Centro income:100.00:Caixa — A Centro transfer_in:10.00:Caixa — A Centro transfer_in:30.00:Cofre transfer_out:10.00:Cofre transfer_out:30.00:Caixa — A Centro', r);

  -- ===== Visão do financeiro =====
  PERFORM t.as_user(fiA);
  r := t.val(format('select balance from public.fin_account_balances where account_id = %L', accCaixaA1));
  r2 := t.val(format('select balance from public.fin_account_balances where account_id = %L', accCofreA));
  PERFORM t.record('C12 Saldo da conta do caixa = dinheiro conferido (155); Cofre = 20', r = '155.00' AND r2 = '20.00', r || ' / ' || r2);
  r := t.val($q$select sum(amount) filter (where kind='income') || '/' || sum(amount) filter (where kind='expense')
    from public.fin_entries where status='paid' and paid_at >= now() - interval '1 day'$q$);
  PERFORM t.record('C13 Receitas 100 e despesas 25 no período; transferências fora do resultado', r = '100.00/25.00', r);
  PERFORM t.as_user(caA);
  r := t.val('select count(*) from public.fin_account_balances');
  PERFORM t.record('C13b Operador não vê saldos do financeiro', r = '0', r);

  -- ===== Contas a pagar e recorrência =====
  PERFORM t.as_user(fiA);
  r := t.run(format($q$insert into public.fin_entries(company_id,kind,category_id,description,amount,due_date) values (%L,'expense',%L,'Fornecedor de café',300,current_date + 3)$q$, cA, catFornA));
  PERFORM t.as_super();
  SELECT id INTO entA FROM public.fin_entries WHERE description = 'Fornecedor de café';
  PERFORM t.as_user(fiA);
  r2 := t.run(format($q$update public.fin_entries set status='paid', paid_at=now(), account_id=%L where id=%L$q$, accCofreA, entA));
  PERFORM t.record('C14 Financeiro lança conta a pagar e dá baixa', r = 'ok:1' AND r2 = 'ok:1', r || ' ' || r2);
  r := t.attempt(format($q$update public.fin_entries set paid_at = null where id=%L$q$, entA));
  PERFORM t.record('C14b Lançamento pago precisa ter data de pagamento', r LIKE 'err:%', r);

  r := t.run(format($q$insert into public.fin_recurrences(company_id,kind,category_id,description,amount,frequency,starts_on) values (%L,'expense',%L,'Aluguel',2000,'monthly','2026-01-31')$q$, cA, catFornA));
  r2 := t.val('select public.fin_materialize_recurrences(''2026-04-30'')');
  PERFORM t.as_super();
  r := t.val($q$select string_agg(due_date::text, ',' order by due_date) from public.fin_entries where description='Aluguel'$q$);
  PERFORM t.record('C15 Recorrência mensal no dia 31 respeita o fim do mês', r2 = '4' AND r = '2026-01-31,2026-02-28,2026-03-31,2026-04-30', r2 || ' ' || r);
  PERFORM t.as_user(fiA);
  r2 := t.val('select public.fin_materialize_recurrences(''2026-04-30'')');
  PERFORM t.record('C15b Gerar de novo não duplica', r2 = '0', r2);
  PERFORM t.as_user(caA);
  r := t.attempt(format($q$insert into public.fin_recurrences(company_id,kind,description,amount,frequency,starts_on) values (%L,'expense','x',1,'monthly',current_date)$q$, cA));
  PERFORM t.record('C15c Operador não cria recorrência', r LIKE 'err:%', r);

  -- ===== Empresa sem o app, anon =====
  PERFORM t.as_user(oC);
  r := t.attempt('select public.fin_bootstrap_company()');
  r2 := t.val('select count(*) from public.payment_methods');
  PERFORM t.record('C16 Empresa sem o app não configura nem vê nada', r LIKE 'err:%' AND r2 = '0', r || ' vê=' || r2);
  PERFORM t.as_anon();
  r := t.attempt('select 1 from public.fin_entries limit 1');
  r2 := t.attempt('select public.close_cash_session(gen_random_uuid(), ''[]''::jsonb)');
  PERFORM t.record('C17 Visitante sem login não acessa nada', r LIKE 'err:%' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_super();
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
