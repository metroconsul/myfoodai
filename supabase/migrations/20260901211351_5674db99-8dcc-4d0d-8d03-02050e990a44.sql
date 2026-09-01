REVOKE ALL ON FUNCTION public.apply_plan_entitlements(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_company_plan_entitlements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_feature_codes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_plan_entitlements(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_feature_codes(text) TO service_role;