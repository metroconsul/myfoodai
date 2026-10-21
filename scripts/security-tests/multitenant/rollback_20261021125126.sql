-- ROLLBACK da migration 20261021125126_tenant_scoped_roles_and_user_units.sql
-- NÃO executar em produção sem aprovação. Testado apenas pelo procedimento descrito em
-- docs/FASE1_TESTES_SEGURANCA_MULTITENANT.md (contêiner descartável), e só depois que o teste rodar.
-- Restaura as definições anteriores copiadas de 20260831211015 (funções) e 20260829134240 (políticas),
-- que coincidem com o estado atual do projeto remoto (inspeção da Fase 1).
-- Não é uma migration: não colocar em supabase/migrations. Se necessário, aplicar como NOVA migration forward.

-- 1. Triggers e funções de integridade
DROP TRIGGER IF EXISTS enforce_user_role_company ON public.user_roles;
DROP TRIGGER IF EXISTS enforce_user_unit_company ON public.user_units;
DROP FUNCTION IF EXISTS public.enforce_user_role_company();
DROP FUNCTION IF EXISTS public.enforce_user_unit_company();

-- 2. Políticas anteriores
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage ON public.user_roles FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.is_company_admin())
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.is_company_admin());

DROP POLICY IF EXISTS user_units_select ON public.user_units;
CREATE POLICY user_units_select ON public.user_units FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_auth.is_company_admin());

DROP POLICY IF EXISTS user_units_admin_manage ON public.user_units;
CREATE POLICY user_units_admin_manage ON public.user_units FOR ALL TO authenticated
  USING (app_auth.is_company_admin()) WITH CHECK (app_auth.is_company_admin());

-- 3. Funções legadas com a definição anterior (sem escopo de empresa)
CREATE OR REPLACE FUNCTION app_auth.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION app_auth.can_see_all_units()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr'));
$$;
CREATE OR REPLACE FUNCTION app_auth.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin'));
$$;
CREATE OR REPLACE FUNCTION app_auth.can_manage_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr'));
$$;
CREATE OR REPLACE FUNCTION app_auth.has_unit_access(_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _unit_id IS NULL OR app_auth.can_see_all_units() OR EXISTS (
    SELECT 1 FROM public.user_units uu WHERE uu.user_id = auth.uid() AND uu.unit_id = _unit_id
  );
$$;

-- 4. Funções novas (só depois de reverter tudo o que as usa)
DROP FUNCTION IF EXISTS app_auth.has_role_in(uuid, uuid, public.app_role);
DROP FUNCTION IF EXISTS app_auth.is_company_admin_in(uuid);
DROP FUNCTION IF EXISTS app_auth.can_manage_payroll_in(uuid);
DROP FUNCTION IF EXISTS app_auth.can_see_all_units_in(uuid);
DROP FUNCTION IF EXISTS app_auth.has_any_role_in(uuid, public.app_role[]);
DROP FUNCTION IF EXISTS app_auth.user_belongs_to_company(uuid, uuid);
DROP FUNCTION IF EXISTS app_auth.unit_in_company(uuid);

-- Observação: se a migration já tiver sido registrada em supabase_migrations.schema_migrations,
-- NÃO apagar o registro nem editar o arquivo: publicar este script como uma nova migration forward.
