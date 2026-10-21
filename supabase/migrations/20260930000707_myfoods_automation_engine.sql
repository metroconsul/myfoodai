-- MyFoods automation inbox. Supabase remains the source of truth and n8n only
-- orchestrates authenticated, idempotent requests through the application API.
CREATE TABLE public.automation_events (
  event_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'processed', 'failed')),
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automation_events_company_created_idx
  ON public.automation_events (company_id, created_at DESC);
CREATE INDEX automation_events_status_created_idx
  ON public.automation_events (status, created_at);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_events FROM anon, authenticated;
GRANT ALL ON public.automation_events TO service_role;

CREATE TRIGGER set_updated_at_automation_events
BEFORE UPDATE ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
