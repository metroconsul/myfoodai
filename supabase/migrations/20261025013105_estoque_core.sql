-- MyFoods Estoque — E1: base no banco (plano em docs/ESTOQUE_PLANO.md). Aditiva; reaproveita as tabelas existentes.
-- catalog_items = produto (empresa) · inventory_items = saldo por unidade · stock_movements = histórico.
-- 1) Movimentação atômica numa função (stock_apply_movement): trava o saldo, grava movimento + saldo + alerta juntos.
-- 2) Histórico só de leitura; saldo só muda pela função (ou como "saldo inicial" ao cadastrar).
-- 3) Um saldo por produto/unidade; transferência pelo produto; um alerta aberto por saldo.
-- 4) Origem de cada movimento (source_app/source_id) sem duplicar: base para Compras, Caixa e Executive.
-- 5) Acesso: app Estoque contratado + papéis de estoque + unidade. Documentos (EPIs) continua lendo e baixando.

-- 0. Ajuste dos dados existentes ---------------------------------------------------------------
-- Saldos sem produto no catálogo ganham o produto correspondente (mesmo nome/tipo/unidade).
INSERT INTO public.catalog_items (company_id, name, category, item_type, unit_of_measure, minimum_stock, maximum_stock, unit_cost)
SELECT DISTINCT ON (ii.company_id, lower(ii.name)) ii.company_id, ii.name, ii.category, ii.item_type, ii.unit_of_measure,
       ii.minimum_stock, ii.maximum_stock, ii.unit_cost
FROM public.inventory_items ii
WHERE ii.catalog_item_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.catalog_items ci WHERE ci.company_id = ii.company_id AND lower(ci.name) = lower(ii.name));
UPDATE public.inventory_items ii SET catalog_item_id = ci.id
FROM public.catalog_items ci
WHERE ii.catalog_item_id IS NULL AND ci.company_id = ii.company_id AND lower(ci.name) = lower(ii.name);
ALTER TABLE public.inventory_items ALTER COLUMN catalog_item_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_one_per_unit ON public.inventory_items (unit_id, catalog_item_id);

-- Alertas: fica só o mais recente aberto de cada saldo; depois, no máximo um aberto.
UPDATE public.stock_alerts a SET resolved_at = now()
WHERE a.resolved_at IS NULL AND EXISTS (
  SELECT 1 FROM public.stock_alerts b
  WHERE b.inventory_item_id = a.inventory_item_id AND b.resolved_at IS NULL AND b.created_at > a.created_at);
CREATE UNIQUE INDEX IF NOT EXISTS stock_alerts_one_open ON public.stock_alerts (inventory_item_id) WHERE resolved_at IS NULL;

-- Origem dos movimentos (integrações). A mesma origem não gera o mesmo movimento duas vezes.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'estoque',
  ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_source_app_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_source_app_check
  CHECK (source_app IN ('estoque', 'inventario', 'documentos', 'compras', 'caixa'));
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_source_unique
  ON public.stock_movements (source_app, source_id, inventory_item_id, movement_type) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_unit_time ON public.stock_movements (unit_id, occurred_at DESC);

