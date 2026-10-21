-- Stripe is the source of truth for paid access. Keep its identifiers and lifecycle fields.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_checkout_session_id_key
  ON public.subscriptions (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app_auth.has_valid_access(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = _company_id AND (
        (c.access_source = 'subscription' AND c.subscription_status IN ('active', 'trialing'))
        OR (c.access_source = 'trial' AND c.subscription_status = 'trialing' AND c.trial_ends_at > now())
        OR (c.access_source = 'admin_grant' AND c.subscription_status = 'admin_grant')
      )
    );
$$;

CREATE OR REPLACE FUNCTION app_auth.in_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT _company_id IS NOT NULL
    AND _company_id = app_auth.current_company_id()
    AND app_auth.has_valid_access(_company_id);
$$;

CREATE OR REPLACE FUNCTION app_auth.has_feature(_company_id uuid, _feature_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.is_platform_admin()
    OR (app_auth.has_valid_access(_company_id) AND EXISTS (
      SELECT 1 FROM public.feature_entitlements fe
      WHERE fe.company_id = _company_id AND fe.feature_code = _feature_code AND fe.enabled
    ));
$$;

REVOKE ALL ON FUNCTION app_auth.has_valid_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_auth.has_valid_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_client_billing_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    NEW.plan_code IS DISTINCT FROM OLD.plan_code
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

DROP TRIGGER IF EXISTS prevent_client_billing_update ON public.companies;
CREATE TRIGGER prevent_client_billing_update
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_client_billing_update();
