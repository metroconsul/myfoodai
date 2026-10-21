-- Dados 100% FICTÍCIOS. Executado como superusuário do contêiner descartável (ignora RLS).
-- UUIDs fixos para os testes. Prefixos: aaaa = empresa A, bbbb = empresa B.

-- Usuários (o trigger on_auth_user_created cria os perfis sem empresa)
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner.a@teste.invalid'),
  ('a0000000-0000-0000-0000-000000000002', 'admin.a@teste.invalid'),
  ('a0000000-0000-0000-0000-000000000003', 'colab.a@teste.invalid'),
  ('b0000000-0000-0000-0000-000000000001', 'owner.b@teste.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'admin.b@teste.invalid'),
  ('b0000000-0000-0000-0000-000000000003', 'colab.b@teste.invalid'),
  ('b0000000-0000-0000-0000-000000000004', 'novo.b@teste.invalid'),
  ('c0000000-0000-0000-0000-000000000001', 'ab.dupla@teste.invalid');

-- plano 'equipe': permite 2 unidades e 5 administradores (o plano padrão limita a 1 unidade)
INSERT INTO public.companies (id, name, plan_code, access_source, subscription_status) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Empresa A (fictícia)', 'equipe', 'admin_grant', 'admin_grant'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Empresa B (fictícia)', 'equipe', 'admin_grant', 'admin_grant');

INSERT INTO public.units (id, company_id, name) VALUES
  ('aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A1'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A2'),
  ('bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'B1');

-- Perfis ANTES dos papéis (mesma ordem de bootstrapCompany)
UPDATE public.profiles SET company_id = 'aaaaaaaa-0000-0000-0000-000000000001'
 WHERE id IN ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
              'a0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET company_id = 'bbbbbbbb-0000-0000-0000-000000000001'
 WHERE id IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
              'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004');

INSERT INTO public.user_roles (user_id, company_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','owner'),
  ('a0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','admin'),
  ('a0000000-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','staff'),
  ('b0000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','owner'),
  ('b0000000-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','admin'),
  ('b0000000-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','staff'),
  ('c0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','staff');

INSERT INTO public.user_units (user_id, unit_id) VALUES
  ('a0000000-0000-0000-0000-000000000002','aaaaaaaa-1000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003','aaaaaaaa-1000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002','bbbbbbbb-1000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003','bbbbbbbb-1000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001','aaaaaaaa-1000-0000-0000-000000000001');

-- Cenário "usuário das duas empresas": papel de dono PLANTADO em B para o usuário AB (cujo perfil é de A).
-- Antes da correção nada impede essa linha; depois, o trigger a rejeita, então é plantada com o trigger desligado
-- (se existir) apenas para provar que as FUNÇÕES ignoram papéis de outra empresa.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_user_role_company') THEN
    ALTER TABLE public.user_roles DISABLE TRIGGER enforce_user_role_company;
  END IF;
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES ('c0000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','owner');
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_user_role_company') THEN
    ALTER TABLE public.user_roles ENABLE TRIGGER enforce_user_role_company;
  END IF;
END $$;
