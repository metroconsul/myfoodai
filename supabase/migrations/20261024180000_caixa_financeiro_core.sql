-- =====================================================================================
-- MyFoods Caixa & Financeiro — estrutura de dados (F3, etapa 1). Aditivo.
-- Plano: docs/CAIXA_FINANCEIRO_PLANO_TECNICO.md. Valores em numeric(14,2), sempre positivos;
-- o sentido vem do tipo. Isolamento: empresa (in_company), unidade (has_unit_access),
-- app contratado (app_caixa_financeiro) e papéis (operador de caixa / financeiro).
-- Fora desta versão: emissão fiscal, integração bancária, processamento de pagamentos.
-- =====================================================================================

-- 1. Predicados de acesso do app ----------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.cf_enabled(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_caixa_financeiro');
$$;

-- Opera o caixa: dono, admin, gerente de unidade, operador de caixa.
CREATE OR REPLACE FUNCTION app_auth.can_operate_cash()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.has_any_role(ARRAY['owner','admin','unit_manager','cashier']::public.app_role[]);
$$;

-- Gerencia o financeiro: dono, admin, financeiro.
CREATE OR REPLACE FUNCTION app_auth.can_manage_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.has_any_role(ARRAY['owner','admin','finance']::public.app_role[]);
$$;

REVOKE ALL ON FUNCTION app_auth.cf_enabled(uuid), app_auth.can_operate_cash(), app_auth.can_manage_finance()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.cf_enabled(uuid), app_auth.can_operate_cash(), app_auth.can_manage_finance()
  TO authenticated, service_role;

-- 2. Integridade: toda referência precisa ser da mesma empresa da linha ----------------------
-- Uso: trigger com pares (coluna, tabela). Ex.: fin_enforce_company('category_id','fin_categories').
CREATE OR REPLACE FUNCTION public.fin_enforce_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i integer := 0;
  rec jsonb := to_jsonb(NEW);
  ref uuid;
  ref_company uuid;
BEGIN
  WHILE i < TG_NARGS LOOP
    ref := nullif(rec ->> TG_ARGV[i], '')::uuid;
    IF ref IS NOT NULL THEN
      EXECUTE format('SELECT company_id FROM public.%I WHERE id = $1', TG_ARGV[i + 1]) INTO ref_company USING ref;
      IF ref_company IS DISTINCT FROM (rec ->> 'company_id')::uuid THEN
        RAISE EXCEPTION 'Referência inválida (%): o registro não pertence à empresa.', TG_ARGV[i];
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fin_enforce_company() FROM PUBLIC, anon, authenticated;

-- 3. Tabelas ----------------------------------------------------------------------------------
CREATE TABLE public.fin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash', 'bank', 'other')),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE public.fin_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  name text NOT NULL,
  parent_id uuid REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, name)
);

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash', 'pix', 'debit', 'credit', 'voucher', 'other')),
  -- Conta onde o valor cai. Dinheiro fica na conta do caixa (settlement nulo).
  settlement_account_id uuid REFERENCES public.fin_accounts(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
-- Uma única forma "dinheiro" ativa por empresa (é a que soma o saldo inicial do caixa).
CREATE UNIQUE INDEX payment_methods_one_cash_per_company ON public.payment_methods(company_id)
  WHERE kind = 'cash' AND active;

CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_id uuid NOT NULL REFERENCES public.fin_accounts(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, name)
);

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES public.cash_registers(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by uuid NOT NULL DEFAULT auth.uid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closed_by uuid,
  closed_at timestamptz,
  expected_total numeric(14,2),
  counted_total numeric(14,2),
  difference numeric(14,2),
  notes text,
  CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX cash_sessions_one_open_per_register ON public.cash_sessions(register_id) WHERE status = 'open';
CREATE INDEX cash_sessions_unit_opened_idx ON public.cash_sessions(unit_id, opened_at DESC);

CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  -- sale = venda; income = outra entrada; expense = saída/pagamento;
  -- withdrawal = sangria (dinheiro sai para outra conta); supply = suprimento (dinheiro entra de outra conta)
  type text NOT NULL CHECK (type IN ('sale', 'income', 'expense', 'withdrawal', 'supply')),
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES public.fin_categories(id),
  -- Sangria: conta de destino. Suprimento: conta de origem.
  counter_account_id uuid REFERENCES public.fin_accounts(id),
  description text,
  reversal_of uuid UNIQUE REFERENCES public.cash_movements(id),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_session_idx ON public.cash_movements(session_id, created_at);

CREATE TABLE public.cash_session_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id),
  expected numeric(14,2) NOT NULL,
  counted numeric(14,2) NOT NULL,
  difference numeric(14,2) GENERATED ALWAYS AS (counted - expected) STORED,
  UNIQUE (session_id, payment_method_id)
);

