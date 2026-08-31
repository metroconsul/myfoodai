-- ============ Módulo de Holerites ============

CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NULL REFERENCES public.units(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payroll_period date NOT NULL,
  reference_label text NULL,
  status text NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 1,
  acceptance_policy text NOT NULL DEFAULT 'assinatura',
  due_at timestamptz NULL,
  published_at timestamptz NULL,
  viewed_at timestamptz NULL,
  signed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  archived_at timestamptz NULL,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date NULL,
  import_batch_id uuid NULL,
  validation_error text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payslips_company_period_idx ON public.payslips (company_id, payroll_period DESC);
CREATE INDEX payslips_employee_idx ON public.payslips (employee_id, payroll_period DESC);
CREATE UNIQUE INDEX payslips_unique_active_period
  ON public.payslips (employee_id, payroll_period)
  WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslips_read_scope" ON public.payslips FOR SELECT TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE POLICY "payslips_write_hr" ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')));
CREATE POLICY "payslips_update_hr" ON public.payslips FOR UPDATE TO authenticated
  USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')))
  WITH CHECK (public.in_company(company_id));
CREATE POLICY "payslips_delete_admin" ON public.payslips FOR DELETE TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin() AND status = 'draft');

CREATE TRIGGER set_updated_at_payslips BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- versões ----------
CREATE TABLE public.payslip_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_object_key text NOT NULL,
  original_file_name text NULL,
  file_sha256 text NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  correction_reason text NULL,
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payslip_id, version)
);

GRANT SELECT, INSERT, UPDATE ON public.payslip_versions TO authenticated;
GRANT ALL ON public.payslip_versions TO service_role;
ALTER TABLE public.payslip_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslip_versions_read" ON public.payslip_versions FOR SELECT TO authenticated
  USING (public.in_company(company_id));
CREATE POLICY "payslip_versions_write" ON public.payslip_versions FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')));
CREATE POLICY "payslip_versions_update" ON public.payslip_versions FOR UPDATE TO authenticated
  USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')))
  WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_payslip_versions BEFORE UPDATE ON public.payslip_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- divergências ----------
CREATE TABLE public.payslip_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  attachment_object_key text NULL,
  status text NOT NULL DEFAULT 'aberta',
  hr_response text NULL,
  resolved_by uuid NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payslip_disputes TO authenticated;
GRANT ALL ON public.payslip_disputes TO service_role;
ALTER TABLE public.payslip_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslip_disputes_read" ON public.payslip_disputes FOR SELECT TO authenticated
  USING (public.in_company(company_id));
CREATE POLICY "payslip_disputes_update" ON public.payslip_disputes FOR UPDATE TO authenticated
  USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')))
  WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_payslip_disputes BEFORE UPDATE ON public.payslip_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- assinaturas ----------
CREATE TABLE public.payslip_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  signature_method text NOT NULL,
  provider_name text NULL,
  provider_transaction_ref text NULL,
  signature_reference text NOT NULL,
  signature_object_key text NULL,
  term_version text NOT NULL,
  term_text text NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  integrity_hash text NOT NULL,
  file_sha256 text NULL,
  face_status text NULL DEFAULT 'not_required',
  liveness_status text NULL DEFAULT 'not_required',
  face_provider_ref text NULL,
  location_status text NULL DEFAULT 'nao_disponivel',
  latitude numeric(9,6) NULL,
  longitude numeric(9,6) NULL,
  accuracy_meters numeric(10,2) NULL,
  location_captured_at timestamptz NULL,
  geo_address text NULL,
  geo_distance_meters integer NULL,
  ip_hash text NULL,
  ip_masked text NULL,
  device_metadata jsonb NULL,
  consent jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payslip_id, version)
);

GRANT SELECT ON public.payslip_signatures TO authenticated;
GRANT ALL ON public.payslip_signatures TO service_role;
ALTER TABLE public.payslip_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslip_signatures_read" ON public.payslip_signatures FOR SELECT TO authenticated
  USING (public.in_company(company_id));

-- ---------- auditoria ----------
CREATE TABLE public.payslip_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NULL REFERENCES public.units(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  subject_type text NOT NULL DEFAULT 'payslip',
  subject_id uuid NOT NULL,
  subject_version integer NULL,
  event_type text NOT NULL,
  event_result text NOT NULL DEFAULT 'success',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NULL,
  session_id_hash text NULL,
  ip_hash text NULL,
  user_agent_hash text NULL,
  permission_snapshot jsonb NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_event_hash text NULL,
  event_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payslip_audit_subject_idx ON public.payslip_audit_events (subject_id, occurred_at DESC);
CREATE INDEX payslip_audit_company_idx ON public.payslip_audit_events (company_id, occurred_at DESC);

GRANT SELECT ON public.payslip_audit_events TO authenticated;
GRANT ALL ON public.payslip_audit_events TO service_role;
ALTER TABLE public.payslip_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslip_audit_read" ON public.payslip_audit_events FOR SELECT TO authenticated
  USING (public.in_company(company_id));

-- ---------- políticas por empresa ----------
CREATE TABLE public.payslip_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  require_face_validation boolean NOT NULL DEFAULT false,
  require_location boolean NOT NULL DEFAULT false,
  allow_location_fallback boolean NOT NULL DEFAULT true,
  face_provider_name text NULL,
  term_version text NOT NULL DEFAULT 'termo-holerite-v1',
  term_text text NULL,
  retention_months integer NOT NULL DEFAULT 60,
  retention_start_event text NOT NULL DEFAULT 'publicacao',
  legal_hold_default boolean NOT NULL DEFAULT false,
  salary_visible_roles text[] NOT NULL DEFAULT ARRAY['owner','admin','hr']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payslip_settings TO authenticated;
GRANT ALL ON public.payslip_settings TO service_role;
ALTER TABLE public.payslip_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payslip_settings_read" ON public.payslip_settings FOR SELECT TO authenticated
  USING (public.in_company(company_id));
CREATE POLICY "payslip_settings_write" ON public.payslip_settings FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());
CREATE POLICY "payslip_settings_update" ON public.payslip_settings FOR UPDATE TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_payslip_settings BEFORE UPDATE ON public.payslip_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();