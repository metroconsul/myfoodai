-- Menor privilégio nos grants de public (Fase 1.3). Só REVOKE/GRANT: não altera dados, políticas nem funções.
-- Verificado no código: o navegador (papel authenticated) só LÊ subscriptions, user_roles e user_units;
-- PIN, cobrança e papéis são gravados por funções de servidor (service_role). RLS continua sendo a regra;
-- isto só remove privilégios que a aplicação nunca usa.
-- Estado anterior dos grants: docs/FASE1_GRANTS_ANTES.md (usado pelo rollback).

-- 1. anon não usa nenhuma tabela de public (login/landing passam por Auth e funções de servidor).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 2. authenticated: privilégios de tabela que ignoram RLS ou nunca são usados pela API.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM authenticated;

-- 3. Cobrança e papéis: somente leitura para o cliente.
REVOKE ALL ON public.subscriptions FROM authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
REVOKE ALL ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
REVOKE ALL ON public.user_units FROM authenticated;
GRANT SELECT ON public.user_units TO authenticated;

-- 4. companies: sem DELETE; UPDATE só em marca/fuso/modo. Plano, status, cobrança e is_demo são do servidor.
REVOKE DELETE, UPDATE ON public.companies FROM authenticated;
GRANT UPDATE (name, document, timezone, brand_name, brand_logo_url, primary_color, accent_color,
              fixed_schedule_mode, single_unit_mode) ON public.companies TO authenticated;

-- 5. employees: PIN do Portal e contadores de bloqueio nunca são gravados pelo cliente.
REVOKE INSERT, UPDATE ON public.employees FROM authenticated;
GRANT INSERT (id, company_id, unit_id, full_name, cpf, phone, whatsapp_phone, email, employee_code,
              role_id, team_id, work_regime_id, employment_status, hire_date, avatar_url, created_at, updated_at)
  ON public.employees TO authenticated;
GRANT UPDATE (unit_id, full_name, cpf, phone, whatsapp_phone, email, employee_code,
              role_id, team_id, work_regime_id, employment_status, hire_date, avatar_url, updated_at)
  ON public.employees TO authenticated;