CREATE TABLE public.fin_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  category_id uuid REFERENCES public.fin_categories(id),
  account_id uuid REFERENCES public.fin_accounts(id),
  description text NOT NULL,
  counterparty text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  starts_on date NOT NULL,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE public.fin_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  -- transfer_in/transfer_out só movem dinheiro entre contas (sangria/suprimento): não são receita nem despesa.
  kind text NOT NULL CHECK (kind IN ('income', 'expense', 'transfer_in', 'transfer_out')),
  category_id uuid REFERENCES public.fin_categories(id),
  account_id uuid REFERENCES public.fin_accounts(id),
  description text NOT NULL,
  counterparty text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  competence_date date NOT NULL DEFAULT current_date,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  paid_at timestamptz,
  payment_method_id uuid REFERENCES public.payment_methods(id),
  recurrence_id uuid REFERENCES public.fin_recurrences(id) ON DELETE SET NULL,
  -- Origem: manual, fechamento de caixa ou recorrência. Integrações futuras (Compras, Estoque)
  -- usarão novos valores aprovados; nenhuma existe nesta versão.
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cash_session', 'recurrence')),
  source_ref uuid,
  canceled_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL),
  CHECK (kind NOT IN ('transfer_in', 'transfer_out') OR source = 'cash_session')
);
CREATE UNIQUE INDEX fin_entries_recurrence_once ON public.fin_entries(recurrence_id, competence_date)
  WHERE recurrence_id IS NOT NULL;
CREATE INDEX fin_entries_company_paid_idx ON public.fin_entries(company_id, paid_at) WHERE status = 'paid';
CREATE INDEX fin_entries_company_due_idx ON public.fin_entries(company_id, due_date) WHERE status = 'pending';

-- 4. Triggers -----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at_fin_accounts BEFORE UPDATE ON public.fin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_fin_entries BEFORE UPDATE ON public.fin_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Abertura de caixa: empresa e unidade vêm do caixa físico; nasce sempre aberta.
CREATE OR REPLACE FUNCTION public.cash_session_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.cash_registers%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.cash_registers WHERE id = NEW.register_id;
  IF NOT FOUND OR NOT r.active THEN
    RAISE EXCEPTION 'Caixa inexistente ou inativo.';
  END IF;
  NEW.company_id := r.company_id;
  NEW.unit_id := r.unit_id;
  NEW.status := 'open';
  NEW.opened_at := now();
  NEW.closed_by := NULL; NEW.closed_at := NULL;
  NEW.expected_total := NULL; NEW.counted_total := NULL; NEW.difference := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_session_defaults() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_cash_session_defaults BEFORE INSERT ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.cash_session_defaults();

-- Movimento: só em caixa aberto; empresa/unidade vêm da sessão; regras de sangria, suprimento e estorno.
CREATE OR REPLACE FUNCTION public.cash_movement_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.cash_sessions%ROWTYPE;
  o public.cash_movements%ROWTYPE;
  pm_kind text;
