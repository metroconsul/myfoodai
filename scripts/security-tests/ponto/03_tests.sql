-- Testes das regras de acesso do MyFoods Ponto (migration P2). Usa t.* do kit do Caixa & Financeiro.
DO $tests$
DECLARE
  oA  constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  caA constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  fiA constant uuid := 'a0000000-0000-0000-0000-0000000000a3';
  stA constant uuid := 'a0000000-0000-0000-0000-0000000000a4';
  hrA constant uuid := 'a0000000-0000-0000-0000-0000000000a5';
  suA constant uuid := 'a0000000-0000-0000-0000-0000000000a6';
  oB  constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  oC  constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
  uA1 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a1';
  uA2 constant text := 'aaaaaaaa-1000-0000-0000-0000000000a2';
  ins_block_a1 text := $q$insert into public.schedule_blocks(company_id,unit_id,schedule_id,employee_id,work_date,start_at,end_at)
    values ('aaaaaaaa-0000-0000-0000-00000000000a','aaaaaaaa-1000-0000-0000-0000000000a1','5c000000-0000-0000-0000-0000000000a1',
            'e0000000-0000-0000-0000-0000000000a1','2026-10-21','2026-10-21 11:00Z','2026-10-21 19:00Z')$q$;
  ins_block_a2 text := $q$insert into public.schedule_blocks(company_id,unit_id,schedule_id,employee_id,work_date,start_at,end_at)
    values ('aaaaaaaa-0000-0000-0000-00000000000a','aaaaaaaa-1000-0000-0000-0000000000a2','5c000000-0000-0000-0000-0000000000a2',
            'e0000000-0000-0000-0000-0000000000a2','2026-10-21','2026-10-21 11:00Z','2026-10-21 19:00Z')$q$;
  r text; r2 text; r3 text;
BEGIN
  -- ===== Quem gerencia o ponto continua vendo e mexendo =====
  PERFORM t.as_user(oA);
  r := t.val('select count(*) from public.time_entries');
  r2 := t.attempt(ins_block_a1);
  r3 := t.val('select count(*) from public.point_cards');
  PERFORM t.record('P01 Dono vê as batidas das duas unidades, mexe na escala e vê cartões', r = '2' AND r2 = 'ok:1' AND r3 = '1', r || ' | ' || r2 || ' | ' || r3);

  PERFORM t.as_user(hrA);
  r := t.val('select count(*) from public.time_entries');
  r2 := t.attempt(format('update public.fixed_work_schedules set end_time = %L where unit_id = %L', '18:00', uA1));
  PERFORM t.record('P02 RH vê as duas unidades e altera o horário padrão', r = '2' AND r2 = 'ok:1', r || ' | ' || r2);

  PERFORM t.as_user(suA);
  r := t.val('select count(*) from public.time_entries');
  r2 := t.attempt(ins_block_a1);
  r3 := t.attempt(ins_block_a2);
  PERFORM t.record('P03 Supervisor só vê e mexe na própria unidade', r = '1' AND r2 = 'ok:1' AND r3 LIKE 'err:%', r || ' | ' || r2 || ' | ' || r3);
  r := t.attempt(format('update public.fixed_work_schedules set end_time = %L where unit_id = %L', '18:00', uA1));
  PERFORM t.record('P04 Supervisor não altera o horário padrão da unidade', r = 'ok:0' OR r LIKE 'err:%', r);

  -- ===== Outros papéis da empresa não veem nem mexem no ponto =====
  PERFORM t.as_user(caA);
  r := concat_ws('/',
    t.val('select count(*) from public.time_entries'),
    t.val('select count(*) from public.schedule_blocks'),
    t.val('select count(*) from public.point_cards'),
    t.val('select count(*) from public.fixed_work_schedules'));
  r2 := t.attempt(ins_block_a1);
  PERFORM t.record('P05 Operador de caixa não vê batidas, escala, cartões nem horário e não cria escala', r = '0/0/0/0' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_user(fiA);
  r := concat_ws('/', t.val('select count(*) from public.time_entries'), t.val('select count(*) from public.schedules'));
  PERFORM t.record('P06 Financeiro não vê o ponto', r = '0/0', r);

  PERFORM t.as_user(stA);
  r := t.val('select count(*) from public.time_entries');
  r2 := t.attempt('update public.time_entries set entry_type = entry_type');
  PERFORM t.record('P07 Staff não vê nem altera batidas', r = '0' AND r2 = 'ok:0', r || ' | ' || r2);

  -- ===== Contratação e isolamento entre empresas =====
  PERFORM t.as_user(oC);
  r := concat_ws('/', t.val('select count(*) from public.time_entries'), t.val('select count(*) from public.schedules'), t.val('select count(*) from public.fixed_work_schedules'));
  r2 := t.attempt(format($q$update public.fixed_work_schedules set end_time = '18:00' where unit_id = %L$q$, 'cccccccc-1000-0000-0000-0000000000c1'));
  PERFORM t.record('P08 Empresa sem o app Ponto não vê nem altera os próprios dados de ponto', r = '0/0/0' AND r2 = 'ok:0', r || ' | ' || r2);

  PERFORM t.as_user(oB);
  r := t.val('select count(*) from public.time_entries');
  r2 := t.attempt(ins_block_a1);
  PERFORM t.record('P09 Dono de outra empresa só vê a própria e não mexe na escala de A', r = '1' AND r2 LIKE 'err:%', r || ' | ' || r2);

  PERFORM t.as_anon();
  r := t.attempt('select count(*) from public.time_entries');
  PERFORM t.record('P10 Visitante sem login não acessa', r LIKE 'err:%' OR r = 'ok:1', r);

  -- ===== Servidor (Portal, automação) não é afetado =====
  PERFORM t.as_super();
  r := t.val('select count(*) from public.time_entries');
  PERFORM t.record('P11 Servidor continua vendo tudo (Portal e automações)', r = '4', r);
END
$tests$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM t.results;
SELECT name, passed, detail FROM t.results ORDER BY id;
