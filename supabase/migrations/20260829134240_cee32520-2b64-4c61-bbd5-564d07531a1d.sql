-- =========================================================
-- Base schema: multi-company / multi-unit food service SaaS
-- =========================================================

CREATE TYPE public.app_role AS ENUM ('owner','admin','unit_manager','hr','stock_manager','supervisor','staff');
CREATE TYPE public.unit_type AS ENUM ('restaurante','bar','cafeteria','lanchonete','padaria','cozinha','varejo','outro');
CREATE TYPE public.employment_status AS ENUM ('ativo','afastado','ferias','desligado');
CREATE TYPE public.regime_type AS ENUM ('6x1','5x2','12x36','custom');
CREATE TYPE public.schedule_status AS ENUM ('rascunho','publicada','arquivada');
CREATE TYPE public.time_entry_type AS ENUM ('entrada','intervalo_saida','intervalo_retorno','saida');
CREATE TYPE public.geo_status AS ENUM ('dentro_do_raio','fora_do_raio','localizacao_indisponivel','revisao_necessaria');
CREATE TYPE public.item_type AS ENUM ('protecao_individual','uniforme','ingrediente','embalagem','limpeza','consumo');
CREATE TYPE public.movement_type AS ENUM ('entrada','saida','ajuste','perda','transferencia','inventario');
CREATE TYPE public.delivery_channel AS ENUM ('whatsapp','email','link');
CREATE TYPE public.delivery_status AS ENUM ('pendente','enviando','enviado','erro','cancelado');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ------------------------- companies / units -------------------------
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  status text NOT NULL DEFAULT 'ativa',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  brand_name text,
  brand_logo_url text,
  primary_color text NOT NULL DEFAULT '#F97316',
  accent_color text NOT NULL DEFAULT '#FDBA74',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.unit_type NOT NULL DEFAULT 'restaurante',
  address text,
  city text,
  state text,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  point_radius_meters integer NOT NULL DEFAULT 150,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_company ON public.units(company_id);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name text,
  email text,
  avatar_url text,
  active_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

CREATE TABLE public.user_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

-- ------------------------- security helpers -------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_all_units()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin','hr')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_unit_access(_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _unit_id IS NULL OR public.can_see_all_units() OR EXISTS (
    SELECT 1 FROM public.user_units uu WHERE uu.user_id = auth.uid() AND uu.unit_id = _unit_id
  );
$$;

CREATE OR REPLACE FUNCTION public.in_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _company_id IS NOT NULL AND _company_id = public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------- audit -------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  user_id uuid,
  actor_label text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company ON public.audit_logs(company_id, created_at DESC);

-- ------------------------- people -------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  work_regime_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  regime_type public.regime_type NOT NULL DEFAULT 'custom',
  weekly_hours_limit numeric(5,2),
  minimum_rest_minutes integer,
  work_pattern_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ADD CONSTRAINT teams_work_regime_fk
  FOREIGN KEY (work_regime_id) REFERENCES public.work_regimes(id) ON DELETE SET NULL;

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  cpf text NOT NULL,
  phone text,
  whatsapp_phone text,
  email text,
  employee_code text,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  work_regime_id uuid REFERENCES public.work_regimes(id) ON DELETE SET NULL,
  employment_status public.employment_status NOT NULL DEFAULT 'ativo',
  hire_date date,
  portal_pin_hash text,
  portal_pin_set_at timestamptz,
  portal_failed_attempts integer NOT NULL DEFAULT 0,
  portal_locked_until timestamptz,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cpf)
);
CREATE INDEX idx_employees_unit ON public.employees(unit_id);

CREATE TABLE public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------- shifts & schedules -------------------------
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  crosses_midnight boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#F97316',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  work_regime_id uuid REFERENCES public.work_regimes(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.schedule_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.schedule_templates(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.schedule_status NOT NULL DEFAULT 'rascunho',
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual',
  template_id uuid REFERENCES public.schedule_templates(id) ON DELETE SET NULL,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blocks_emp_date ON public.schedule_blocks(employee_id, work_date);
CREATE UNIQUE INDEX uq_block_unique ON public.schedule_blocks(schedule_id, employee_id, work_date, start_at);