BEGIN
  SELECT * INTO s FROM public.cash_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'Este caixa já foi fechado.'; END IF;
  NEW.company_id := s.company_id;
  NEW.unit_id := s.unit_id;
  NEW.created_at := now();

  IF NEW.reversal_of IS NOT NULL THEN
    SELECT * INTO o FROM public.cash_movements WHERE id = NEW.reversal_of;
    IF NOT FOUND OR o.session_id <> NEW.session_id THEN
      RAISE EXCEPTION 'Só é possível estornar um movimento do mesmo caixa.';
    END IF;
    IF o.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Um estorno não pode ser estornado.'; END IF;
    NEW.type := o.type;
    NEW.payment_method_id := o.payment_method_id;
    NEW.amount := o.amount;
    NEW.category_id := o.category_id;
    NEW.counter_account_id := o.counter_account_id;
    RETURN NEW;
  END IF;

  SELECT kind INTO pm_kind FROM public.payment_methods WHERE id = NEW.payment_method_id;
  IF NEW.type IN ('withdrawal', 'supply') THEN
    IF pm_kind IS DISTINCT FROM 'cash' THEN
      RAISE EXCEPTION 'Sangria e suprimento são sempre em dinheiro.';
    END IF;
    IF NEW.counter_account_id IS NULL THEN
      RAISE EXCEPTION 'Informe a conta de destino (sangria) ou de origem (suprimento).';
    END IF;
  ELSE
    NEW.counter_account_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_movement_defaults() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_cash_movement_defaults BEFORE INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.cash_movement_defaults();

-- Referências da mesma empresa (os nomes "b_" garantem que rodam depois dos "a_").
CREATE TRIGGER b_fin_company_accounts BEFORE INSERT OR UPDATE ON public.fin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company('unit_id', 'units');
CREATE TRIGGER b_fin_company_categories BEFORE INSERT OR UPDATE ON public.fin_categories
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company('parent_id', 'fin_categories');
CREATE TRIGGER b_fin_company_payment_methods BEFORE INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company('settlement_account_id', 'fin_accounts');
CREATE TRIGGER b_fin_company_registers BEFORE INSERT OR UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company('unit_id', 'units', 'account_id', 'fin_accounts');
CREATE TRIGGER b_fin_company_movements BEFORE INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company(
    'payment_method_id', 'payment_methods', 'category_id', 'fin_categories', 'counter_account_id', 'fin_accounts');
CREATE TRIGGER b_fin_company_recurrences BEFORE INSERT OR UPDATE ON public.fin_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company(
    'unit_id', 'units', 'category_id', 'fin_categories', 'account_id', 'fin_accounts');
CREATE TRIGGER b_fin_company_entries BEFORE INSERT OR UPDATE ON public.fin_entries
  FOR EACH ROW EXECUTE FUNCTION public.fin_enforce_company(
    'unit_id', 'units', 'category_id', 'fin_categories', 'account_id', 'fin_accounts',
    'payment_method_id', 'payment_methods', 'recurrence_id', 'fin_recurrences');

-- 5. RLS -----------------------------------------------------------------------------------
ALTER TABLE public.fin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_session_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_entries ENABLE ROW LEVEL SECURITY;

-- Contas: o financeiro vê todas; o operador só a conta de caixa das suas unidades.
CREATE POLICY fin_accounts_select ON public.fin_accounts FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND (
    app_auth.can_manage_finance()
    OR (app_auth.can_operate_cash() AND kind = 'cash' AND unit_id IS NOT NULL AND app_auth.has_unit_access(unit_id))
  ));
CREATE POLICY fin_accounts_write ON public.fin_accounts FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance())
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance());

CREATE POLICY fin_categories_select ON public.fin_categories FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND (app_auth.can_manage_finance() OR app_auth.can_operate_cash()));
CREATE POLICY fin_categories_write ON public.fin_categories FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance())
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance());

CREATE POLICY payment_methods_select ON public.payment_methods FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND (app_auth.can_manage_finance() OR app_auth.can_operate_cash()));
CREATE POLICY payment_methods_write ON public.payment_methods FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance())
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance());

CREATE POLICY cash_registers_select ON public.cash_registers FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND (
    app_auth.can_manage_finance() OR (app_auth.can_operate_cash() AND app_auth.has_unit_access(unit_id))));
CREATE POLICY cash_registers_write ON public.cash_registers FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance())
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance());

CREATE POLICY cash_sessions_select ON public.cash_sessions FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND app_auth.has_unit_access(unit_id)
  AND (app_auth.can_operate_cash() OR app_auth.can_manage_finance()));
