-- =========================================================
-- Timesheet periods
-- =========================================================
CREATE TABLE public.timesheet_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  deadline_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_by uuid,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheet_periods TO authenticated;
GRANT ALL ON public.timesheet_periods TO service_role;
ALTER TABLE public.timesheet_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_periods_company" ON public.timesheet_periods
  FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(unit_id))
  WITH CHECK (public.in_company(company_id) AND public.has_unit_access(unit_id));

CREATE TRIGGER set_updated_at_timesheet_periods BEFORE UPDATE ON public.timesheet_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_timesheet_periods_unit ON public.timesheet_periods(unit_id, period_start DESC);

-- =========================================================
-- point_cards extensions (existing table = TimesheetCard)
-- =========================================================
ALTER TABLE public.point_cards
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.timesheet_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_point_cards_period ON public.point_cards(period_id);
CREATE INDEX IF NOT EXISTS idx_point_cards_employee ON public.point_cards(employee_id, period_start DESC);

-- =========================================================
-- Timesheet entries (daily rows)
-- =========================================================
CREATE TABLE public.timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.point_cards(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  clock_in timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  clock_out timestamptz,
  planned_minutes integer NOT NULL DEFAULT 0,
  worked_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  delay_minutes integer NOT NULL DEFAULT 0,
  absence_status text,
  alerts text[] NOT NULL DEFAULT '{}',
  justification text,
  notes text,
  source text NOT NULL DEFAULT 'registros',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, work_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheet_entries TO authenticated;
GRANT ALL ON public.timesheet_entries TO service_role;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_entries_company" ON public.timesheet_entries
  FOR ALL TO authenticated
  USING (public.in_company(company_id))
  WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_timesheet_entries BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_timesheet_entries_card ON public.timesheet_entries(card_id, work_date);

-- =========================================================
-- Disputes
-- =========================================================
CREATE TABLE public.timesheet_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.point_cards(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  card_version integer NOT NULL DEFAULT 1,
  work_date date,
  category text NOT NULL DEFAULT 'outro',
  description text NOT NULL,
  attachment_path text,
  status text NOT NULL DEFAULT 'aberta',
  manager_response text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.timesheet_disputes TO authenticated;
GRANT ALL ON public.timesheet_disputes TO service_role;
ALTER TABLE public.timesheet_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_disputes_read" ON public.timesheet_disputes
  FOR SELECT TO authenticated USING (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE POLICY "timesheet_disputes_write" ON public.timesheet_disputes
  FOR INSERT TO authenticated WITH CHECK (public.in_company(company_id));
CREATE POLICY "timesheet_disputes_update" ON public.timesheet_disputes
  FOR UPDATE TO authenticated USING (public.in_company(company_id)) WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_timesheet_disputes BEFORE UPDATE ON public.timesheet_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_timesheet_disputes_card ON public.timesheet_disputes(card_id);

-- =========================================================
-- Signature evidence (immutable)
-- =========================================================
CREATE TABLE public.point_card_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.point_cards(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  card_version integer NOT NULL DEFAULT 1,
  signature_path text,
  signature_typed_name text,
  face_status text NOT NULL DEFAULT 'nao_aplicavel',
  face_provider text,
  face_provider_reference text,
  liveness_status text,
  face_validated_at timestamptz,
  location_status text NOT NULL DEFAULT 'indisponivel',
  latitude numeric,
  longitude numeric,
  accuracy_meters numeric,
  location_captured_at timestamptz,
  ip_masked text,
  device_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  terms_version text,
  consent_version text,
  integrity_hash text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, card_version)
);

GRANT SELECT ON public.point_card_evidence TO authenticated;
GRANT ALL ON public.point_card_evidence TO service_role;
ALTER TABLE public.point_card_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "point_card_evidence_read" ON public.point_card_evidence
  FOR SELECT TO authenticated USING (public.in_company(company_id));

CREATE INDEX idx_point_card_evidence_card ON public.point_card_evidence(card_id);

-- =========================================================
-- Batch publications
-- =========================================================
CREATE TABLE public.timesheet_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  period_id uuid REFERENCES public.timesheet_periods(id) ON DELETE SET NULL,
  created_by uuid,
  status text NOT NULL DEFAULT 'rascunho',
  total_cards integer NOT NULL DEFAULT 0,
  published_cards integer NOT NULL DEFAULT 0,
  failed_cards integer NOT NULL DEFAULT 0,
  skipped_cards integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.timesheet_batches TO authenticated;
GRANT ALL ON public.timesheet_batches TO service_role;
ALTER TABLE public.timesheet_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_batches_company" ON public.timesheet_batches
  FOR ALL TO authenticated
  USING (public.in_company(company_id))
  WITH CHECK (public.in_company(company_id));

CREATE TRIGGER set_updated_at_timesheet_batches BEFORE UPDATE ON public.timesheet_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Audit events (append-only)
-- =========================================================
CREATE TABLE public.point_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.point_cards(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.timesheet_periods(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.timesheet_batches(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'gestor',
  actor_id uuid,
  actor_label text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.point_card_events TO authenticated;
GRANT ALL ON public.point_card_events TO service_role;
ALTER TABLE public.point_card_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "point_card_events_read" ON public.point_card_events
  FOR SELECT TO authenticated USING (public.in_company(company_id));

CREATE INDEX idx_point_card_events_card ON public.point_card_events(card_id, created_at DESC);
