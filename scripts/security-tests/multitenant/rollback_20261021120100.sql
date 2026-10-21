-- ROLLBACK de 20261021120100_least_privilege_grants.sql. Restaura os grants descritos em docs/FASE1_GRANTS_ANTES.md.
-- Não é migration. Se a migration já estiver registrada em produção, publicar este script como NOVA migration forward.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
             AND c.relname NOT IN ('automation_events','employee_devices','notification_deliveries','portal_login_rate_limits')
  LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon', t.relname);
    EXECUTE format('GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.%I TO authenticated', t.relname);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;

GRANT ALL ON public.subscriptions TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.user_units TO authenticated;

REVOKE UPDATE (name, document, timezone, brand_name, brand_logo_url, primary_color, accent_color,
               fixed_schedule_mode, single_unit_mode) ON public.companies FROM authenticated;
GRANT UPDATE, DELETE ON public.companies TO authenticated;

REVOKE INSERT (id, company_id, unit_id, full_name, cpf, phone, whatsapp_phone, email, employee_code,
               role_id, team_id, work_regime_id, employment_status, hire_date, avatar_url, created_at, updated_at)
  ON public.employees FROM authenticated;
REVOKE UPDATE (unit_id, full_name, cpf, phone, whatsapp_phone, email, employee_code,
               role_id, team_id, work_regime_id, employment_status, hire_date, avatar_url, updated_at)
  ON public.employees FROM authenticated;
GRANT INSERT, UPDATE ON public.employees TO authenticated;