CREATE POLICY cash_sessions_open ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (
  app_auth.cf_enabled(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.can_operate_cash()
  AND opened_by = auth.uid() AND status = 'open');

CREATE POLICY cash_movements_select ON public.cash_movements FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND app_auth.has_unit_access(unit_id)
  AND (app_auth.can_operate_cash() OR app_auth.can_manage_finance()));
CREATE POLICY cash_movements_insert ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (
  app_auth.cf_enabled(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.can_operate_cash()
  AND created_by = auth.uid());

CREATE POLICY cash_session_counts_select ON public.cash_session_counts FOR SELECT TO authenticated USING (
  app_auth.cf_enabled(company_id) AND app_auth.has_unit_access(unit_id)
  AND (app_auth.can_operate_cash() OR app_auth.can_manage_finance()));

CREATE POLICY fin_recurrences_all ON public.fin_recurrences FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance())
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance());

CREATE POLICY fin_entries_all ON public.fin_entries FOR ALL TO authenticated
  USING (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance()
    AND (unit_id IS NULL OR app_auth.has_unit_access(unit_id)))
  WITH CHECK (app_auth.cf_enabled(company_id) AND app_auth.can_manage_finance()
    AND (unit_id IS NULL OR app_auth.has_unit_access(unit_id)));

-- 6. Grants mínimos ---------------------------------------------------------------------------
REVOKE ALL ON public.fin_accounts, public.fin_categories, public.payment_methods, public.cash_registers,
  public.cash_sessions, public.cash_movements, public.cash_session_counts, public.fin_recurrences,
  public.fin_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_accounts, public.fin_categories, public.payment_methods,
  public.cash_registers, public.fin_recurrences, public.fin_entries TO authenticated;
GRANT SELECT, INSERT ON public.cash_sessions, public.cash_movements TO authenticated;  -- sem UPDATE/DELETE: imutáveis
GRANT SELECT ON public.cash_session_counts TO authenticated;                              -- gravado só no fechamento
GRANT ALL ON public.fin_accounts, public.fin_categories, public.payment_methods, public.cash_registers,
  public.cash_sessions, public.cash_movements, public.cash_session_counts, public.fin_recurrences,
  public.fin_entries TO service_role;

-- 7. Saldos por conta (respeita o RLS de quem consulta) -----------------------------------------
CREATE VIEW public.fin_account_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.company_id, a.unit_id, a.name, a.kind, a.active,
  a.opening_balance + coalesce(sum(CASE WHEN e.kind IN ('income', 'transfer_in') THEN e.amount
                                        WHEN e.kind IN ('expense', 'transfer_out') THEN -e.amount END), 0) AS balance
FROM public.fin_accounts a
LEFT JOIN public.fin_entries e ON e.account_id = a.id AND e.status = 'paid'
-- Saldos são informação do financeiro: o operador de caixa não os vê.
WHERE app_auth.can_manage_finance()
GROUP BY a.id;
REVOKE ALL ON public.fin_account_balances FROM anon, authenticated;
GRANT SELECT ON public.fin_account_balances TO authenticated, service_role;

-- 8. Configuração inicial idempotente (dono, admin ou financeiro) --------------------------------
CREATE OR REPLACE FUNCTION public.fin_bootstrap_company()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c uuid := app_auth.current_company_id();
  u record;
  acc uuid;
  bank uuid;
