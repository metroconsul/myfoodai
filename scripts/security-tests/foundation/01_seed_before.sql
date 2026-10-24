-- Dados FICTÍCIOS, criados ANTES das migrations da fundação (para testar o backfill).
-- O trigger sync_plan_entitlements aplica os recursos do plano em cada INSERT de empresa.
INSERT INTO public.companies (id, name, plan_code, access_source, subscription_status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Empresa Começo (fictícia)',    'comeco',    'admin_grant', 'admin_grant'),
  ('b1000000-0000-0000-0000-000000000001', 'Empresa Essencial (fictícia)', 'essencial', 'admin_grant', 'admin_grant'),
  ('c1000000-0000-0000-0000-000000000001', 'Empresa Equipe (fictícia)',    'equipe',    'admin_grant', 'admin_grant');

INSERT INTO auth.users (id, email) VALUES ('a1000000-0000-0000-0000-0000000000aa', 'operador@teste.invalid');
UPDATE public.profiles SET company_id = 'a1000000-0000-0000-0000-000000000001'
 WHERE id = 'a1000000-0000-0000-0000-0000000000aa';
