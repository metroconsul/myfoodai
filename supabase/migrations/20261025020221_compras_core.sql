-- MyFoods Compras — C1 (plano em docs/COMPRAS_PLANO.md). Aditiva.
-- Pedido de compra (opcional) e recebimento. Receber dá entrada no estoque de todas as linhas na mesma operação,
-- pela stock_apply_movement com origem 'compras' + id da linha (nunca entra duas vezes). Cancelar devolve.
-- Acesso: app Compras contratado + dono/admin/gerente/estoquista + unidade.

-- 1. Permissões ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.purchase_manager(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_compras')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]);
$$;
REVOKE ALL ON FUNCTION app_auth.purchase_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.purchase_manager(uuid) TO authenticated, service_role;

-- Compras lê saldo e mínimo (sugestão de pedido) e usa o mesmo cadastro de fornecedores.
CREATE OR REPLACE FUNCTION app_auth.stock_reader(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.stock_manager(_company_id) OR app_auth.documents_manager(_company_id) OR app_auth.purchase_manager(_company_id);
$$;
DROP POLICY IF EXISTS suppliers_write ON public.suppliers;
CREATE POLICY suppliers_write ON public.suppliers FOR ALL TO authenticated
  USING (app_auth.stock_manager(company_id) OR app_auth.purchase_manager(company_id))
  WITH CHECK (app_auth.stock_manager(company_id) OR app_auth.purchase_manager(company_id));

-- 2. Pedidos ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  number integer NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'enviado', 'recebido_parcial', 'recebido', 'cancelado')),
  expected_date date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  sent_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX IF NOT EXISTS purchase_orders_unit_idx ON public.purchase_orders (unit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) CHECK (unit_price IS NULL OR unit_price >= 0),
  received_quantity numeric(12,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, catalog_item_id)
);

-- Número sequencial por empresa (Pedido nº 1, 2, 3...).
CREATE OR REPLACE FUNCTION public.purchase_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('purchase_order_number:' || NEW.company_id::text));
  SELECT coalesce(max(number), 0) + 1 INTO NEW.number FROM public.purchase_orders WHERE company_id = NEW.company_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchase_order_number ON public.purchase_orders;
CREATE TRIGGER purchase_order_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchase_order_number();
REVOKE ALL ON FUNCTION public.purchase_order_number() FROM PUBLIC, anon, authenticated;