BEGIN
  IF c IS NULL OR NOT app_auth.cf_enabled(c) OR NOT app_auth.can_manage_finance() THEN
    RAISE EXCEPTION 'Sem permissão para configurar o Caixa & Financeiro.';
  END IF;

  INSERT INTO public.fin_accounts (company_id, name, kind) VALUES
    (c, 'Conta bancária', 'bank'), (c, 'Cofre', 'cash')
  ON CONFLICT (company_id, name) DO NOTHING;
  SELECT id INTO bank FROM public.fin_accounts WHERE company_id = c AND name = 'Conta bancária';

  FOR u IN SELECT id, name FROM public.units WHERE company_id = c AND active LOOP
    INSERT INTO public.fin_accounts (company_id, unit_id, name, kind)
    VALUES (c, u.id, 'Caixa — ' || u.name, 'cash')
    ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO acc FROM public.fin_accounts WHERE company_id = c AND name = 'Caixa — ' || u.name;
    INSERT INTO public.cash_registers (company_id, unit_id, name, account_id)
    VALUES (c, u.id, 'Caixa 1', acc)
    ON CONFLICT (unit_id, name) DO NOTHING;
  END LOOP;

  INSERT INTO public.fin_categories (company_id, kind, name, is_system) VALUES
    (c, 'income', 'Vendas no caixa', true),
    (c, 'income', 'Diferença de caixa', true),
    (c, 'income', 'Outras receitas', false),
    (c, 'expense', 'Despesas do caixa', true),
    (c, 'expense', 'Diferença de caixa', true),
    (c, 'expense', 'Fornecedores', false),
    (c, 'expense', 'Folha de pagamento', false),
    (c, 'expense', 'Aluguel', false),
    (c, 'expense', 'Água, luz e gás', false),
    (c, 'expense', 'Impostos e taxas', false),
    (c, 'expense', 'Manutenção', false),
    (c, 'expense', 'Outras despesas', false)
  ON CONFLICT (company_id, kind, name) DO NOTHING;

  INSERT INTO public.payment_methods (company_id, name, kind, settlement_account_id)
  SELECT c, v.name, v.kind, CASE WHEN v.kind = 'cash' THEN NULL ELSE bank END
  FROM (VALUES ('Dinheiro', 'cash'), ('Pix', 'pix'), ('Cartão de débito', 'debit'),
               ('Cartão de crédito', 'credit'), ('Vale-refeição', 'voucher')) AS v(name, kind)
  WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods p WHERE p.company_id = c AND p.name = v.name);
END;
$$;
REVOKE ALL ON FUNCTION public.fin_bootstrap_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_bootstrap_company() TO authenticated, service_role;

