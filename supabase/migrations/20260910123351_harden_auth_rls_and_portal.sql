-- Security hardening for tenant ownership, role-based writes, portal login and punches.

-- Tenant and billing ownership are server-managed. Authenticated clients may update
-- only harmless profile fields; company creation goes through bootstrapCompany.
REVOKE INSERT ON public.companies FROM authenticated;
DROP POLICY IF EXISTS companies_insert_authenticated ON public.companies;
REVOKE INSERT, DELETE, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, email, avatar_url, active_unit_id) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_tenant_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Profile company is managed by the server.';
    END IF;
    IF NEW.active_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.active_unit_id AND u.company_id = OLD.company_id
    ) THEN
      RAISE EXCEPTION 'Active unit must belong to the profile company.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_tenant_fields ON public.profiles;
CREATE TRIGGER protect_profile_tenant_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tenant_fields();

CREATE OR REPLACE FUNCTION public.prevent_client_billing_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    TG_OP = 'INSERT'
    OR NEW.plan_code IS DISTINCT FROM OLD.plan_code
    OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
    OR NEW.access_source IS DISTINCT FROM OLD.access_source
    OR NEW.trial_starts_at IS DISTINCT FROM OLD.trial_starts_at
    OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.pilot_account IS DISTINCT FROM OLD.pilot_account
    OR NEW.grant_reason IS DISTINCT FROM OLD.grant_reason
    OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
  ) THEN
    RAISE EXCEPTION 'Billing fields are managed by the server.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_billing_insert ON public.companies;
CREATE TRIGGER prevent_client_billing_insert
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_client_billing_update();

REVOKE ALL ON FUNCTION public.prevent_client_billing_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_tenant_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_client_billing_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_tenant_fields() TO service_role;

-- Central role predicate for RLS write policies.
CREATE OR REPLACE FUNCTION app_auth.has_any_role(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = app_auth.current_company_id()
      AND ur.role = ANY (_roles)
  );
$$;
REVOKE ALL ON FUNCTION app_auth.has_any_role(public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.has_any_role(public.app_role[]) TO authenticated, service_role;

-- Replace broad company write policies with read + role-authorized writes.
DO $$
DECLARE
  t text;
  write_roles public.app_role[];
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'work_regimes','suppliers','catalog_items','sales_connections','sales_import_jobs',
    'sales_order_items','notifications','schedule_changes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_company_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_company_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_company_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_auth.in_company(company_id))', t || '_company_select', t);

    write_roles := CASE
      WHEN t IN ('suppliers','catalog_items') THEN ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]
      WHEN t IN ('sales_connections','sales_import_jobs','sales_order_items') THEN ARRAY['owner','admin','unit_manager']::public.app_role[]
      WHEN t IN ('work_regimes') THEN ARRAY['owner','admin','hr']::public.app_role[]
      ELSE ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]
    END;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (app_auth.in_company(company_id) AND app_auth.has_any_role(%L::public.app_role[])) WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_any_role(%L::public.app_role[]))',
      t || '_company_write', t, write_roles::text, write_roles::text
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS sales_orders_write ON public.sales_orders;
CREATE POLICY sales_orders_write ON public.sales_orders FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_feature(company_id, 'sales')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_feature(company_id, 'sales')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager']::public.app_role[]));

-- Replace broad unit policies. Reads retain unit scope; writes require an appropriate role.
DO $$
DECLARE
  t text;
  write_roles public.app_role[];
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles','teams','employees','point_policies','time_entries','time_entry_reviews','point_cards',
    'stock_movements','inventory_counts','stock_alerts','employee_item_deliveries','sales_daily_metrics'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_unit_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_unit_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_unit_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id))', t || '_unit_select', t);

    write_roles := CASE
      WHEN t IN ('stock_movements','inventory_counts','stock_alerts','sales_daily_metrics')
        THEN ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]
      WHEN t IN ('employees','roles','teams','employee_item_deliveries')
        THEN ARRAY['owner','admin','unit_manager','hr']::public.app_role[]
      WHEN t = 'point_policies' THEN ARRAY['owner','admin','unit_manager']::public.app_role[]
      ELSE ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]
    END;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_any_role(%L::public.app_role[])) WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_any_role(%L::public.app_role[]))',
      t || '_unit_write', t, write_roles::text, write_roles::text
    );
  END LOOP;
END $$;

-- Add role checks to feature-specific write policies created by earlier migrations.
DROP POLICY IF EXISTS schedules_write ON public.schedules;
CREATE POLICY schedules_write ON public.schedules FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'schedules_advanced')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'schedules_advanced')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]));

