-- 1. Catálogo de itens: campos operacionais adicionais
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS requires_size boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_color boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quantity_per_delivery numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS replacement_period text NOT NULL DEFAULT 'sem_periodicidade',
  ADD COLUMN IF NOT EXISTS requires_return boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

-- 2. Enums do módulo
DO $$ BEGIN
  CREATE TYPE public.item_delivery_status AS ENUM
    ('rascunho','aguardando_aceite','em_validacao','assinado','recusado','divergente','expirado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.item_delivery_reason AS ENUM
    ('admissao','troca','reposicao','perda','dano','mudanca_funcao','retorno','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Regras de entrega por função/unidade
CREATE TABLE IF NOT EXISTS public.delivery_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  default_size text,
  default_color text,
  replacement_period text NOT NULL DEFAULT 'sem_periodicidade',
  mandatory boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_rules TO authenticated;
GRANT ALL ON public.delivery_rules TO service_role;
ALTER TABLE public.delivery_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_rules_company" ON public.delivery_rules
  FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(unit_id))
  WITH CHECK (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE TRIGGER set_updated_at_delivery_rules BEFORE UPDATE ON public.delivery_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Entregas
CREATE TABLE IF NOT EXISTS public.item_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  responsible_user_id uuid,
  responsible_label text,
  batch_id uuid,
  status public.item_delivery_status NOT NULL DEFAULT 'aguardando_aceite',
  reason public.item_delivery_reason NOT NULL DEFAULT 'admissao',
  notes text,
  attachment_path text,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  refusal_reason text,
  divergence_notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  expires_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.item_deliveries TO authenticated;
GRANT ALL ON public.item_deliveries TO service_role;
ALTER TABLE public.item_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_deliveries_read" ON public.item_deliveries
  FOR SELECT TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE POLICY "item_deliveries_write" ON public.item_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE POLICY "item_deliveries_update" ON public.item_deliveries
  FOR UPDATE TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(unit_id))
  WITH CHECK (public.in_company(company_id) AND public.has_unit_access(unit_id));
CREATE TRIGGER set_updated_at_item_deliveries BEFORE UPDATE ON public.item_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_item_deliveries_employee ON public.item_deliveries(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_item_deliveries_company ON public.item_deliveries(company_id, unit_id, created_at DESC);

-- 5. Itens da entrega
CREATE TABLE IF NOT EXISTS public.item_delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.item_deliveries(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  size text,
  color text,
  lot text,
  unit_cost_snapshot numeric,
  returned_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.item_delivery_items TO authenticated;
GRANT ALL ON public.item_delivery_items TO service_role;
ALTER TABLE public.item_delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_delivery_items_all" ON public.item_delivery_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.item_deliveries d
    WHERE d.id = delivery_id AND public.in_company(d.company_id) AND public.has_unit_access(d.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.item_deliveries d
    WHERE d.id = delivery_id AND public.in_company(d.company_id) AND public.has_unit_access(d.unit_id)));

-- 6. Evidências do aceite
CREATE TABLE IF NOT EXISTS public.item_delivery_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES public.item_deliveries(id) ON DELETE CASCADE,
  signature_type text,
  signature_path text,
  signature_typed_name text,
  face_status text NOT NULL DEFAULT 'nao_realizada',
  face_provider text,
  face_provider_reference text,
  face_asset_path text,
  liveness_status text,
  face_validated_at timestamptz,
  location_status text NOT NULL DEFAULT 'nao_disponivel',
  latitude numeric,
  longitude numeric,
  accuracy_meters numeric,
  location_captured_at timestamptz,
  ip_masked text,
  device_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  terms_version text,
  consent_version text,
  integrity_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.item_delivery_evidence TO authenticated;
GRANT ALL ON public.item_delivery_evidence TO service_role;
ALTER TABLE public.item_delivery_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_delivery_evidence_read" ON public.item_delivery_evidence
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.item_deliveries d
    WHERE d.id = delivery_id AND public.in_company(d.company_id) AND public.has_unit_access(d.unit_id)));
CREATE TRIGGER set_updated_at_item_delivery_evidence BEFORE UPDATE ON public.item_delivery_evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Auditoria do módulo
CREATE TABLE IF NOT EXISTS public.item_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.item_deliveries(id) ON DELETE CASCADE,
  actor_type text NOT NULL DEFAULT 'sistema',
  actor_id uuid,
  actor_label text,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.item_delivery_events TO authenticated;
GRANT ALL ON public.item_delivery_events TO service_role;
ALTER TABLE public.item_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_delivery_events_read" ON public.item_delivery_events
  FOR SELECT TO authenticated
  USING (public.in_company(company_id));
CREATE POLICY "item_delivery_events_insert" ON public.item_delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id));
CREATE INDEX IF NOT EXISTS idx_item_delivery_events_delivery ON public.item_delivery_events(delivery_id, created_at DESC);