-- MyFoods Caixa & Financeiro: contas disponíveis para sangria/suprimento. Aditivo.
-- O operador de caixa precisa escolher a conta de destino (ex.: Cofre) sem ver saldos nem saldo inicial:
-- a função devolve só id, nome e tipo das contas ativas da empresa atual.
CREATE OR REPLACE FUNCTION public.cf_transfer_accounts()
RETURNS TABLE (id uuid, name text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT a.id, a.name, a.kind
  FROM public.fin_accounts a
  WHERE a.company_id = app_auth.current_company_id()
    AND a.active
    AND app_auth.cf_enabled(a.company_id)
    AND (app_auth.can_operate_cash() OR app_auth.can_manage_finance())
  ORDER BY a.kind, a.name;
$$;
REVOKE ALL ON FUNCTION public.cf_transfer_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cf_transfer_accounts() TO authenticated, service_role;