-- 9. Fechamento de caixa: conferência + lançamentos no financeiro, numa única transação ---------
-- _counts: [{"payment_method_id": "...", "counted": 123.45}, ...]. Toda forma com valor esperado
-- diferente de zero precisa ser conferida. Gera lançamentos "paid" com source = 'cash_session'.
CREATE OR REPLACE FUNCTION public.close_cash_session(_session_id uuid, _counts jsonb, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.cash_sessions%ROWTYPE;
  reg public.cash_registers%ROWTYPE;
  cash_pm uuid;
  r record;
  counted numeric(14,2);
  exp_total numeric(14,2) := 0;
  cnt_total numeric(14,2) := 0;
  cash_diff numeric(14,2) := 0;
  cat uuid;
  now_ts timestamptz := now();
  today date;
BEGIN
  SELECT * INTO s FROM public.cash_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND
     OR s.company_id IS DISTINCT FROM app_auth.current_company_id()
     OR NOT app_auth.cf_enabled(s.company_id)
     OR NOT app_auth.has_unit_access(s.unit_id)
     OR NOT app_auth.can_operate_cash() THEN
    RAISE EXCEPTION 'Caixa não encontrado ou sem permissão.';
  END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'Este caixa já foi fechado.'; END IF;
  SELECT * INTO reg FROM public.cash_registers WHERE id = s.register_id;
  -- Data do lançamento no fuso da empresa (padrão: São Paulo).
  SELECT (now_ts AT TIME ZONE coalesce(timezone, 'America/Sao_Paulo'))::date INTO today
  FROM public.companies WHERE id = s.company_id;
  SELECT id INTO cash_pm FROM public.payment_methods WHERE company_id = s.company_id AND kind = 'cash' AND active;

  -- Esperado por forma de pagamento (estornos anulam o original).
  FOR r IN
    WITH m AS (
      SELECT payment_method_id,
        CASE WHEN type IN ('sale', 'income', 'supply') THEN amount ELSE -amount END
          * CASE WHEN reversal_of IS NULL THEN 1 ELSE -1 END AS signed
      FROM public.cash_movements WHERE session_id = s.id
    ), pm AS (
      SELECT payment_method_id, sum(signed) AS net FROM m GROUP BY 1
      UNION ALL SELECT cash_pm, 0 WHERE cash_pm IS NOT NULL
    )
    SELECT payment_method_id,
      sum(net) + CASE WHEN payment_method_id = cash_pm THEN s.opening_amount ELSE 0 END AS expected
    FROM pm GROUP BY payment_method_id
  LOOP
    counted := (SELECT (e ->> 'counted')::numeric FROM jsonb_array_elements(coalesce(_counts, '[]'::jsonb)) e
                WHERE (e ->> 'payment_method_id')::uuid = r.payment_method_id LIMIT 1);
    IF counted IS NULL AND r.expected <> 0 THEN
      RAISE EXCEPTION 'Informe o valor conferido de todas as formas de pagamento com saldo.';
    END IF;
    counted := coalesce(counted, 0);
    IF counted < 0 THEN RAISE EXCEPTION 'Valor conferido não pode ser negativo.'; END IF;
    INSERT INTO public.cash_session_counts (company_id, unit_id, session_id, payment_method_id, expected, counted)
    VALUES (s.company_id, s.unit_id, s.id, r.payment_method_id, r.expected, counted);
    exp_total := exp_total + r.expected;
    cnt_total := cnt_total + counted;
    IF r.payment_method_id = cash_pm THEN cash_diff := counted - r.expected; END IF;
  END LOOP;

  UPDATE public.cash_sessions SET status = 'closed', closed_by = auth.uid(), closed_at = now_ts,
    expected_total = exp_total, counted_total = cnt_total, difference = cnt_total - exp_total,
    notes = coalesce(_notes, notes)
  WHERE id = s.id;

  -- Receitas (vendas e outras entradas) e despesas, por forma de pagamento e categoria.
  FOR r IN
    SELECT mv.type IN ('sale', 'income') AS is_income, mv.payment_method_id, mv.category_id,
      sum(mv.amount * CASE WHEN mv.reversal_of IS NULL THEN 1 ELSE -1 END) AS net
    FROM public.cash_movements mv
    WHERE mv.session_id = s.id AND mv.type IN ('sale', 'income', 'expense')
    GROUP BY 1, 2, 3
  LOOP
    CONTINUE WHEN r.net <= 0;
    cat := coalesce(r.category_id, (SELECT id FROM public.fin_categories WHERE company_id = s.company_id
      AND is_system AND kind = CASE WHEN r.is_income THEN 'income' ELSE 'expense' END
      AND name = CASE WHEN r.is_income THEN 'Vendas no caixa' ELSE 'Despesas do caixa' END));
    INSERT INTO public.fin_entries (company_id, unit_id, kind, category_id, account_id, description, amount,
      competence_date, status, paid_at, payment_method_id, source, source_ref, created_by)
    SELECT s.company_id, s.unit_id, CASE WHEN r.is_income THEN 'income' ELSE 'expense' END, cat,
      CASE WHEN p.kind = 'cash' THEN reg.account_id ELSE coalesce(p.settlement_account_id, reg.account_id) END,
      CASE WHEN r.is_income THEN 'Caixa: entradas em ' ELSE 'Caixa: saídas em ' END || p.name,
      r.net, today, 'paid', now_ts, p.id, 'cash_session', s.id, auth.uid()
    FROM public.payment_methods p WHERE p.id = r.payment_method_id;
  END LOOP;

  -- Sangrias e suprimentos: transferências entre a conta do caixa e a conta informada.
  FOR r IN
    SELECT mv.type, mv.counter_account_id,
      sum(mv.amount * CASE WHEN mv.reversal_of IS NULL THEN 1 ELSE -1 END) AS net
    FROM public.cash_movements mv
    WHERE mv.session_id = s.id AND mv.type IN ('withdrawal', 'supply')
    GROUP BY 1, 2
  LOOP
    CONTINUE WHEN r.net <= 0;
    INSERT INTO public.fin_entries (company_id, unit_id, kind, account_id, description, amount,
      competence_date, status, paid_at, source, source_ref, created_by) VALUES
      (s.company_id, s.unit_id, CASE WHEN r.type = 'withdrawal' THEN 'transfer_out' ELSE 'transfer_in' END,
       reg.account_id, CASE WHEN r.type = 'withdrawal' THEN 'Sangria' ELSE 'Suprimento' END, r.net,
       today, 'paid', now_ts, 'cash_session', s.id, auth.uid()),
      (s.company_id, s.unit_id, CASE WHEN r.type = 'withdrawal' THEN 'transfer_in' ELSE 'transfer_out' END,
       r.counter_account_id, CASE WHEN r.type = 'withdrawal' THEN 'Sangria' ELSE 'Suprimento' END, r.net,
       today, 'paid', now_ts, 'cash_session', s.id, auth.uid());
  END LOOP;

  -- Diferença no dinheiro (sobra ou falta) ajusta a conta do caixa ao valor conferido.
  IF cash_diff <> 0 THEN
    SELECT id INTO cat FROM public.fin_categories WHERE company_id = s.company_id AND is_system
      AND name = 'Diferença de caixa' AND kind = CASE WHEN cash_diff > 0 THEN 'income' ELSE 'expense' END;
    INSERT INTO public.fin_entries (company_id, unit_id, kind, category_id, account_id, description, amount,
      competence_date, status, paid_at, payment_method_id, source, source_ref, created_by)
    VALUES (s.company_id, s.unit_id, CASE WHEN cash_diff > 0 THEN 'income' ELSE 'expense' END, cat,
      reg.account_id, CASE WHEN cash_diff > 0 THEN 'Sobra de caixa' ELSE 'Falta de caixa' END, abs(cash_diff),
      today, 'paid', now_ts, cash_pm, 'cash_session', s.id, auth.uid());
  END IF;

  INSERT INTO public.audit_logs (company_id, unit_id, user_id, action, entity, entity_id, metadata)
  VALUES (s.company_id, s.unit_id, auth.uid(), 'caixa_fechado', 'cash_sessions', s.id,
    jsonb_build_object('esperado', exp_total, 'conferido', cnt_total, 'diferenca', cnt_total - exp_total));
END;
$$;
REVOKE ALL ON FUNCTION public.close_cash_session(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, jsonb, text) TO authenticated, service_role;

-- 10. Recorrências: gera lançamentos pendentes até _until, sem duplicar (roda com o RLS de quem chama)
CREATE OR REPLACE FUNCTION public.fin_materialize_recurrences(_until date)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF _until > current_date + 400 THEN RAISE EXCEPTION 'Horizonte máximo de 400 dias.'; END IF;
  WITH occ AS (
    SELECT r.*, d::date AS on_date
    FROM public.fin_recurrences r
    CROSS JOIN LATERAL (
      SELECT CASE r.frequency
        WHEN 'monthly' THEN make_date(extract(year FROM g)::int, extract(month FROM g)::int,
          least(extract(day FROM r.starts_on)::int,
                extract(day FROM (date_trunc('month', g) + interval '1 month - 1 day'))::int))
        ELSE g::date END AS d
      FROM generate_series(
        CASE WHEN r.frequency = 'monthly' THEN date_trunc('month', r.starts_on) ELSE r.starts_on END,
        _until,
        CASE r.frequency WHEN 'weekly' THEN interval '7 days' WHEN 'monthly' THEN interval '1 month'
                         ELSE interval '1 year' END) AS g
    ) x
    WHERE r.active AND d >= r.starts_on AND d <= _until AND (r.ends_on IS NULL OR d <= r.ends_on)
  )
  INSERT INTO public.fin_entries (company_id, unit_id, kind, category_id, account_id, description, counterparty,
    amount, competence_date, due_date, status, recurrence_id, source)
  SELECT company_id, unit_id, kind, category_id, account_id, description, counterparty,
    amount, on_date, on_date, 'pending', id, 'recurrence'
  FROM occ
  ON CONFLICT (recurrence_id, competence_date) WHERE recurrence_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.fin_materialize_recurrences(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_materialize_recurrences(date) TO authenticated, service_role;
