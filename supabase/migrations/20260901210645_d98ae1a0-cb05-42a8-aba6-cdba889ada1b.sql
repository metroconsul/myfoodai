REVOKE ALL ON FUNCTION public.enforce_single_unit_mode() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_single_unit_mode() TO service_role;