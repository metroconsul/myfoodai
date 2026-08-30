-- =========================================================
-- Conformidade e equipe: documentos ocupacionais, kits e trocas
-- =========================================================

CREATE TYPE public.occ_document_type AS ENUM (
  'aso_admissional','aso_periodico','aso_retorno','aso_mudanca_funcao','aso_demissional',
  'exame_sangue','exame_clinico','exame_complementar','atestado_ocupacional','outro'
);

CREATE TYPE public.occ_document_status AS ENUM (
  'regular','vence_em_breve','vencido','agendado','aguardando_documento','em_revisao','nao_aplicavel','cancelado'
);

CREATE TYPE public.clinical_access_level AS ENUM (
  'saude_ocupacional','rh_autorizado','gestor_autorizado','administrativo'
);

CREATE TYPE public.doc_request_mode AS ENUM ('visualizar','confirmar_ciencia','enviar_documento','assinar');

CREATE TYPE public.doc_request_status AS ENUM ('aberta','concluida','vencida','cancelada');

CREATE TYPE public.uniform_exchange_status AS ENUM (
  'solicitada','em_analise','aprovada','aguardando_devolucao','entregue','recusada','cancelada','concluida'
);

-- ---------- Documentos ocupacionais ----------
CREATE TABLE public.occupational_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type public.occ_document_type NOT NULL,
  title text NOT NULL,
  status public.occ_document_status NOT NULL DEFAULT 'em_revisao',
  performed_at date,
  expires_at date,
  next_review_at date,
  provider_name text,
  provider_reference text,
  administrative_notes text,
  reported_status text,
  clinical_access_level public.clinical_access_level NOT NULL DEFAULT 'rh_autorizado',
  file_path text,
  file_name text,
  file_size integer,
  file_hash text,
  next_action text,
  next_action_due_at date,
  request_mode public.doc_request_mode NOT NULL DEFAULT 'visualizar',
  is_draft boolean NOT NULL DEFAULT true,
  published_to_portal_at timestamptz,
  archived_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_occ_docs_company ON public.occupational_documents(company_id, employee_id);