-- 1. Permissões ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.stock_manager(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_estoque')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[]);
$$;
-- Documentos (EPIs e uniformes) usa o mesmo catálogo e saldo para entregar itens.
CREATE OR REPLACE FUNCTION app_auth.documents_manager(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_documentos')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION app_auth.stock_reader(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.stock_manager(_company_id) OR app_auth.documents_manager(_company_id);
$$;
REVOKE ALL ON FUNCTION app_auth.stock_manager(uuid), app_auth.documents_manager(uuid), app_auth.stock_reader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.stock_manager(uuid), app_auth.documents_manager(uuid), app_auth.stock_reader(uuid)
  TO authenticated, service_role;

-- 2. Alerta de mínimo (um aberto por saldo) -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_refresh_alert(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record;
BEGIN
  SELECT id, company_id, unit_id, name, quantity, minimum_stock INTO i FROM public.inventory_items WHERE id = _item_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF i.quantity <= i.minimum_stock AND i.minimum_stock > 0 OR i.quantity < 0 THEN
    INSERT INTO public.stock_alerts (company_id, unit_id, inventory_item_id, alert_type, message)
    VALUES (i.company_id, i.unit_id, i.id, CASE WHEN i.quantity <= 0 THEN 'sem_estoque' ELSE 'abaixo_do_minimo' END,
            format('%s está em %s (mínimo %s).', i.name, trim_scale(i.quantity), trim_scale(i.minimum_stock)))
    ON CONFLICT (inventory_item_id) WHERE resolved_at IS NULL DO UPDATE
      SET alert_type = EXCLUDED.alert_type, message = EXCLUDED.message;
  ELSE
    UPDATE public.stock_alerts SET resolved_at = now() WHERE inventory_item_id = i.id AND resolved_at IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.stock_refresh_alert(uuid) FROM PUBLIC, anon, authenticated;

-- 3. Saldo só muda pela função -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_guard_quantity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('myfoods.stock_rpc', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'O saldo só muda por movimentação de estoque.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stock_guard_quantity ON public.inventory_items;
CREATE TRIGGER stock_guard_quantity BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.stock_guard_quantity();

-- Cadastro com quantidade inicial: registra "saldo inicial" no histórico e o alerta, se for o caso.
CREATE OR REPLACE FUNCTION public.stock_initial_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('myfoods.stock_rpc', true) = 'on' THEN RETURN NULL; END IF;
  IF NEW.quantity <> 0 THEN
    INSERT INTO public.stock_movements (company_id, unit_id, inventory_item_id, movement_type, quantity, quantity_before,
      quantity_after, unit_cost, reason, performed_by, source_app)
    VALUES (NEW.company_id, NEW.unit_id, NEW.id, 'inventario', NEW.quantity, 0, NEW.quantity, NEW.unit_cost,
      'Saldo inicial no cadastro', auth.uid(), 'estoque');
  END IF;
  PERFORM public.stock_refresh_alert(NEW.id);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS stock_initial_balance ON public.inventory_items;
CREATE TRIGGER stock_initial_balance AFTER INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.stock_initial_balance();

-- 4. Movimentação atômica ------------------------------------------------------------------------
-- _quantity: entrada/saída/perda/transferência > 0; ajuste = diferença com sinal (≠ 0); inventário = saldo contado (≥ 0).
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
      OR (_source_app = 'documentos' AND app_auth.documents_manager(i.company_id))))
  THEN
    RAISE EXCEPTION 'Sem permissão para movimentar este estoque.' USING ERRCODE = '42501';
  END IF;
  IF _source_app NOT IN ('estoque', 'inventario', 'documentos', 'compras', 'caixa') THEN
    RAISE EXCEPTION 'Origem inválida.' USING ERRCODE = '22023';
  END IF;

  -- Mesma origem já registrada: não aplica de novo (integrações podem reenviar).
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

  -- Transferência: entra no saldo do mesmo produto na unidade de destino (cria se não existir).
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
REVOKE ALL ON FUNCTION public.stock_apply_movement(uuid, public.movement_type, numeric, numeric, text, text, uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_apply_movement(uuid, public.movement_type, numeric, numeric, text, text, uuid, uuid, text, text)
  TO authenticated, service_role;

-- 5. Inventário (contagem) -------------------------------------------------------------------------
-- Abre a contagem da unidade com todos os produtos ativos e o saldo esperado no momento.
CREATE OR REPLACE FUNCTION public.stock_open_count(_unit_id uuid, _name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE c uuid; comp uuid;
BEGIN
  SELECT company_id INTO comp FROM public.units WHERE id = _unit_id;
  IF comp IS NULL OR NOT app_auth.has_unit_access(_unit_id) OR NOT app_auth.stock_manager(comp) THEN
    RAISE EXCEPTION 'Sem permissão para fazer inventário nesta unidade.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_counts WHERE unit_id = _unit_id AND status = 'aberto') THEN
    RAISE EXCEPTION 'Já existe um inventário aberto nesta unidade.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.inventory_counts (company_id, unit_id, name, status, started_by)
  VALUES (comp, _unit_id, coalesce(nullif(trim(_name), ''), 'Inventário ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')), 'aberto', auth.uid())
  RETURNING id INTO c;
  INSERT INTO public.inventory_count_items (count_id, inventory_item_id, expected_quantity)
  SELECT c, id, quantity FROM public.inventory_items WHERE unit_id = _unit_id AND active;
  RETURN c;
END $$;

-- Fecha a contagem: cada produto contado vira um movimento "inventário" com o saldo contado.
CREATE OR REPLACE FUNCTION public.stock_close_count(_count_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE c record; r record; n integer := 0;
BEGIN
  SELECT * INTO c FROM public.inventory_counts WHERE id = _count_id FOR UPDATE;
  IF NOT FOUND OR NOT app_auth.has_unit_access(c.unit_id) OR NOT app_auth.stock_manager(c.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para fechar este inventário.' USING ERRCODE = '42501';
  END IF;
  IF c.status <> 'aberto' THEN RAISE EXCEPTION 'Este inventário já foi fechado.' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT ci.id, ci.inventory_item_id, ci.counted_quantity FROM public.inventory_count_items ci
           WHERE ci.count_id = c.id AND ci.counted_quantity IS NOT NULL LOOP
    PERFORM public.stock_apply_movement(r.inventory_item_id, 'inventario', r.counted_quantity, NULL,
      'Inventário: ' || coalesce(c.name, ''), c.id::text, NULL, NULL, 'inventario', r.id::text);
    n := n + 1;
  END LOOP;
  UPDATE public.inventory_count_items ci SET difference = ci.counted_quantity - ci.expected_quantity
  WHERE ci.count_id = c.id AND ci.counted_quantity IS NOT NULL;
  UPDATE public.inventory_counts SET status = 'fechado', closed_at = now() WHERE id = c.id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.stock_open_count(uuid, text), public.stock_close_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_open_count(uuid, text), public.stock_close_count(uuid) TO authenticated, service_role;

-- 6. Regras de acesso ----------------------------------------------------------------------------
-- Produto: toda a empresa lê (Portal, Documentos); altera quem gerencia estoque ou documentos.
DROP POLICY IF EXISTS catalog_items_company_write ON public.catalog_items;
CREATE POLICY catalog_items_company_write ON public.catalog_items FOR ALL TO authenticated
  USING (app_auth.stock_manager(company_id) OR app_auth.documents_manager(company_id))
  WITH CHECK (app_auth.stock_manager(company_id) OR app_auth.documents_manager(company_id));

DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_write ON public.inventory_items;
CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT TO authenticated
  USING (app_auth.stock_reader(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY inventory_items_write ON public.inventory_items FOR ALL TO authenticated
  USING (app_auth.stock_manager(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.stock_manager(company_id) AND app_auth.has_unit_access(unit_id));

-- Histórico e alertas: só leitura pela equipe; gravação só pelas funções acima.
DROP POLICY IF EXISTS stock_movements_unit_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_unit_write ON public.stock_movements;
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated
  USING (app_auth.stock_reader(company_id) AND app_auth.has_unit_access(unit_id));
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated, anon;

DROP POLICY IF EXISTS stock_alerts_unit_select ON public.stock_alerts;
DROP POLICY IF EXISTS stock_alerts_unit_write ON public.stock_alerts;
CREATE POLICY stock_alerts_select ON public.stock_alerts FOR SELECT TO authenticated
  USING (app_auth.stock_reader(company_id) AND app_auth.has_unit_access(unit_id));
REVOKE INSERT, UPDATE, DELETE ON public.stock_alerts FROM authenticated, anon;

DROP POLICY IF EXISTS inventory_counts_unit_select ON public.inventory_counts;
DROP POLICY IF EXISTS inventory_counts_unit_write ON public.inventory_counts;
CREATE POLICY inventory_counts_select ON public.inventory_counts FOR SELECT TO authenticated
  USING (app_auth.stock_manager(company_id) AND app_auth.has_unit_access(unit_id));
-- Abrir/fechar só pelas funções; a tela só lê a contagem.
REVOKE INSERT, UPDATE, DELETE ON public.inventory_counts FROM authenticated, anon;

-- Itens da contagem: a equipe digita o contado enquanto o inventário está aberto.
DROP POLICY IF EXISTS count_items_select ON public.inventory_count_items;
DROP POLICY IF EXISTS count_items_write ON public.inventory_count_items;
CREATE POLICY count_items_select ON public.inventory_count_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_counts c WHERE c.id = inventory_count_items.count_id
                 AND app_auth.stock_manager(c.company_id) AND app_auth.has_unit_access(c.unit_id)));
CREATE POLICY count_items_update ON public.inventory_count_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_counts c WHERE c.id = inventory_count_items.count_id AND c.status = 'aberto'
                 AND app_auth.stock_manager(c.company_id) AND app_auth.has_unit_access(c.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_counts c WHERE c.id = inventory_count_items.count_id AND c.status = 'aberto'
                 AND app_auth.stock_manager(c.company_id) AND app_auth.has_unit_access(c.unit_id)));
REVOKE INSERT, DELETE ON public.inventory_count_items FROM authenticated, anon;

DROP POLICY IF EXISTS suppliers_company_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_company_write ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (app_auth.stock_reader(company_id));
CREATE POLICY suppliers_write ON public.suppliers FOR ALL TO authenticated
  USING (app_auth.stock_manager(company_id)) WITH CHECK (app_auth.stock_manager(company_id));

-- 7. Visão para relatórios e para o MyFoods Executive (respeita as regras acima) -----------------
CREATE OR REPLACE VIEW public.stock_position WITH (security_invoker = true) AS
SELECT ii.company_id, ii.unit_id, ii.id AS inventory_item_id, ii.catalog_item_id, ii.name, ii.category, ii.item_type,
       ii.unit_of_measure, ii.quantity, ii.minimum_stock, ii.unit_cost,
       round(ii.quantity * coalesce(ii.unit_cost, 0), 2) AS stock_value,
       (ii.quantity <= ii.minimum_stock AND ii.minimum_stock > 0) OR ii.quantity < 0 AS below_minimum,
       ii.last_movement_at
FROM public.inventory_items ii
WHERE ii.active;
GRANT SELECT ON public.stock_position TO authenticated, service_role;
