-- Enforce the commercial limits at the database boundary. The client can show
-- the limits, but it cannot bypass them with a direct API request.
CREATE OR REPLACE FUNCTION public.plan_limit(_plan text, _resource text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'comeco'))
    WHEN 'equipe' THEN CASE _resource WHEN 'employees' THEN 25 WHEN 'units' THEN 2 WHEN 'admins' THEN 5 END
    WHEN 'essencial' THEN CASE _resource WHEN 'employees' THEN 10 WHEN 'units' THEN 1 WHEN 'admins' THEN 3 END
    ELSE CASE _resource WHEN 'employees' THEN 5 WHEN 'units' THEN 1 WHEN 'admins' THEN NULL END
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_employee_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.employment_status = 'desligado'
     OR (TG_OP = 'UPDATE' AND OLD.employment_status <> 'desligado' AND NEW.company_id = OLD.company_id) THEN
    RETURN NEW;
  END IF;

  SELECT public.plan_limit(plan_code, 'employees') INTO v_limit
  FROM public.companies WHERE id = NEW.company_id;
  SELECT count(*) INTO v_count FROM public.employees
  WHERE company_id = NEW.company_id AND employment_status <> 'desligado';

  IF v_limit IS NOT NULL AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Seu plano permite até % colaboradores ativos.', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_employee_plan_limit') THEN
    CREATE TRIGGER enforce_employee_plan_limit
    BEFORE INSERT OR UPDATE OF company_id, employment_status ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_plan_limit();
  END IF;
END $$;

-- Keeps the original trigger name while upgrading it to the limits for all plans.
CREATE OR REPLACE FUNCTION public.enforce_single_unit_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NOT NEW.active
     OR (TG_OP = 'UPDATE' AND OLD.active AND NEW.company_id = OLD.company_id) THEN
    RETURN NEW;
  END IF;

  SELECT public.plan_limit(plan_code, 'units') INTO v_limit
  FROM public.companies WHERE id = NEW.company_id;
  SELECT count(*) INTO v_count FROM public.units
  WHERE company_id = NEW.company_id AND active;

  IF v_limit IS NOT NULL AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Seu plano permite até % unidade(s) ativa(s).', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_single_unit_mode_units') THEN
    CREATE TRIGGER enforce_single_unit_mode_units
    BEFORE INSERT ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_unit_mode();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_unit_plan_limit_updates') THEN
    CREATE TRIGGER enforce_unit_plan_limit_updates
    BEFORE UPDATE OF company_id, active ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_unit_mode();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_admin_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.company_id IS NULL OR NEW.role NOT IN ('owner', 'admin')
     OR (TG_OP = 'UPDATE' AND OLD.role IN ('owner', 'admin') AND NEW.company_id = OLD.company_id) THEN
    RETURN NEW;
  END IF;

  SELECT public.plan_limit(plan_code, 'admins') INTO v_limit
  FROM public.companies WHERE id = NEW.company_id;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT count(DISTINCT user_id) INTO v_count FROM public.user_roles
  WHERE company_id = NEW.company_id AND role IN ('owner', 'admin');

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Seu plano permite até % usuários administrativos.', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_admin_plan_limit') THEN
    CREATE TRIGGER enforce_admin_plan_limit
    BEFORE INSERT OR UPDATE OF company_id, role ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_plan_limit();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.plan_limit(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.plan_limit(text, text) TO service_role;