CREATE TABLE public.schedule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  block_id uuid,
  change_type text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  requester_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  block_id uuid REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------- time tracking -------------------------
CREATE TABLE public.point_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  geolocation_required boolean NOT NULL DEFAULT true,
  accuracy_tolerance_meters integer NOT NULL DEFAULT 100,
  block_outside_radius boolean NOT NULL DEFAULT false,
  location_retention_days integer NOT NULL DEFAULT 180,
  require_signature boolean NOT NULL DEFAULT false,
  employee_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, unit_id)
);

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  schedule_block_id uuid REFERENCES public.schedule_blocks(id) ON DELETE SET NULL,
  entry_type public.time_entry_type NOT NULL,
  device_time timestamptz,
  server_time timestamptz NOT NULL DEFAULT now(),
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy_meters numeric(8,2),
  approx_address text,
  distance_meters numeric(10,2),
  geo_status public.geo_status NOT NULL DEFAULT 'localizacao_indisponivel',
  device_info text,
  user_agent text,
  validation_status text NOT NULL DEFAULT 'valido',
  source text NOT NULL DEFAULT 'portal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_emp ON public.time_entries(employee_id, server_time DESC);

CREATE TABLE public.time_entry_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'correcao',
  requested_time timestamptz,
  requested_entry_type public.time_entry_type,
  reason text,
  status text NOT NULL DEFAULT 'pendente',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.point_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  planned_minutes integer NOT NULL DEFAULT 0,
  worked_minutes integer NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  missing_punches integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'gerado',
  acknowledged_at timestamptz,
  signature_url text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_start, period_end)
);

CREATE TABLE public.point_card_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  point_card_id uuid NOT NULL REFERENCES public.point_cards(id) ON DELETE CASCADE,
  channel public.delivery_channel NOT NULL,
  recipient text NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'pendente',
  attempt integer NOT NULL DEFAULT 0,
  error text,
  token_hash text,
  expires_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------- catalog / inventory -------------------------
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  item_type public.item_type NOT NULL DEFAULT 'consumo',
  unit_of_measure text NOT NULL DEFAULT 'unidade',
  photo_url text,
  minimum_stock numeric(12,3) NOT NULL DEFAULT 0,
  maximum_stock numeric(12,3),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  item_type public.item_type NOT NULL DEFAULT 'ingrediente',
  unit_of_measure text NOT NULL DEFAULT 'unidade',
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  minimum_stock numeric(12,3) NOT NULL DEFAULT 0,
  maximum_stock numeric(12,3),
  unit_cost numeric(12,2),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  expires_on date,
  batch text,
  photo_url text,
  notes text,
  allow_negative boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_unit ON public.inventory_items(unit_id);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  quantity numeric(12,3) NOT NULL,
  quantity_before numeric(12,3),
  quantity_after numeric(12,3),
  unit_cost numeric(12,2),
  reason text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  target_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  reference text,
  performed_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_item ON public.stock_movements(inventory_item_id, occurred_at DESC);

CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text,
  status text NOT NULL DEFAULT 'aberto',
  started_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  expected_quantity numeric(12,3),
  counted_quantity numeric(12,3),
  difference numeric(12,3),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  message text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_item_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  size text,
  condition text,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  delivered_by uuid,
  signature_url text,
  returned_at timestamptz,
  return_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------- sales -------------------------
CREATE TABLE public.sales_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  provider text NOT NULL,
  adapter_type text NOT NULL DEFAULT 'rest',
  status text NOT NULL DEFAULT 'nao_conectado',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_sync_error text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.sales_connections(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'pendente',
  rows_imported integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.sales_connections(id) ON DELETE SET NULL,
  external_id text,
  channel text,
  ordered_at timestamptz NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2),
  discount_amount numeric(12,2),
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  category text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2),
  total_price numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2),
  orders_count integer NOT NULL DEFAULT 0,
  average_ticket numeric(12,2),
  cancellations integer NOT NULL DEFAULT 0,
  discounts numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, metric_date)
);

-- ------------------------- notifications -------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  template text,
  channel public.delivery_channel NOT NULL DEFAULT 'email',
  recipient text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.delivery_status NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  idempotency_key text NOT NULL,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

