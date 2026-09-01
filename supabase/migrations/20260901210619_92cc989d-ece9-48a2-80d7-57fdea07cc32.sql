-- 1. Campos de plano nas empresas
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'comeco',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS pilot_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_unit_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_schedule_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grant_reason text,
  ADD COLUMN IF NOT EXISTS granted_by uuid;

-- 2. Assinaturas por empresa
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

UPDATE public.subscriptions s
SET company_id = p.company_id
FROM public.profiles p
WHERE p.id = s.user_id AND s.company_id IS NULL;

-- 3. Administradores da plataforma (dono do produto)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_self_read" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. Recursos liberados por empresa
CREATE TABLE IF NOT EXISTS public.feature_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'plan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, feature_code)
);
GRANT SELECT ON public.feature_entitlements TO authenticated;
GRANT ALL ON public.feature_entitlements TO service_role;
ALTER TABLE public.feature_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_entitlements_read_own_company" ON public.feature_entitlements
  FOR SELECT TO authenticated USING (company_id = app_auth.current_company_id());
CREATE TRIGGER set_updated_at_feature_entitlements BEFORE UPDATE ON public.feature_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Funções auxiliares
CREATE OR REPLACE FUNCTION app_auth.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION app_auth.company_plan(_company_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT plan_code FROM public.companies WHERE id = _company_id
$$;

CREATE OR REPLACE FUNCTION app_auth.has_feature(_company_id uuid, _feature_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.feature_entitlements fe
        WHERE fe.company_id = _company_id
          AND fe.feature_code = _feature_code
          AND fe.enabled
      )
$$;

REVOKE ALL ON FUNCTION app_auth.is_platform_admin(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION app_auth.company_plan(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION app_auth.has_feature(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION app_auth.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_auth.company_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_auth.has_feature(uuid, text) TO authenticated, service_role;

-- 6. Jornada fixa
CREATE TABLE IF NOT EXISTS public.fixed_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Jornada fixa',
  weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_work_schedules TO authenticated;
GRANT ALL ON public.fixed_work_schedules TO service_role;
ALTER TABLE public.fixed_work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixed_schedules_read_company" ON public.fixed_work_schedules
  FOR SELECT TO authenticated USING (company_id = app_auth.current_company_id());
CREATE POLICY "fixed_schedules_write_admin" ON public.fixed_work_schedules
  FOR ALL TO authenticated
  USING (company_id = app_auth.current_company_id() AND app_auth.is_company_admin())
  WITH CHECK (company_id = app_auth.current_company_id() AND app_auth.is_company_admin());
CREATE TRIGGER set_updated_at_fixed_work_schedules BEFORE UPDATE ON public.fixed_work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Modo unidade única
CREATE OR REPLACE FUNCTION public.enforce_single_unit_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_single boolean;
  v_count integer;
BEGIN
  SELECT single_unit_mode INTO v_single FROM public.companies WHERE id = NEW.company_id;
  IF COALESCE(v_single, false) THEN
    SELECT count(*) INTO v_count FROM public.units WHERE company_id = NEW.company_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Este plano permite apenas uma unidade.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_single_unit_mode_units ON public.units;
CREATE TRIGGER enforce_single_unit_mode_units BEFORE INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_unit_mode();

-- 8. Conta dona do produto mantém acesso completo
INSERT INTO public.platform_admins (user_id, note)
SELECT ur.user_id, 'Conta dona do produto (migração inicial)'
FROM public.user_roles ur
WHERE ur.role = 'owner'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.companies
SET plan_code = 'equipe', subscription_status = 'admin_grant',
    grant_reason = 'Conta dona do produto'
WHERE id IN (SELECT DISTINCT company_id FROM public.user_roles WHERE role = 'owner');

INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source)
SELECT c.id, f.code, true, 'admin_grant'
FROM public.companies c
CROSS JOIN (VALUES
  ('dashboard'),('employees'),('roles_teams'),('units'),('schedules_advanced'),
  ('shifts'),('schedule_templates'),('schedule_compliance'),('schedule_history'),
  ('time_entries'),('point_cards'),('items'),('deliveries'),('delivery_rules'),
  ('compliance'),('payslips'),('inventory'),('sales'),('settings'),('multi_unit')
) AS f(code)
WHERE c.id IN (SELECT DISTINCT company_id FROM public.user_roles WHERE role = 'owner')
ON CONFLICT (company_id, feature_code) DO NOTHING;