CREATE INDEX idx_occ_docs_expiry ON public.occupational_documents(company_id, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occupational_documents TO authenticated;
GRANT ALL ON public.occupational_documents TO service_role;
ALTER TABLE public.occupational_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occ_docs_read" ON public.occupational_documents FOR SELECT TO authenticated
USING (public.in_company(company_id) AND public.has_unit_access(unit_id));

CREATE POLICY "occ_docs_write" ON public.occupational_documents FOR ALL TO authenticated
USING (
  public.in_company(company_id)
  AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr'))
)
WITH CHECK (
  public.in_company(company_id)
  AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr'))
);

CREATE TRIGGER set_updated_at_occupational_documents
BEFORE UPDATE ON public.occupational_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Solicitações de documento ----------
CREATE TABLE public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.occupational_documents(id) ON DELETE SET NULL,
  document_type public.occ_document_type NOT NULL,
  request_mode public.doc_request_mode NOT NULL DEFAULT 'enviar_documento',
  due_at date,
  status public.doc_request_status NOT NULL DEFAULT 'aberta',
  message text,
  requires_upload boolean NOT NULL DEFAULT false,
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  requires_signature boolean NOT NULL DEFAULT false,
  batch_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_doc_requests_company ON public.document_requests(company_id, employee_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requests TO authenticated;
GRANT ALL ON public.document_requests TO service_role;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_requests_read" ON public.document_requests FOR SELECT TO authenticated
USING (public.in_company(company_id) AND public.has_unit_access(unit_id));

CREATE POLICY "doc_requests_write" ON public.document_requests FOR ALL TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')))
WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')));

CREATE TRIGGER set_updated_at_document_requests
BEFORE UPDATE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Aceite / ciência de documentos ----------
CREATE TABLE public.document_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.occupational_documents(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_version integer NOT NULL DEFAULT 1,
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  signed_at timestamptz,
  signature_path text,
  face_status text NOT NULL DEFAULT 'nao_realizada',
  face_provider_reference text,
  liveness_status text,
  location_status text NOT NULL DEFAULT 'nao_disponivel',
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  location_captured_at timestamptz,
  masked_ip text,
  device_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  term_version text,
  consent_version text,
  integrity_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, document_version)
);
GRANT SELECT, INSERT, UPDATE ON public.document_acknowledgements TO authenticated;
GRANT ALL ON public.document_acknowledgements TO service_role;
ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_ack_read" ON public.document_acknowledgements FOR SELECT TO authenticated
USING (public.in_company(company_id));

CREATE POLICY "doc_ack_write" ON public.document_acknowledgements FOR ALL TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')))
WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')));

CREATE TRIGGER set_updated_at_document_acknowledgements
BEFORE UPDATE ON public.document_acknowledgements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Log de acesso a documentos sensíveis ----------
CREATE TABLE public.document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.occupational_documents(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_access_logs_doc ON public.document_access_logs(document_id, created_at DESC);

GRANT SELECT, INSERT ON public.document_access_logs TO authenticated;
GRANT ALL ON public.document_access_logs TO service_role;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_access_logs_read" ON public.document_access_logs FOR SELECT TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr')));

CREATE POLICY "doc_access_logs_insert" ON public.document_access_logs FOR INSERT TO authenticated
WITH CHECK (public.in_company(company_id));

-- ---------- Kits por função ----------
CREATE TABLE public.uniform_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  name text NOT NULL,
  department text,
  required boolean NOT NULL DEFAULT true,
  replacement_period text NOT NULL DEFAULT 'sem_periodicidade',
  effective_from date,
  effective_until date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_kits TO authenticated;
GRANT ALL ON public.uniform_kits TO service_role;
ALTER TABLE public.uniform_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uniform_kits_read" ON public.uniform_kits FOR SELECT TO authenticated
USING (public.in_company(company_id) AND public.has_unit_access(unit_id));

CREATE POLICY "uniform_kits_write" ON public.uniform_kits FOR ALL TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')))
WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')));

CREATE TRIGGER set_updated_at_uniform_kits
BEFORE UPDATE ON public.uniform_kits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.uniform_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kit_id uuid NOT NULL REFERENCES public.uniform_kits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  default_size text,
  default_color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uniform_kit_items_kit ON public.uniform_kit_items(kit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uniform_kit_items TO authenticated;
GRANT ALL ON public.uniform_kit_items TO service_role;
ALTER TABLE public.uniform_kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uniform_kit_items_read" ON public.uniform_kit_items FOR SELECT TO authenticated
USING (public.in_company(company_id));

CREATE POLICY "uniform_kit_items_write" ON public.uniform_kit_items FOR ALL TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')))
WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')));

-- ---------- Trocas e devoluções ----------
CREATE TABLE public.uniform_exchange_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  original_delivery_id uuid REFERENCES public.item_deliveries(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  requested_size text,
  requested_color text,
  reason text NOT NULL,
  description text,
  attachment_path text,
  status public.uniform_exchange_status NOT NULL DEFAULT 'solicitada',
  returned_condition text,
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uniform_exchanges_company ON public.uniform_exchange_requests(company_id, status);

GRANT SELECT, INSERT, UPDATE ON public.uniform_exchange_requests TO authenticated;
GRANT ALL ON public.uniform_exchange_requests TO service_role;
ALTER TABLE public.uniform_exchange_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uniform_exchanges_read" ON public.uniform_exchange_requests FOR SELECT TO authenticated
USING (public.in_company(company_id) AND public.has_unit_access(unit_id));

CREATE POLICY "uniform_exchanges_write" ON public.uniform_exchange_requests FOR ALL TO authenticated
USING (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')))
WITH CHECK (public.in_company(company_id) AND (public.is_company_admin() OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'stock_manager') OR public.has_role(auth.uid(), 'unit_manager')));

CREATE TRIGGER set_updated_at_uniform_exchange_requests
BEFORE UPDATE ON public.uniform_exchange_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();