-- ------------------------- updated_at triggers -------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies','units','profiles','roles','teams','work_regimes','employees','shifts',
    'schedule_templates','schedule_template_items','schedules','schedule_blocks','shift_swap_requests',
    'point_policies','time_entries','time_entry_reviews','point_cards','point_card_deliveries',
    'suppliers','catalog_items','inventory_items','inventory_counts','inventory_count_items',
    'employee_item_deliveries','sales_connections','sales_import_jobs','sales_orders',
    'sales_daily_metrics','notifications'
  ] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ------------------------- grants + RLS -------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies','units','profiles','user_roles','user_units','audit_logs','roles','teams','work_regimes',
    'employees','portal_sessions','shifts','schedule_templates','schedule_template_items','schedules',
    'schedule_blocks','schedule_changes','shift_swap_requests','point_policies','time_entries',
    'time_entry_reviews','point_cards','point_card_deliveries','suppliers','catalog_items',
    'inventory_items','stock_movements','inventory_counts','inventory_count_items','stock_alerts',
    'employee_item_deliveries','sales_connections','sales_import_jobs','sales_orders','sales_order_items',
    'sales_daily_metrics','notifications'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles_select_own_or_company" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.in_company(company_id));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_manage" ON public.profiles FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());

-- companies
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "companies_insert_authenticated" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- user_roles / user_units (admin managed, self readable)
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.in_company(company_id) AND public.is_company_admin()));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());
CREATE POLICY "user_roles_bootstrap_owner" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.company_id = user_roles.company_id));

CREATE POLICY "user_units_select" ON public.user_units FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_company_admin());
CREATE POLICY "user_units_admin_manage" ON public.user_units FOR ALL TO authenticated
  USING (public.is_company_admin()) WITH CHECK (public.is_company_admin());

-- audit logs: read within company, insert by members, no update/delete
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin());
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.in_company(company_id));

-- portal_sessions: server-only
CREATE POLICY "portal_sessions_service_only" ON public.portal_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- company-scoped tables (no unit dimension enforcement)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'work_regimes','suppliers','catalog_items','sales_connections','sales_import_jobs',
    'sales_orders','sales_order_items','notifications','schedule_changes'
  ] LOOP
    EXECUTE format($f$CREATE POLICY "%1$s_company_all" ON public.%1$I FOR ALL TO authenticated
      USING (public.in_company(company_id)) WITH CHECK (public.in_company(company_id))$f$, t);
  END LOOP;
END $$;

-- unit-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles','teams','employees','shifts','schedule_templates','schedules','schedule_blocks',
    'shift_swap_requests','point_policies','time_entries','time_entry_reviews','point_cards',
    'inventory_items','stock_movements','inventory_counts','stock_alerts','employee_item_deliveries',
    'sales_daily_metrics'
  ] LOOP
    EXECUTE format($f$CREATE POLICY "%1$s_unit_all" ON public.%1$I FOR ALL TO authenticated
      USING (public.in_company(company_id) AND public.has_unit_access(unit_id))
      WITH CHECK (public.in_company(company_id) AND public.has_unit_access(unit_id))$f$, t);
  END LOOP;
END $$;

-- units
CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
  USING (public.in_company(company_id) AND public.has_unit_access(id));
CREATE POLICY "units_admin_manage" ON public.units FOR ALL TO authenticated
  USING (public.in_company(company_id) AND public.is_company_admin())
  WITH CHECK (public.in_company(company_id) AND public.is_company_admin());

-- child tables without company_id
CREATE POLICY "template_items_all" ON public.schedule_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedule_templates st WHERE st.id = template_id AND public.in_company(st.company_id) AND public.has_unit_access(st.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedule_templates st WHERE st.id = template_id AND public.in_company(st.company_id) AND public.has_unit_access(st.unit_id)));

CREATE POLICY "count_items_all" ON public.inventory_count_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_counts c WHERE c.id = count_id AND public.in_company(c.company_id) AND public.has_unit_access(c.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_counts c WHERE c.id = count_id AND public.in_company(c.company_id) AND public.has_unit_access(c.unit_id)));

CREATE POLICY "card_deliveries_all" ON public.point_card_deliveries FOR ALL TO authenticated
  USING (public.in_company(company_id)) WITH CHECK (public.in_company(company_id));