-- 3. Recebimentos (só pelas funções abaixo) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date,
  due_date date,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'cancelado')),
  client_key text,
  received_by uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, client_key)
);
CREATE INDEX IF NOT EXISTS purchase_receipts_unit_idx ON public.purchase_receipts (unit_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_catalog_idx ON public.purchase_receipt_items (catalog_item_id, created_at DESC);

-- 4. Movimentação de estoque aceita quem gerencia compras quando a origem é 'compras' -------------
-- (mesma função da migration estoque_core; só muda a conferência de permissão)
CREATE OR REPLACE FUNCTION public.stock_apply_movement(
  _item_id uuid,
  _type public.movement_type,
  _quantity numeric,
  _unit_cost numeric DEFAULT NULL,
  _reason text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL,
  _target_unit_id uuid DEFAULT NULL,
  _source_app text DEFAULT 'estoque',
  _source_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE
  i public.inventory_items%ROWTYPE;
  t public.inventory_items%ROWTYPE;
  is_server boolean := current_setting('role', true) = 'service_role';
  before_q numeric; after_q numeric; stored numeric; mov_id uuid; existing uuid; now_ts timestamptz := now();
BEGIN
  SELECT * INTO i FROM public.inventory_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado no estoque.' USING ERRCODE = 'P0002'; END IF;

  IF NOT is_server AND NOT (
    app_auth.has_unit_access(i.unit_id) AND (
      app_auth.stock_manager(i.company_id)
      OR (_source_app = 'documentos' AND app_auth.documents_manager(i.company_id))
      OR (_source_app = 'compras' AND app_auth.purchase_manager(i.company_id))))
  THEN
    RAISE EXCEPTION 'Sem permissão para movimentar este estoque.' USING ERRCODE = '42501';
  END IF;
  IF _source_app NOT IN ('estoque', 'inventario', 'documentos', 'compras', 'caixa') THEN
    RAISE EXCEPTION 'Origem inválida.' USING ERRCODE = '22023';
  END IF;

  IF _source_id IS NOT NULL THEN
    SELECT id INTO existing FROM public.stock_movements
    WHERE source_app = _source_app AND source_id = _source_id AND inventory_item_id = i.id AND movement_type = _type;
    IF FOUND THEN
      RETURN jsonb_build_object('movement_id', existing, 'duplicate', true, 'after', i.quantity);
    END IF;
  END IF;

  before_q := i.quantity;
  IF _type = 'ajuste' THEN
    IF _quantity = 0 THEN RAISE EXCEPTION 'Informe a diferença do ajuste.' USING ERRCODE = '22023'; END IF;
    after_q := before_q + _quantity; stored := _quantity;
  ELSIF _type = 'inventario' THEN
    IF _quantity < 0 THEN RAISE EXCEPTION 'Quantidade contada inválida.' USING ERRCODE = '22023'; END IF;
    after_q := _quantity; stored := _quantity;
  ELSE
    IF _quantity <= 0 THEN RAISE EXCEPTION 'Informe uma quantidade maior que zero.' USING ERRCODE = '22023'; END IF;
    stored := _quantity;
    after_q := CASE WHEN _type = 'entrada' THEN before_q + _quantity ELSE before_q - _quantity END;
  END IF;
  IF after_q < 0 AND NOT i.allow_negative THEN
    RAISE EXCEPTION 'Saldo insuficiente: há % e a movimentação pede %.', trim_scale(before_q), trim_scale(abs(_quantity))
      USING ERRCODE = '23514';
  END IF;

  IF _type = 'transferencia' THEN
    IF _target_unit_id IS NULL OR _target_unit_id = i.unit_id THEN
      RAISE EXCEPTION 'Escolha a unidade de destino.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id = _target_unit_id AND u.company_id = i.company_id)
       OR (NOT is_server AND NOT app_auth.has_unit_access(_target_unit_id)) THEN
      RAISE EXCEPTION 'Unidade de destino inválida.' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM set_config('myfoods.stock_rpc', 'on', true);

  INSERT INTO public.stock_movements (company_id, unit_id, inventory_item_id, movement_type, quantity, quantity_before,
    quantity_after, unit_cost, reason, supplier_id, target_unit_id, reference, performed_by, occurred_at, source_app, source_id)
  VALUES (i.company_id, i.unit_id, i.id, _type, stored, before_q, after_q, _unit_cost, _reason, _supplier_id,
    _target_unit_id, _reference, auth.uid(), now_ts, _source_app, _source_id)
  RETURNING id INTO mov_id;

  UPDATE public.inventory_items SET quantity = after_q, last_movement_at = now_ts,
    unit_cost = CASE WHEN _type = 'entrada' AND _unit_cost IS NOT NULL THEN _unit_cost ELSE unit_cost END
  WHERE id = i.id;
  PERFORM public.stock_refresh_alert(i.id);

  IF _type = 'transferencia' THEN
    SELECT * INTO t FROM public.inventory_items
    WHERE unit_id = _target_unit_id AND catalog_item_id = i.catalog_item_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_items (company_id, unit_id, catalog_item_id, name, category, item_type, unit_of_measure,
        quantity, minimum_stock, maximum_stock, unit_cost)
      VALUES (i.company_id, _target_unit_id, i.catalog_item_id, i.name, i.category, i.item_type, i.unit_of_measure,
        0, i.minimum_stock, i.maximum_stock, i.unit_cost)
      RETURNING * INTO t;
    END IF;
    INSERT INTO public.stock_movements (company_id, unit_id, inventory_item_id, movement_type, quantity, quantity_before,
      quantity_after, unit_cost, reason, target_unit_id, reference, performed_by, occurred_at, source_app, source_id)
    VALUES (t.company_id, t.unit_id, t.id, 'entrada', stored, t.quantity, t.quantity + stored, i.unit_cost,
      'Transferência recebida', i.unit_id, mov_id::text, auth.uid(), now_ts, _source_app, NULL);
    UPDATE public.inventory_items SET quantity = t.quantity + stored, last_movement_at = now_ts WHERE id = t.id;
    PERFORM public.stock_refresh_alert(t.id);
  END IF;

  PERFORM set_config('myfoods.stock_rpc', 'off', true);

  INSERT INTO public.audit_logs (company_id, unit_id, user_id, action, entity, entity_id, metadata)
  VALUES (i.company_id, i.unit_id, auth.uid(), 'estoque_movimentado', 'inventory_items', i.id,
    jsonb_build_object('movement_type', _type, 'before', before_q, 'after', after_q, 'source_app', _source_app));

  RETURN jsonb_build_object('movement_id', mov_id, 'duplicate', false, 'before', before_q, 'after', after_q);
END $$;

-- 5. Situação do pedido conforme o recebido -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_refresh_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_items int; done_items int; any_received boolean; st text;
BEGIN
  SELECT status INTO st FROM public.purchase_orders WHERE id = _order_id;
  IF st IS NULL OR st = 'cancelado' THEN RETURN; END IF;
  SELECT count(*), count(*) FILTER (WHERE received_quantity >= quantity), bool_or(received_quantity > 0)
    INTO total_items, done_items, any_received FROM public.purchase_order_items WHERE order_id = _order_id;
  PERFORM set_config('myfoods.purchase_rpc', 'on', true);
  UPDATE public.purchase_orders SET updated_at = now(), status = CASE
    WHEN total_items > 0 AND done_items = total_items THEN 'recebido'
    WHEN any_received THEN 'recebido_parcial'
    WHEN sent_at IS NOT NULL THEN 'enviado'
    ELSE 'aberto' END
  WHERE id = _order_id;
  PERFORM set_config('myfoods.purchase_rpc', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.purchase_refresh_order(uuid) FROM PUBLIC, anon, authenticated;

-- 6. Receber compra -----------------------------------------------------------------------------
-- _lines: [{ "catalog_item_id": uuid, "quantity": n, "unit_cost": n|null, "order_item_id": uuid|null }]
-- _client_key: identificador gerado pela tela; repetir o envio devolve o mesmo recebimento.
CREATE OR REPLACE FUNCTION public.purchase_receive(
  _unit_id uuid,
  _supplier_id uuid,
  _order_id uuid,
  _lines jsonb,
  _invoice_number text DEFAULT NULL,
  _invoice_date date DEFAULT NULL,
  _due_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _client_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE
  comp uuid; rec uuid; o record; sup uuid := _supplier_id; l jsonb; cat record; inv uuid; ri uuid; qty numeric; cost numeric; oi uuid; total numeric := 0;
BEGIN
  SELECT company_id INTO comp FROM public.units WHERE id = _unit_id;
  IF comp IS NULL OR NOT app_auth.has_unit_access(_unit_id) OR NOT app_auth.purchase_manager(comp) THEN
    RAISE EXCEPTION 'Sem permissão para receber compras nesta unidade.' USING ERRCODE = '42501';
  END IF;
  IF _client_key IS NOT NULL THEN
    SELECT id INTO rec FROM public.purchase_receipts WHERE company_id = comp AND client_key = _client_key;
    IF FOUND THEN RETURN rec; END IF;
  END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um produto.' USING ERRCODE = '22023';
  END IF;
  IF _supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND company_id = comp) THEN
    RAISE EXCEPTION 'Fornecedor inválido.' USING ERRCODE = '22023';
  END IF;
  IF _order_id IS NOT NULL THEN
    SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
    IF NOT FOUND OR o.company_id <> comp OR o.unit_id <> _unit_id THEN
      RAISE EXCEPTION 'Pedido inválido para esta unidade.' USING ERRCODE = '22023';
    END IF;
    IF o.status IN ('cancelado', 'recebido') THEN
      RAISE EXCEPTION 'Este pedido já está %.', o.status USING ERRCODE = '22023';
    END IF;
    sup := coalesce(sup, o.supplier_id);
  END IF;

  INSERT INTO public.purchase_receipts (company_id, unit_id, supplier_id, order_id, invoice_number, invoice_date, due_date,
    notes, client_key, received_by)
  VALUES (comp, _unit_id, sup, _order_id, nullif(trim(_invoice_number), ''), _invoice_date,
    _due_date, nullif(trim(_notes), ''), _client_key, auth.uid())
  RETURNING id INTO rec;

  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    qty := (l->>'quantity')::numeric;
    cost := nullif(l->>'unit_cost', '')::numeric;
    oi := nullif(l->>'order_item_id', '')::uuid;
    IF qty IS NULL OR qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida.' USING ERRCODE = '22023'; END IF;
    IF cost IS NOT NULL AND cost < 0 THEN RAISE EXCEPTION 'Custo inválido.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO cat FROM public.catalog_items WHERE id = (l->>'catalog_item_id')::uuid AND company_id = comp;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido.' USING ERRCODE = '22023'; END IF;
    IF oi IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.purchase_order_items WHERE id = oi AND order_id = _order_id AND catalog_item_id = cat.id) THEN
      RAISE EXCEPTION 'Item não pertence ao pedido.' USING ERRCODE = '22023';
    END IF;

    -- Saldo do produto na unidade (cria se ainda não existe).
    SELECT id INTO inv FROM public.inventory_items WHERE unit_id = _unit_id AND catalog_item_id = cat.id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_items (company_id, unit_id, catalog_item_id, name, category, item_type, unit_of_measure,
        quantity, minimum_stock, maximum_stock, unit_cost)
      VALUES (comp, _unit_id, cat.id, cat.name, cat.category, cat.item_type, cat.unit_of_measure, 0, cat.minimum_stock,
        cat.maximum_stock, coalesce(cost, cat.unit_cost))
      RETURNING id INTO inv;
    END IF;

    INSERT INTO public.purchase_receipt_items (receipt_id, company_id, catalog_item_id, inventory_item_id, order_item_id, quantity, unit_cost)
    VALUES (rec, comp, cat.id, inv, oi, qty, cost) RETURNING id INTO ri;

    PERFORM public.stock_apply_movement(inv, 'entrada', qty, cost,
      'Compra' || coalesce(' · nota ' || nullif(trim(_invoice_number), ''), ''), rec::text,
      sup, NULL, 'compras', ri::text);

    IF oi IS NOT NULL THEN
      UPDATE public.purchase_order_items SET received_quantity = received_quantity + qty WHERE id = oi;
    END IF;
    total := total + qty * coalesce(cost, 0);
  END LOOP;

  UPDATE public.purchase_receipts SET total_amount = round(total, 2) WHERE id = rec;
  UPDATE public.catalog_items c SET unit_cost = x.cost
  FROM (SELECT DISTINCT ON (catalog_item_id) catalog_item_id, unit_cost AS cost FROM public.purchase_receipt_items
        WHERE receipt_id = rec AND unit_cost IS NOT NULL ORDER BY catalog_item_id, created_at DESC) x
  WHERE c.id = x.catalog_item_id;
  IF _order_id IS NOT NULL THEN PERFORM public.purchase_refresh_order(_order_id); END IF;

  INSERT INTO public.audit_logs (company_id, unit_id, user_id, action, entity, entity_id, metadata)
  VALUES (comp, _unit_id, auth.uid(), 'compra_recebida', 'purchase_receipts', rec,
    jsonb_build_object('order_id', _order_id, 'linhas', jsonb_array_length(_lines), 'total', round(total, 2)));
  RETURN rec;
END $$;

-- 7. Cancelar recebimento (devolve o estoque) ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_cancel_receipt(_receipt_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE r record; it record;
BEGIN
  SELECT * INTO r FROM public.purchase_receipts WHERE id = _receipt_id FOR UPDATE;
  IF NOT FOUND OR NOT app_auth.has_unit_access(r.unit_id) OR NOT app_auth.purchase_manager(r.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este recebimento.' USING ERRCODE = '42501';
  END IF;
  IF r.status = 'cancelado' THEN RAISE EXCEPTION 'Este recebimento já foi cancelado.' USING ERRCODE = '22023'; END IF;
  FOR it IN SELECT * FROM public.purchase_receipt_items WHERE receipt_id = r.id LOOP
    PERFORM public.stock_apply_movement(it.inventory_item_id, 'saida', it.quantity, it.unit_cost,
      'Cancelamento de compra' || coalesce(' · nota ' || r.invoice_number, ''), r.id::text, r.supplier_id, NULL,
      'compras', it.id::text || ':cancelamento');
    IF it.order_item_id IS NOT NULL THEN
      UPDATE public.purchase_order_items SET received_quantity = greatest(0, received_quantity - it.quantity)
      WHERE id = it.order_item_id;
    END IF;
  END LOOP;
  UPDATE public.purchase_receipts SET status = 'cancelado', canceled_at = now(), cancel_reason = nullif(trim(_reason), '')
  WHERE id = r.id;
  IF r.order_id IS NOT NULL THEN PERFORM public.purchase_refresh_order(r.order_id); END IF;
  INSERT INTO public.audit_logs (company_id, unit_id, user_id, action, entity, entity_id, metadata)
  VALUES (r.company_id, r.unit_id, auth.uid(), 'compra_cancelada', 'purchase_receipts', r.id, jsonb_build_object('reason', _reason));
END $$;

REVOKE ALL ON FUNCTION public.purchase_receive(uuid, uuid, uuid, jsonb, text, date, date, text, text),
  public.purchase_cancel_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_receive(uuid, uuid, uuid, jsonb, text, date, date, text, text),
  public.purchase_cancel_receipt(uuid, text) TO authenticated, service_role;

-- 8. Regras de acesso ----------------------------------------------------------------------------
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

-- Pedido: a equipe de compras cria e edita; não apaga (cancela). Fornecedor precisa ser da mesma empresa.
CREATE POLICY purchase_orders_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (app_auth.purchase_manager(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY purchase_orders_insert ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (app_auth.purchase_manager(company_id) AND app_auth.has_unit_access(unit_id)
    AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.company_id = purchase_orders.company_id));
CREATE POLICY purchase_orders_update ON public.purchase_orders FOR UPDATE TO authenticated
  USING (app_auth.purchase_manager(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.purchase_manager(company_id) AND app_auth.has_unit_access(unit_id)
    AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.company_id = purchase_orders.company_id));

-- Itens do pedido: só enquanto o pedido está aberto ou enviado; produto da mesma empresa; recebido só pela função.
CREATE POLICY purchase_order_items_select ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id
                 AND app_auth.purchase_manager(o.company_id) AND app_auth.has_unit_access(o.unit_id)));
CREATE POLICY purchase_order_items_write ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND o.status IN ('aberto', 'enviado')
                 AND app_auth.purchase_manager(o.company_id) AND app_auth.has_unit_access(o.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders o JOIN public.catalog_items c ON c.id = catalog_item_id
                 WHERE o.id = order_id AND o.status IN ('aberto', 'enviado') AND c.company_id = o.company_id
                   AND app_auth.purchase_manager(o.company_id) AND app_auth.has_unit_access(o.unit_id)));

-- Recebimentos: só leitura pela equipe; gravação só pelas funções.
CREATE POLICY purchase_receipts_select ON public.purchase_receipts FOR SELECT TO authenticated
  USING (app_auth.purchase_manager(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY purchase_receipt_items_select ON public.purchase_receipt_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_receipts r WHERE r.id = receipt_id
                 AND app_auth.purchase_manager(r.company_id) AND app_auth.has_unit_access(r.unit_id)));

-- Privilégios explícitos (tabela nova pode nascer com privilégios amplos por padrão):
-- pedidos não são apagados (cancela-se); recebido e número só mudam pelas funções; recebimentos só pelas funções.
REVOKE ALL ON public.purchase_orders, public.purchase_order_items, public.purchase_receipts, public.purchase_receipt_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.purchase_orders TO authenticated;
GRANT UPDATE (supplier_id, status, expected_date, notes, sent_at, canceled_at, updated_at) ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.purchase_order_items TO authenticated;
GRANT UPDATE (quantity, unit_price) ON public.purchase_order_items TO authenticated;
GRANT SELECT ON public.purchase_receipts, public.purchase_receipt_items TO authenticated;
GRANT ALL ON public.purchase_orders, public.purchase_order_items, public.purchase_receipts, public.purchase_receipt_items TO service_role;
-- Situação do pedido pela tela: só aberto, enviado ou cancelado; "recebido" vem do recebimento; cancelado não volta.
CREATE OR REPLACE FUNCTION public.purchase_guard_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('myfoods.purchase_rpc', true) = 'on' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser reaberto.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IN ('recebido', 'recebido_parcial') THEN
    RAISE EXCEPTION 'O pedido fica recebido ao registrar o recebimento.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'cancelado' THEN NEW.canceled_at := now(); END IF;
  IF NEW.status = 'enviado' AND NEW.sent_at IS NULL THEN NEW.sent_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchase_guard_order_status ON public.purchase_orders;
CREATE TRIGGER purchase_guard_order_status BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchase_guard_order_status();
REVOKE ALL ON FUNCTION public.purchase_guard_order_status() FROM PUBLIC, anon, authenticated;
