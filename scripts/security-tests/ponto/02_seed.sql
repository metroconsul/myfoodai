-- Dados FICTÍCIOS do ponto (contêiner descartável), executado como superusuário depois do seed do Caixa.
-- A e B têm o app Ponto; C não tem. A tem RH (todas as unidades) e supervisor só da unidade "A Centro".
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-0000000000a5', 'rh.a@teste.invalid'),
  ('a0000000-0000-0000-0000-0000000000a6', 'supervisor.a@teste.invalid');
UPDATE public.profiles SET company_id = 'aaaaaaaa-0000-0000-0000-00000000000a' WHERE id::text LIKE 'a0000000%';
INSERT INTO public.user_roles (user_id, company_id, role) VALUES
  ('a0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-0000-0000-0000-00000000000a', 'hr'),
  ('a0000000-0000-0000-0000-0000000000a6', 'aaaaaaaa-0000-0000-0000-00000000000a', 'supervisor');
INSERT INTO public.user_units (user_id, unit_id) VALUES
  ('a0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-1000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-1000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000a6', 'aaaaaaaa-1000-0000-0000-0000000000a1');

INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_ponto', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_ponto', true, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_ponto', false, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'fixed_schedule', true, 'plan')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.employees (id, company_id, unit_id, full_name, cpf) VALUES
  ('e0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', 'Ana (A Centro)', '00000000191'),
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a2', 'Bia (A Bairro)', '00000000272'),
  ('e0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-1000-0000-0000-0000000000b1', 'Caio (B)', '00000000353'),
  ('e0000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'cccccccc-1000-0000-0000-0000000000c1', 'Davi (C)', '00000000434');

INSERT INTO public.time_entries (company_id, unit_id, employee_id, entry_type, server_time) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', 'entrada', now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-0000000000a2', 'entrada', now() - interval '2 hours'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-1000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000b1', 'entrada', now() - interval '2 hours'),
  ('cccccccc-0000-0000-0000-00000000000c', 'cccccccc-1000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'entrada', now() - interval '2 hours');

INSERT INTO public.schedules (id, company_id, unit_id, name, period_start, period_end) VALUES
  ('5c000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', 'Semana A1', '2026-10-19', '2026-10-25'),
  ('5c000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a2', 'Semana A2', '2026-10-19', '2026-10-25'),
  ('5c000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'cccccccc-1000-0000-0000-0000000000c1', 'Semana C1', '2026-10-19', '2026-10-25');
INSERT INTO public.schedule_blocks (company_id, unit_id, schedule_id, employee_id, work_date, start_at, end_at) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', '5c000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', '2026-10-20', '2026-10-20 11:00Z', '2026-10-20 19:00Z'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a2', '5c000000-0000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-0000000000a2', '2026-10-20', '2026-10-20 11:00Z', '2026-10-20 19:00Z');

INSERT INTO public.point_cards (id, company_id, unit_id, employee_id, period_start, period_end) VALUES
  ('cc000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', '2026-10-01', '2026-10-31');

INSERT INTO public.fixed_work_schedules (company_id, unit_id, weekdays, start_time, end_time) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1', '{1,2,3,4,5}', '08:00', '17:00'),
  ('cccccccc-0000-0000-0000-00000000000c', 'cccccccc-1000-0000-0000-0000000000c1', '{1,2,3,4,5}', '08:00', '17:00');
