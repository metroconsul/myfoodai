-- 1. Private schema for access-control helpers (not exposed to the Data API)
CREATE SCHEMA IF NOT EXISTS app_auth;
GRANT USAGE ON SCHEMA app_auth TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_auth.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_auth.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION app_auth.can_see_all_units()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin','hr')
  );
$$;

CREATE OR REPLACE FUNCTION app_auth.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION app_auth.in_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _company_id IS NOT NULL AND _company_id = app_auth.current_company_id();
$$;

CREATE OR REPLACE FUNCTION app_auth.has_unit_access(_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _unit_id IS NULL OR app_auth.can_see_all_units() OR EXISTS (
    SELECT 1 FROM public.user_units uu WHERE uu.user_id = auth.uid() AND uu.unit_id = _unit_id
  );
$$;

-- payroll-sensitive access: owners, admins and HR only
CREATE OR REPLACE FUNCTION app_auth.can_manage_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin','hr')
  );
$$;

REVOKE ALL ON FUNCTION app_auth.current_company_id(), app_auth.has_role(uuid, public.app_role),
  app_auth.can_see_all_units(), app_auth.is_company_admin(), app_auth.in_company(uuid),
  app_auth.has_unit_access(uuid), app_auth.can_manage_payroll() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_auth.current_company_id(), app_auth.has_role(uuid, public.app_role),
  app_auth.can_see_all_units(), app_auth.is_company_admin(), app_auth.in_company(uuid),
  app_auth.has_unit_access(uuid), app_auth.can_manage_payroll() TO authenticated, service_role;

-- 2. Rewrite every public policy to reference the private helpers
DO $do$
DECLARE
  p record;
  q text;
  c text;
  stmt text;
  roles text;
BEGIN
  FOR p IN SELECT * FROM pg_policies WHERE schemaname = 'public' LOOP
    q := p.qual;
    c := p.with_check;
    FOREACH stmt IN ARRAY ARRAY['current_company_id','has_role','can_see_all_units','is_company_admin','in_company','has_unit_access'] LOOP
      q := regexp_replace(q, '(?<![a-z_.])(public\.)?' || stmt || '\(', 'app_auth.' || stmt || '(', 'g');
      c := regexp_replace(c, '(?<![a-z_.])(public\.)?' || stmt || '\(', 'app_auth.' || stmt || '(', 'g');
    END LOOP;

    roles := array_to_string(p.roles, ', ');
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    stmt := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      p.policyname, p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd, roles);
    IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
    IF c IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', c); END IF;
    EXECUTE stmt;
  END LOOP;
END
$do$;

DROP FUNCTION IF EXISTS public.current_company_id();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_see_all_units();
DROP FUNCTION IF EXISTS public.is_company_admin();
DROP FUNCTION IF EXISTS public.in_company(uuid);
DROP FUNCTION IF EXISTS public.has_unit_access(uuid);

-- 3. Payroll data restricted to owners/admins/HR
DROP POLICY IF EXISTS payslips_read_scope ON public.payslips;
CREATE POLICY payslips_read_scope ON public.payslips FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_manage_payroll());

DROP POLICY IF EXISTS payslip_versions_read ON public.payslip_versions;
CREATE POLICY payslip_versions_read ON public.payslip_versions FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_manage_payroll());

DROP POLICY IF EXISTS payslip_signatures_read ON public.payslip_signatures;
CREATE POLICY payslip_signatures_read ON public.payslip_signatures FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_manage_payroll());

DROP POLICY IF EXISTS payslip_disputes_read ON public.payslip_disputes;
CREATE POLICY payslip_disputes_read ON public.payslip_disputes FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_manage_payroll());

DROP POLICY IF EXISTS payslip_audit_read ON public.payslip_audit_events;
CREATE POLICY payslip_audit_read ON public.payslip_audit_events FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_manage_payroll());

DROP POLICY IF EXISTS point_card_evidence_read ON public.point_card_evidence;
CREATE POLICY point_card_evidence_read ON public.point_card_evidence FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.can_see_all_units());

-- 4. Storage: scope private buckets to the caller's company folder
DROP POLICY IF EXISTS app_files_select ON storage.objects;
DROP POLICY IF EXISTS app_files_insert ON storage.objects;
DROP POLICY IF EXISTS app_files_update ON storage.objects;
DROP POLICY IF EXISTS app_files_delete ON storage.objects;

CREATE POLICY app_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('item-photos','avatars','signatures','documents')
    AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
  );

CREATE POLICY app_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('item-photos','avatars','signatures','documents')
    AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
  );

CREATE POLICY app_files_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('item-photos','avatars','signatures','documents')
    AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
  )
  WITH CHECK (
    bucket_id IN ('item-photos','avatars','signatures','documents')
    AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
  );

CREATE POLICY app_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('item-photos','avatars','signatures','documents')
    AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
  );

-- 5. Remove self-service owner bootstrap (company + role are created atomically server-side)
DROP POLICY IF EXISTS user_roles_bootstrap_owner ON public.user_roles;