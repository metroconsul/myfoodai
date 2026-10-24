-- Fundação dos aplicativos (F1): acesso por aplicativo em feature_entitlements.
-- Códigos de aplicativo: app_ponto, app_documentos, app_estoque, app_compras, app_caixa_financeiro.
-- Os códigos granulares existentes (time_entries, inventory, payslips...) continuam valendo dentro de cada app.
-- Aditivo: nenhuma tabela nova; nova versão de apply_plan_entitlements e backfill idempotente.

-- 1. Aplicativos padrão de cada plano (mesma lógica dos recursos que cada plano já libera hoje):
--    todos os planos usam Ponto e Documentos; Estoque vem com Essencial e Equipe (recurso "inventory").
CREATE OR REPLACE FUNCTION public.plan_app_codes(_plan text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'comeco'))
    WHEN 'essencial' THEN ARRAY['app_ponto', 'app_documentos', 'app_estoque']
    WHEN 'equipe' THEN ARRAY['app_ponto', 'app_documentos', 'app_estoque']
    ELSE ARRAY['app_ponto', 'app_documentos']
  END;
$$;
REVOKE ALL ON FUNCTION public.plan_app_codes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_app_codes(text) TO service_role;

-- 2. Troca de plano não pode desligar aplicativos contratados.
--    Antes: todo código fora do plano era desligado (exceto source = 'admin_grant').
--    Agora: códigos app_% nunca são desligados aqui; os aplicativos padrão do plano são
--    acrescentados se ainda não existirem (um app desligado de propósito continua desligado).
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
    AND source <> 'admin_grant'
    AND feature_code NOT LIKE 'app\_%';

  INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source)
  SELECT _company_id, code, true, 'app_contract'
  FROM unnest(public.plan_app_codes(_plan)) AS code
  ON CONFLICT (company_id, feature_code) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_plan_entitlements(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_plan_entitlements(uuid, text, text) TO service_role;

-- 3. Backfill: nenhuma empresa perde acesso ao que usa hoje.
--    Ponto e Documentos para todas; Estoque para quem o plano inclui ou já tem "inventory" ligado.
INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source)
SELECT c.id, code, true, 'app_contract'
FROM public.companies c
CROSS JOIN LATERAL unnest(public.plan_app_codes(c.plan_code)) AS code
ON CONFLICT (company_id, feature_code) DO NOTHING;

INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source)
SELECT fe.company_id, 'app_estoque', true, 'app_contract'
FROM public.feature_entitlements fe
WHERE fe.feature_code = 'inventory' AND fe.enabled
ON CONFLICT (company_id, feature_code) DO NOTHING;