DROP POLICY IF EXISTS shifts_write ON public.shifts;
CREATE POLICY shifts_write ON public.shifts FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'shifts')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'shifts')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]));

DROP POLICY IF EXISTS schedule_templates_write ON public.schedule_templates;
CREATE POLICY schedule_templates_write ON public.schedule_templates FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'schedule_templates')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'schedule_templates')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]));

DROP POLICY IF EXISTS inventory_items_write ON public.inventory_items;
CREATE POLICY inventory_items_write ON public.inventory_items FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'inventory')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_feature(company_id, 'inventory')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]));

-- Atomic portal login throttling. Only the service role can invoke these routines.
CREATE TABLE IF NOT EXISTS public.portal_login_rate_limits (
  bucket_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.portal_login_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.portal_consume_login_rate_limit(
  _bucket_hash text,
  _max_attempts integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_attempts integer;
BEGIN
  INSERT INTO public.portal_login_rate_limits AS limits
    (bucket_hash, window_started_at, attempts, updated_at)
  VALUES (_bucket_hash, now(), 1, now())
  ON CONFLICT (bucket_hash) DO UPDATE SET
    attempts = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds) THEN 1
      ELSE limits.attempts + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds) THEN now()
      ELSE limits.window_started_at
    END,
    updated_at = now()
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts <= _max_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_reserve_login_attempt(_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_allowed boolean := false;
BEGIN
  UPDATE public.employees e SET
    portal_failed_attempts = CASE
      WHEN e.portal_locked_until IS NOT NULL AND e.portal_locked_until <= now() THEN 1
      ELSE e.portal_failed_attempts + 1
    END,
    portal_locked_until = CASE
      WHEN (CASE WHEN e.portal_locked_until IS NOT NULL AND e.portal_locked_until <= now()
                 THEN 1 ELSE e.portal_failed_attempts + 1 END) >= 5
        THEN now() + interval '10 minutes'
      ELSE NULL
    END
  WHERE e.id = _employee_id
    AND (e.portal_locked_until IS NULL OR e.portal_locked_until <= now())
    AND (e.portal_locked_until IS NOT NULL OR e.portal_failed_attempts < 5)
  RETURNING true INTO v_allowed;
  RETURN coalesce(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_consume_login_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_reserve_login_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_consume_login_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_reserve_login_attempt(uuid) TO service_role;

-- Portal punches carry a client request id. The trigger serializes concurrent
-- requests per employee and enforces the valid daily state transitions.
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_employee_idempotency_key
  ON public.time_entries(employee_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_portal_punch_sequence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_last_type public.time_entry_type;
  v_last_time timestamptz;
  v_timezone text;
BEGIN
  IF NEW.idempotency_key IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.employee_id::text, 0));

  SELECT coalesce(c.timezone, 'America/Sao_Paulo') INTO v_timezone
  FROM public.companies c WHERE c.id = NEW.company_id;
  SELECT te.entry_type, te.server_time INTO v_last_type, v_last_time
  FROM public.time_entries te
  WHERE te.employee_id = NEW.employee_id
  ORDER BY te.server_time DESC, te.created_at DESC
  LIMIT 1;

  IF v_last_time IS NULL OR (v_last_time AT TIME ZONE v_timezone)::date < (NEW.server_time AT TIME ZONE v_timezone)::date THEN
    IF NEW.entry_type <> 'entrada' THEN
      RAISE EXCEPTION 'O primeiro ponto do dia deve ser uma entrada.';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (v_last_type = 'entrada' AND NEW.entry_type IN ('intervalo_saida','saida'))
    OR (v_last_type = 'intervalo_saida' AND NEW.entry_type = 'intervalo_retorno')
    OR (v_last_type = 'intervalo_retorno' AND NEW.entry_type IN ('intervalo_saida','saida'))
    OR (v_last_type = 'saida' AND NEW.entry_type = 'entrada')
  ) THEN
    RAISE EXCEPTION 'Sequência de ponto inválida para o último registro.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_portal_punch_sequence ON public.time_entries;
CREATE TRIGGER validate_portal_punch_sequence
BEFORE INSERT ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_portal_punch_sequence();

REVOKE ALL ON FUNCTION public.validate_portal_punch_sequence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_portal_punch_sequence() TO service_role;

-- Trigger/event-trigger functions are never public RPCs.
REVOKE ALL ON FUNCTION public.enforce_admin_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_employee_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_admin_plan_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_employee_plan_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
