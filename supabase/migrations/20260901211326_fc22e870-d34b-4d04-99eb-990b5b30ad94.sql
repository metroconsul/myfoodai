-- Matriz de recursos por plano, espelhando src/config/features.ts
CREATE OR REPLACE FUNCTION public.plan_feature_codes(_plan text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'comeco'))
    WHEN 'equipe' THEN ARRAY[
      'dashboard','employees','roles_teams','units','fixed_schedule','time_entries','point_cards',
      'items','deliveries','compliance','payslips','settings','billing',
      'schedules_advanced','shifts','schedule_templates','schedule_compliance','schedule_history',
      'delivery_rules','inventory','multi_unit','sales']
    WHEN 'essencial' THEN ARRAY[
      'dashboard','employees','roles_teams','units','fixed_schedule','time_entries','point_cards',
      'items','deliveries','compliance','payslips','settings','billing',
      'schedules_advanced','shifts','schedule_templates','schedule_compliance','schedule_history',
      'delivery_rules','inventory']
    ELSE ARRAY[
      'dashboard','employees','roles_teams','units','fixed_schedule','time_entries','point_cards',
      'items','deliveries','compliance','payslips','settings','billing']
  END;
$$;

-- Aplica os recursos do plano na empresa (idempotente).
CREATE OR REPLACE FUNCTION public.apply_plan_entitlements(_company_id uuid, _plan text, _source text DEFAULT 'plan')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  codes text[] := public.plan_feature_codes(_plan);
BEGIN
  INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source)
  SELECT _company_id, code, true, _source
  FROM unnest(codes) AS code
  ON CONFLICT (company_id, feature_code)
  DO UPDATE SET enabled = true, source = _source, updated_at = now();

  UPDATE public.feature_entitlements
  SET enabled = false, updated_at = now()
  WHERE company_id = _company_id
    AND NOT (feature_code = ANY (codes))
    AND source <> 'admin_grant';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_plan_entitlements(uuid, text, text) FROM anon, authenticated;

-- Mantém os recursos sincronizados quando o plano da empresa muda.
CREATE OR REPLACE FUNCTION public.sync_company_plan_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.plan_code IS DISTINCT FROM OLD.plan_code THEN
    PERFORM public.apply_plan_entitlements(NEW.id, NEW.plan_code, 'plan');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_plan_entitlements ON public.companies;
CREATE TRIGGER sync_plan_entitlements
AFTER INSERT OR UPDATE OF plan_code ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_company_plan_entitlements();

-- Origem do acesso: assinatura paga, trial ou concessão administrativa.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS access_source text NOT NULL DEFAULT 'trial';

-- Reaplica os recursos para as empresas já existentes.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id, plan_code FROM public.companies LOOP
    PERFORM public.apply_plan_entitlements(c.id, c.plan_code, 'plan');
  END LOOP;
END $$;