-- Dados 100% FICTÍCIOS (contêiner descartável). Executado como superusuário.
-- A e B têm o app Caixa & Financeiro; C não tem.
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-0000000000a1', 'dono.a@teste.invalid'),
  ('a0000000-0000-0000-0000-0000000000a2', 'operador.a@teste.invalid'),
  ('a0000000-0000-0000-0000-0000000000a3', 'financeiro.a@teste.invalid'),
  ('a0000000-0000-0000-0000-0000000000a4', 'staff.a@teste.invalid'),
  ('b0000000-0000-0000-0000-0000000000b1', 'dono.b@teste.invalid'),
  ('c0000000-0000-0000-0000-0000000000c1', 'dono.c@teste.invalid');

INSERT INTO public.companies (id, name, plan_code, access_source, subscription_status) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Cafeteria A (fictícia)', 'equipe', 'admin_grant', 'admin_grant'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Restaurante B (fictício)', 'equipe', 'admin_grant', 'admin_grant'),
  ('cccccccc-0000-0000-0000-00000000000c', 'Padaria C (fictícia)', 'comeco', 'admin_grant', 'admin_grant');

INSERT INTO public.units (id, company_id, name) VALUES
  ('aaaaaaaa-1000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A Centro'),
  ('aaaaaaaa-1000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A Bairro'),
  ('bbbbbbbb-1000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'B Matriz'),
  ('cccccccc-1000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'C Única');

UPDATE public.profiles SET company_id = 'aaaaaaaa-0000-0000-0000-00000000000a' WHERE id::text LIKE 'a0000000%';
UPDATE public.profiles SET company_id = 'bbbbbbbb-0000-0000-0000-00000000000b' WHERE id::text LIKE 'b0000000%';
UPDATE public.profiles SET company_id = 'cccccccc-0000-0000-0000-00000000000c' WHERE id::text LIKE 'c0000000%';

INSERT INTO public.user_roles (user_id, company_id, role) VALUES
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  ('a0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'cashier'),
  ('a0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-00000000000a', 'finance'),
  ('a0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-00000000000a', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'owner'),
  ('c0000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'owner');

-- Operador vinculado só à unidade "A Centro"; financeiro vinculado às duas unidades de A.
INSERT INTO public.user_units (user_id, unit_id) VALUES
  ('a0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-1000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-1000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-1000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-1000-0000-0000-0000000000a1');

-- App Caixa & Financeiro contratado por A e B (como faria a tela de administração).
INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_caixa_financeiro', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_caixa_financeiro', true, 'app_contract')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = true;
