CREATE TABLE public.acceptance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  deadline_days integer NOT NULL DEFAULT 5,
  signature_method text NOT NULL DEFAULT 'assinatura_facial',
  require_face boolean NOT NULL DEFAULT true,
  require_location boolean NOT NULL DEFAULT true,
  allow_typed_signature boolean NOT NULL DEFAULT true,
  geofence_enabled boolean NOT NULL DEFAULT false,
  geofence_radius_meters integer NOT NULL DEFAULT 200,
  geofence_block_outside boolean NOT NULL DEFAULT false,
  face_provider text NOT NULL DEFAULT 'lovable_ai',
  face_provider_endpoint text,
  geocoding_provider text NOT NULL DEFAULT 'nominatim',
  geocoding_endpoint text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acceptance_policies_method_check CHECK (signature_method IN ('visualizar','ciencia','assinatura','assinatura_facial')),
  CONSTRAINT acceptance_policies_face_provider_check CHECK (face_provider IN ('lovable_ai','selfie_evidence','externo')),
  CONSTRAINT acceptance_policies_geocoding_provider_check CHECK (geocoding_provider IN ('nominatim','custom','desativado')),
  CONSTRAINT acceptance_policies_deadline_check CHECK (deadline_days BETWEEN 1 AND 90),
  CONSTRAINT acceptance_policies_radius_check CHECK (geofence_radius_meters BETWEEN 20 AND 20000)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acceptance_policies TO authenticated;
GRANT ALL ON public.acceptance_policies TO service_role;
ALTER TABLE public.acceptance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceptance_policies_select" ON public.acceptance_policies
  FOR SELECT TO authenticated USING (public.in_company(company_id));
CREATE POLICY "acceptance_policies_admin_write" ON public.acceptance_policies
  FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());

CREATE TRIGGER set_updated_at_acceptance_policies BEFORE UPDATE ON public.acceptance_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.privacy_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  controller_name text,
  dpo_name text,
  dpo_email text,
  purposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_bases jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_months integer NOT NULL DEFAULT 60,
  retention_notes text,
  privacy_url text,
  consent_version text NOT NULL DEFAULT 'lgpd-v1',
  data_text text,
  biometrics_text text,
  location_text text,
  notice_text text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_policies_retention_check CHECK (retention_months BETWEEN 1 AND 600)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_policies TO authenticated;
GRANT ALL ON public.privacy_policies TO service_role;
ALTER TABLE public.privacy_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_policies_select" ON public.privacy_policies
  FOR SELECT TO authenticated USING (public.in_company(company_id));
CREATE POLICY "privacy_policies_admin_write" ON public.privacy_policies
  FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());

CREATE TRIGGER set_updated_at_privacy_policies BEFORE UPDATE ON public.privacy_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();