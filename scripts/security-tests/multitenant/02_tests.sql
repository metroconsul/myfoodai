-- Testes multitenant. Rodam em contêiner DESCARTÁVEL, depois de 00_platform_stubs.sql e 01_seed.sql.
-- Uso: psql -v ON_ERROR_STOP=1 -v phase=before|after -f 02_tests.sql
-- Cada tentativa de escrita roda numa subtransação revertida (t.attempt): o estado do banco não muda entre testes.

CREATE SCHEMA IF NOT EXISTS t;
CREATE TABLE IF NOT EXISTS t.results (
  id serial PRIMARY KEY, phase text, name text, passed boolean, detail text
);
SELECT set_config('t.phase', :'phase', false);

CREATE OR REPLACE FUNCTION t.record(_name text, _passed boolean, _detail text DEFAULT '')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = t, pg_temp AS
$$ INSERT INTO t.results(phase, name, passed, detail)
   VALUES (current_setting('t.phase', true), _name, _passed, _detail) $$;

CREATE OR REPLACE FUNCTION t.as_user(_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION t.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  EXECUTE 'SET LOCAL ROLE service_role';
END $$;

CREATE OR REPLACE FUNCTION t.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $$;

-- Executa um comando no papel atual e SEMPRE reverte. Retorna 'ok:<linhas>' ou 'err:<mensagem>'.
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

-- Executa _sql no papel atual; se passar, troca para _then_uid (authenticated) e avalia _check_sql. Sempre reverte.
CREATE OR REPLACE FUNCTION t.attempt_then(_sql text, _then_uid uuid, _check_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  BEGIN
    EXECUTE _sql;
    PERFORM t.as_user(_then_uid);
    EXECUTE _check_sql INTO r;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__ok__' || coalesce(r, 'null');
  EXCEPTION WHEN OTHERS THEN
    IF left(SQLERRM, 6) = '__ok__' THEN RETURN 'ok:' || substr(SQLERRM, 7); END IF;
    RETURN 'err:' || SQLERRM;
  END;
END $$;

CREATE OR REPLACE FUNCTION t.val(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; BEGIN EXECUTE _sql INTO r; RETURN coalesce(r, 'null'); END $$;

GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;

DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-000000000001';
  adA constant uuid := 'a0000000-0000-0000-0000-000000000002';
  coA constant uuid := 'a0000000-0000-0000-0000-000000000003';
  oB  constant uuid := 'b0000000-0000-0000-0000-000000000001';
  adB constant uuid := 'b0000000-0000-0000-0000-000000000002';
  coB constant uuid := 'b0000000-0000-0000-0000-000000000003';
  nvB constant uuid := 'b0000000-0000-0000-0000-000000000004';
  ab  constant uuid := 'c0000000-0000-0000-0000-000000000001';
  cA  constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  cB  constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  uA1 constant uuid := 'aaaaaaaa-1000-0000-0000-000000000001';
  uA2 constant uuid := 'aaaaaaaa-1000-0000-0000-000000000002';
  uB1 constant uuid := 'bbbbbbbb-1000-0000-0000-000000000001';
  r text; r2 text;
  ph text := current_setting('t.phase', true);
BEGIN
  -- ===== T01–T02: Administrador A enxerga só a empresa A =====
  PERFORM t.as_user(adA);
  r  := t.val(format('select count(*) from public.user_roles where company_id = %L', cA));
  r2 := t.val(format('select count(*) from public.user_roles where company_id = %L', cB));
  PERFORM t.record('T01 AdminA lê papéis de A e não lê papéis de B', r::int > 0 AND r2 = '0', 'A='||r||' B='||r2);
  r  := t.val(format('select count(*) from public.user_units where unit_id = %L', uB1));
  r2 := t.val(format('select count(*) from public.user_units where unit_id in (%L,%L)', uA1, uA2));
  PERFORM t.record('T02 AdminA não lê vínculos de unidade de B e lê os de A', r = '0' AND r2::int > 0, 'B='||r||' A='||r2);

  -- ===== T03: AdminA não promove usuários de B =====
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''admin'')', nvB, cA));
  PERFORM t.record('T03a AdminA não atribui papel (empresa A) a usuário de B', r LIKE 'err:%', r);
  r := t.attempt_then(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''admin'')', nvB, cA),
                      nvB, 'select app_auth.is_company_admin()::text');
  PERFORM t.record('T03b Usuário de B NÃO vira admin por papel plantado por A', r NOT LIKE 'ok:true', r);
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''admin'')', nvB, cB));
  PERFORM t.record('T03c AdminA não atribui papel na empresa B', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''owner'')', coA, cA));
  PERFORM t.record('T03d Admin (não dono) não concede papel owner', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''hr'')', coA, cA));
  PERFORM t.record('T03e AdminA concede papel hr a colaborador de A (legítimo)', r = 'ok:1' OR (ph = 'final' AND r LIKE 'err:permission denied%'), r);

  -- ===== T04: AdminA não mexe em user_units de B =====
  r := t.attempt(format('update public.user_units set unit_id = %L where unit_id = %L', uA2, uB1));
  PERFORM t.record('T04a UPDATE de user_units de B não afeta linhas', r IN ('ok:0') OR r LIKE 'err:%', r);
  r := t.attempt(format('delete from public.user_units where unit_id = %L', uB1));
  PERFORM t.record('T04b DELETE de user_units de B não afeta linhas', r IN ('ok:0') OR r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', adA, uB1));
  PERFORM t.record('T04c AdminA não vincula usuário a unidade de B', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', nvB, uA2));
  PERFORM t.record('T04d AdminA não vincula usuário de B a unidade de A', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', coA, uA2));
  PERFORM t.record('T04e AdminA vincula colaborador de A a unidade de A (legítimo)', r = 'ok:1' OR (ph = 'final' AND r LIKE 'err:permission denied%'), r);

  -- ===== T05: AdminB segue funcionando =====
  PERFORM t.as_user(adB);
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''staff'')', nvB, cB));
  PERFORM t.record('T05a AdminB concede papel staff a usuário de B', r = 'ok:1' OR (ph = 'final' AND r LIKE 'err:permission denied%'), r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', nvB, uB1));
  PERFORM t.record('T05b AdminB vincula usuário de B a unidade de B', r = 'ok:1' OR (ph = 'final' AND r LIKE 'err:permission denied%'), r);
  r := t.val(format('select count(*) from public.user_roles where company_id = %L', cB));
  PERFORM t.record('T05c AdminB lê papéis de B', r::int > 0, 'B='||r);
  r := t.val(format('select count(*) from public.user_roles where company_id = %L', cA));
  PERFORM t.record('T05d AdminB não lê papéis de A', r = '0', 'A='||r);
  r := t.val('select app_auth.can_manage_payroll()::text');
  PERFORM t.record('T05e AdminB gerencia folha em B', r = 'true', r);

  -- ===== T06: Colaborador A mantém só o acesso legítimo =====
  PERFORM t.as_user(coA);
  r := t.val(format('select count(*) from public.user_roles where user_id <> %L', coA));
  PERFORM t.record('T06a Colaborador só lê os próprios papéis', r = '0', 'outros='||r);
  r := t.val(format('select count(*) from public.user_units where user_id <> %L', coA));
  PERFORM t.record('T06b Colaborador só lê os próprios vínculos', r = '0', 'outros='||r);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uA1));
  PERFORM t.record('T06c Colaborador acessa a unidade A1 vinculada', r = 'true', r);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uA2));
  PERFORM t.record('T06d Colaborador não acessa A2 (não vinculada)', r = 'false', r);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uB1));
  PERFORM t.record('T06e Colaborador não acessa unidade de B', r = 'false', r);
  r := t.val('select (app_auth.is_company_admin() or app_auth.can_manage_payroll() or app_auth.can_see_all_units())::text');
  PERFORM t.record('T06f Colaborador não tem privilégio administrativo', r = 'false', r);
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''admin'')', coA, cA));
  PERFORM t.record('T06g Colaborador não se autopromove', r LIKE 'err:%', r);

  -- ===== T07–T08: Usuário "das duas empresas" e troca de contexto =====
  PERFORM t.as_user(ab);
  r := t.val('select (app_auth.is_company_admin())::text');
  PERFORM t.record('T07a AB: papel de dono plantado em B não o torna admin', r = 'false', r);
  r := t.val('select (app_auth.can_manage_payroll() or app_auth.can_see_all_units())::text');
  PERFORM t.record('T07b AB: papel plantado em B não concede folha/todas as unidades', r = 'false', r);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uB1));
  PERFORM t.record('T07c AB: sem acesso à unidade de B', r = 'false', r);
  r := t.val(format('select count(*) from public.user_roles where company_id = %L and user_id <> %L', cB, ab));
  PERFORM t.record('T07d AB: não lê papéis de outros usuários de B (só a própria linha plantada, user_roles_select)', r = '0', 'outros_em_B='||r);
  r := t.attempt(format('update public.companies set name = ''x'' where id = %L', cB));
  PERFORM t.record('T07e AB: não altera a empresa B', r IN ('ok:0') OR r LIKE 'err:%', r);

  -- Plantar papel em outra empresa deve ser rejeitado também para o superusuário/backend (defesa em profundidade)
  EXECUTE 'RESET ROLE';
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''admin'')', ab, cB));
  PERFORM t.record('T07f Backend não consegue plantar papel em empresa diferente da do perfil', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', ab, uB1));
  PERFORM t.record('T07g Backend não consegue vincular usuário a unidade de outra empresa', r LIKE 'err:%', r);

  -- T08: nenhum caminho do cliente para trocar de contexto
  PERFORM t.as_user(ab);
  r := t.attempt(format('update public.profiles set company_id = %L where id = %L', cB, ab));
  PERFORM t.record('T08a AB não troca a empresa do perfil', r LIKE 'err:%' OR r = 'ok:0', r);
  r := t.attempt(format('update public.profiles set active_unit_id = %L where id = %L', uB1, ab));
  PERFORM t.record('T08b AB não define unidade ativa de outra empresa', r LIKE 'err:%' OR r = 'ok:0', r);

  -- T09: fluxo de bootstrap (service_role) continua válido: perfil -> papel -> vínculo
  PERFORM t.as_service();
  r := t.attempt(format(
    'update public.profiles set company_id = %L where id = %L; '
    'insert into public.user_roles(user_id, company_id, role) values (%L,%L,''staff''); '
    'insert into public.user_units(user_id, unit_id) values (%L,%L)', cB, nvB, nvB, cB, nvB, uB1));
  PERFORM t.record('T09 Fluxo perfil -> papel -> unidade pelo backend segue válido', r = 'ok:1', r);

  -- T10: anon não lê nada
  PERFORM t.as_anon();
  r := t.attempt('select 1 from public.user_roles limit 1');
  PERFORM t.record('T10 anon não lê user_roles (0 linhas ou acesso negado)', r = 'ok:0' OR r LIKE 'err:%', r);

  -- T11–T12: leituras legítimas (regressão)
  PERFORM t.as_user(adA);
  r := t.val('select count(*) from public.units');
  PERFORM t.record('T11a AdminA vê as 2 unidades de A e nenhuma de B', r = '2', 'units='||r);
  r := t.val('select count(*) from public.companies');
  PERFORM t.record('T11b AdminA vê só a própria empresa', r = '1', 'companies='||r);
  r := t.val('select app_auth.can_manage_payroll()::text');
  PERFORM t.record('T12a AdminA gerencia folha em A', r = 'true', r);
  PERFORM t.as_user(oA);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uA2));
  PERFORM t.record('T12b Dono A acessa todas as unidades de A', r = 'true', r);
  r := t.val(format('select app_auth.has_unit_access(%L)::text', uB1));
  PERFORM t.record('T12c Dono A não acessa unidade de B', r = 'false', r);

  -- T13: grants de menor privilégio (fases before/final/rollback; na fase 'after' só a migration de políticas está aplicada)
  IF ph IN ('before','final','rollback') THEN
  PERFORM t.as_anon();
  r := t.attempt('select 1 from public.units limit 1');
  PERFORM t.record('T13a anon não tem acesso às tabelas de public', r LIKE 'err:%', r);
  PERFORM t.as_user(adA);
  r := t.attempt(format('insert into public.subscriptions(company_id, user_id) values (%L,%L)', cA, adA));
  PERFORM t.record('T13b authenticated não grava subscriptions', r LIKE 'err:%', r);
  r := t.attempt(format('update public.user_roles set role = ''owner'' where user_id = %L', coA));
  PERFORM t.record('T13c authenticated não altera user_roles pela API', r LIKE 'err:%', r);
  r := t.attempt('update public.employees set portal_pin_hash = ''x'' where false');
  PERFORM t.record('T13d authenticated não grava PIN do portal', r LIKE 'err:%', r);
  r := t.attempt(format('insert into public.employees(company_id, unit_id, full_name, cpf) values (%L,%L,''Teste Ficticio'',''00000000000''); '
                        'update public.employees set employment_status = ''afastado'' where full_name = ''Teste Ficticio''', cA, uA1));
  PERFORM t.record('T13e AdminA cadastra e altera status de colaborador (fluxo legítimo)', r = 'ok:1', r);
  r := t.attempt(format('update public.companies set name = ''Empresa A renomeada'' where id = %L', cA));
  PERFORM t.record('T13f AdminA altera dados de marca da empresa (fluxo legítimo)', r = 'ok:1', r);
  r := t.attempt(format('update public.companies set is_demo = true where id = %L', cA));
  PERFORM t.record('T13g authenticated não altera is_demo/status da empresa', r LIKE 'err:%', r);
  r := t.attempt(format('delete from public.companies where id = %L', cA));
  PERFORM t.record('T13h authenticated não apaga empresa', r LIKE 'err:%', r);
  PERFORM t.as_service();
  r := t.attempt('update public.employees set portal_pin_hash = ''x'' where false');
  PERFORM t.record('T13i service_role continua gravando PIN (servidor)', r = 'ok:0', r);
  END IF;

  -- T14: o servidor (service_role) continua administrando papéis e vínculos (é o único caminho de escrita na fase final)
  PERFORM t.as_service();
  r := t.attempt(format('insert into public.user_roles(user_id, company_id, role) values (%L,%L,''hr'')', coA, cA));
  PERFORM t.record('T14a backend concede papel a colaborador da mesma empresa', r = 'ok:1', r);
  r := t.attempt(format('insert into public.user_units(user_id, unit_id) values (%L,%L)', coA, uA2));
  PERFORM t.record('T14b backend vincula colaborador a unidade da mesma empresa', r = 'ok:1', r);

  EXECUTE 'RESET ROLE';
END
$tests$;

-- Resumo
SELECT phase, count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou
FROM t.results WHERE phase = :'phase' GROUP BY phase;
SELECT name, passed, detail FROM t.results WHERE phase = :'phase' ORDER BY id;
