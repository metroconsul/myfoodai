-- A migração inicial marcou empresas proprietárias como admin_grant apenas no
-- status. Alinhe a fonte de acesso para que o guard reconheça a concessão.
UPDATE public.companies
SET access_source = 'admin_grant'
WHERE subscription_status = 'admin_grant'
  AND access_source IS DISTINCT FROM 'admin_grant';
