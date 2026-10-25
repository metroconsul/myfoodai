-- MyFoods Cardápio Digital (plano em docs/CARDAPIO_DIGITAL_PLANO.md). Aditiva.
-- Cada loja tem um cardápio público (link /c/<endereço> e QR por mesa). O cliente, sem login, faz o pedido
-- por funções do banco que conferem tudo (preço do banco, loja aberta, limites). Pagamento na conta, no final:
-- pedidos da mesa entram na conta aberta da mesa; a equipe fecha a conta.
-- Equipe: qualquer funcionário com login (pedidos e contas); dono/admin/gerente (cardápio e configurações).

-- 1. Permissões ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.dm_member(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_cardapio')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','stock_manager','supervisor','staff','cashier','finance']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION app_auth.dm_manager(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.dm_member(_company_id) AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager']::public.app_role[]);
$$;
REVOKE ALL ON FUNCTION app_auth.dm_member(uuid), app_auth.dm_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.dm_member(uuid), app_auth.dm_manager(uuid) TO authenticated, service_role;

-- 2. Loja (endereço público e configurações) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_stores (
  unit_id uuid PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 40),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
  is_open boolean NOT NULL DEFAULT false,
  accepts_table boolean NOT NULL DEFAULT true,
  accepts_pickup boolean NOT NULL DEFAULT true,
  notice text CHECK (notice IS NULL OR length(notice) <= 200),
  whatsapp text CHECK (whatsapp IS NULL OR length(whatsapp) <= 20),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Itens do cardápio (por loja) -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 300),
  category text CHECK (category IS NULL OR length(category) <= 40),
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price < 100000),
  photo_path text CHECK (photo_path IS NULL OR length(photo_path) <= 200),
  available boolean NOT NULL DEFAULT true,   -- false = esgotado (aparece, mas não dá para pedir)
  active boolean NOT NULL DEFAULT true,      -- false = fora do cardápio
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_items_unit_idx ON public.dm_items (unit_id, category, sort_order, name);

-- 4. Contas de mesa, pedidos e itens do pedido ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  table_label text NOT NULL CHECK (length(table_label) BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS dm_tabs_one_open ON public.dm_tabs (unit_id, lower(table_label)) WHERE status = 'aberta';

CREATE TABLE IF NOT EXISTS public.dm_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  number integer NOT NULL,
  tracking_token text NOT NULL UNIQUE,
  client_key text,
  mode text NOT NULL CHECK (mode IN ('mesa', 'retirada')),
  table_label text CHECK (table_label IS NULL OR length(table_label) <= 20),
  tab_id uuid REFERENCES public.dm_tabs(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (length(trim(customer_name)) BETWEEN 1 AND 60),
  customer_phone text CHECK (customer_phone IS NULL OR length(customer_phone) <= 20),
  notes text CHECK (notes IS NULL OR length(notes) <= 300),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'aceito', 'preparando', 'pronto', 'entregue', 'recusado', 'cancelado')),
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, number),
  UNIQUE (unit_id, client_key)
);
CREATE INDEX IF NOT EXISTS dm_orders_unit_idx ON public.dm_orders (unit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dm_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.dm_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.dm_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  notes text CHECK (notes IS NULL OR length(notes) <= 140)
);
CREATE INDEX IF NOT EXISTS dm_order_items_order_idx ON public.dm_order_items (order_id);

-- 5. Empresa sempre vem da loja (nunca do navegador) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_unit_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM public.units WHERE id = NEW.unit_id;
  IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'Loja inválida.' USING ERRCODE = '22023'; END IF;
  IF TG_TABLE_NAME IN ('dm_stores', 'dm_items') THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dm_unit_company() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS dm_stores_company ON public.dm_stores;
CREATE TRIGGER dm_stores_company BEFORE INSERT OR UPDATE ON public.dm_stores FOR EACH ROW EXECUTE FUNCTION public.dm_unit_company();
DROP TRIGGER IF EXISTS dm_items_company ON public.dm_items;
CREATE TRIGGER dm_items_company BEFORE INSERT OR UPDATE ON public.dm_items FOR EACH ROW EXECUTE FUNCTION public.dm_unit_company();

-- 6. Andamento do pedido pela equipe: só para frente; recusar/cancelar antes de entregar ----------
CREATE OR REPLACE FUNCTION public.dm_order_status_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE steps text[] := ARRAY['novo', 'aceito', 'preparando', 'pronto', 'entregue'];
BEGIN
  IF current_setting('myfoods.dm_rpc', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('entregue', 'recusado', 'cancelado') THEN
      RAISE EXCEPTION 'Este pedido já foi finalizado.' USING ERRCODE = '22023';
    END IF;
    IF NEW.status IN ('recusado', 'cancelado') THEN
      NULL;
    ELSIF array_position(steps, NEW.status) < array_position(steps, OLD.status) THEN
      RAISE EXCEPTION 'O pedido não volta de etapa.' USING ERRCODE = '22023';
    END IF;
    -- Retirada é paga na entrega; mesa é paga ao fechar a conta.
    IF NEW.status = 'entregue' AND NEW.mode = 'retirada' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dm_order_status_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS dm_order_status_guard ON public.dm_orders;
CREATE TRIGGER dm_order_status_guard BEFORE UPDATE ON public.dm_orders FOR EACH ROW EXECUTE FUNCTION public.dm_order_status_guard();

-- 7. Funções públicas (cliente, sem login) --------------------------------------------------------
-- Cardápio publicado de uma loja (só campos públicos).
CREATE OR REPLACE FUNCTION public.dm_public_menu(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE s public.dm_stores%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.dm_stores WHERE slug = lower(trim(_slug));
  IF NOT FOUND OR NOT app_auth.has_feature(s.company_id, 'app_cardapio') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'store', jsonb_build_object('name', s.display_name, 'slug', s.slug, 'is_open', s.is_open, 'accepts_table', s.accepts_table,
                                'accepts_pickup', s.accepts_pickup, 'notice', s.notice, 'whatsapp', s.whatsapp),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'category', i.category,
                                          'price', i.price, 'photo_path', i.photo_path, 'available', i.available)
                       ORDER BY i.category NULLS LAST, i.sort_order, i.name)
      FROM public.dm_items i WHERE i.unit_id = s.unit_id AND i.active), '[]'::jsonb));
END $$;

-- Fazer o pedido. _items: [{ "item_id": uuid, "quantity": 1..50, "notes": texto? }]. Preço vem do banco.
CREATE OR REPLACE FUNCTION public.dm_place_order(
  _slug text, _mode text, _table text, _name text, _phone text, _notes text, _items jsonb, _client_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE
  s public.dm_stores%ROWTYPE; o public.dm_orders%ROWTYPE; it jsonb; di public.dm_items%ROWTYPE;
  q integer; v_total numeric := 0; tab uuid; tbl text := nullif(trim(_table), ''); phone text := nullif(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), '');
  nm text := trim(coalesce(_name, '')); n integer;
BEGIN
  SELECT * INTO s FROM public.dm_stores WHERE slug = lower(trim(_slug));
  IF NOT FOUND OR NOT app_auth.has_feature(s.company_id, 'app_cardapio') THEN
    RAISE EXCEPTION 'Cardápio não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF _client_key IS NULL OR length(_client_key) NOT BETWEEN 8 AND 64 THEN RAISE EXCEPTION 'Pedido inválido.' USING ERRCODE = '22023'; END IF;
  -- Reenvio do mesmo pedido (internet ruim, clique duplo): devolve o mesmo.
  SELECT * INTO o FROM public.dm_orders WHERE unit_id = s.unit_id AND client_key = _client_key;
  IF FOUND THEN RETURN jsonb_build_object('token', o.tracking_token, 'number', o.number); END IF;

  IF NOT s.is_open THEN RAISE EXCEPTION 'A loja está fechada para pedidos agora.' USING ERRCODE = '22023'; END IF;
  IF _mode = 'mesa' THEN
    IF NOT s.accepts_table THEN RAISE EXCEPTION 'Pedidos na mesa não estão disponíveis.' USING ERRCODE = '22023'; END IF;
    IF tbl IS NULL OR length(tbl) > 20 THEN RAISE EXCEPTION 'Informe a mesa.' USING ERRCODE = '22023'; END IF;
  ELSIF _mode = 'retirada' THEN
    IF NOT s.accepts_pickup THEN RAISE EXCEPTION 'Retirada não está disponível.' USING ERRCODE = '22023'; END IF;
    IF phone IS NULL OR length(phone) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Informe um telefone com DDD.' USING ERRCODE = '22023'; END IF;
    tbl := NULL;
  ELSE
    RAISE EXCEPTION 'Escolha mesa ou retirada.' USING ERRCODE = '22023';
  END IF;
  IF length(nm) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Informe seu nome.' USING ERRCODE = '22023'; END IF;
  IF _notes IS NOT NULL AND length(_notes) > 300 THEN RAISE EXCEPTION 'Observação muito longa.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Escolha de 1 a 30 itens.' USING ERRCODE = '22023';
  END IF;

  -- Limites contra abuso: por loja e por mesa/telefone.
  SELECT count(*) INTO n FROM public.dm_orders WHERE unit_id = s.unit_id AND created_at > now() - interval '1 minute';
  IF n >= 30 THEN RAISE EXCEPTION 'Muitos pedidos agora. Tente em instantes.' USING ERRCODE = '54000'; END IF;
  SELECT count(*) INTO n FROM public.dm_orders WHERE unit_id = s.unit_id AND created_at > now() - interval '2 minutes'
    AND ((tbl IS NOT NULL AND lower(table_label) = lower(tbl)) OR (phone IS NOT NULL AND customer_phone = phone));
  IF n >= 5 THEN RAISE EXCEPTION 'Muitos pedidos seguidos. Aguarde um pouco.' USING ERRCODE = '54000'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dm_order_number:' || s.unit_id::text));
  INSERT INTO public.dm_orders (company_id, unit_id, number, tracking_token, client_key, mode, table_label, customer_name, customer_phone, notes)
  VALUES (s.company_id, s.unit_id, (SELECT coalesce(max(number), 0) + 1 FROM public.dm_orders WHERE unit_id = s.unit_id),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), _client_key, _mode, tbl, nm, phone,
    nullif(trim(_notes), ''))
  RETURNING * INTO o;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := (it->>'quantity')::integer;
    IF q IS NULL OR q NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Quantidade inválida.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO di FROM public.dm_items WHERE id = (it->>'item_id')::uuid AND unit_id = s.unit_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Um item não está mais no cardápio.' USING ERRCODE = '22023'; END IF;
    IF NOT di.available THEN RAISE EXCEPTION '% está esgotado.', di.name USING ERRCODE = '22023'; END IF;
    IF it->>'notes' IS NOT NULL AND length(it->>'notes') > 140 THEN RAISE EXCEPTION 'Observação do item muito longa.' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.dm_order_items (order_id, item_id, name, unit_price, quantity, notes)
    VALUES (o.id, di.id, di.name, di.price, q, nullif(trim(it->>'notes'), ''));
    v_total := v_total + q * di.price;
  END LOOP;

  -- Mesa: entra na conta aberta da mesa (cria se não houver).
  IF _mode = 'mesa' THEN
    SELECT id INTO tab FROM public.dm_tabs WHERE unit_id = s.unit_id AND lower(table_label) = lower(tbl) AND status = 'aberta';
    IF NOT FOUND THEN
      INSERT INTO public.dm_tabs (company_id, unit_id, table_label) VALUES (s.company_id, s.unit_id, tbl) RETURNING id INTO tab;
    END IF;
  END IF;
  PERFORM set_config('myfoods.dm_rpc', 'on', true);
  UPDATE public.dm_orders SET total = round(v_total, 2), tab_id = tab WHERE id = o.id;
  PERFORM set_config('myfoods.dm_rpc', 'off', true);
  RETURN jsonb_build_object('token', o.tracking_token, 'number', o.number);
END $$;

-- Acompanhar o pedido pelo código secreto do link (o cliente só vê o próprio pedido).
CREATE OR REPLACE FUNCTION public.dm_order_status(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.dm_orders%ROWTYPE; s public.dm_stores%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) <> 64 THEN RETURN NULL; END IF;
  SELECT * INTO o FROM public.dm_orders WHERE tracking_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.dm_stores WHERE unit_id = o.unit_id;
  RETURN jsonb_build_object(
    'number', o.number, 'status', o.status, 'mode', o.mode, 'table', o.table_label, 'total', o.total,
    'created_at', o.created_at, 'store', jsonb_build_object('name', s.display_name, 'slug', s.slug, 'whatsapp', s.whatsapp),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'unit_price', unit_price, 'notes', notes))
                       FROM public.dm_order_items WHERE order_id = o.id), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.dm_public_menu(text), public.dm_place_order(text, text, text, text, text, text, jsonb, text),
  public.dm_order_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_public_menu(text), public.dm_place_order(text, text, text, text, text, text, jsonb, text),
  public.dm_order_status(text) TO anon, authenticated, service_role;

-- 8. Fechar a conta da mesa (equipe) ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_close_tab(_tab_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
DECLARE t public.dm_tabs%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.dm_tabs WHERE id = _tab_id FOR UPDATE;
  IF NOT FOUND OR NOT app_auth.dm_member(t.company_id) OR NOT app_auth.has_unit_access(t.unit_id) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF t.status <> 'aberta' THEN RAISE EXCEPTION 'Esta conta já foi fechada.' USING ERRCODE = '22023'; END IF;
  UPDATE public.dm_tabs SET status = 'fechada', closed_at = now(), closed_by = auth.uid() WHERE id = t.id;
  PERFORM set_config('myfoods.dm_rpc', 'on', true);
  UPDATE public.dm_orders SET paid_at = now(), updated_at = now(),
    status = CASE WHEN status IN ('recusado', 'cancelado') THEN status ELSE 'entregue' END
  WHERE tab_id = t.id AND paid_at IS NULL;
  PERFORM set_config('myfoods.dm_rpc', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.dm_close_tab(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_close_tab(uuid) TO authenticated, service_role;

-- 9. Regras de acesso (equipe) -------------------------------------------------------------------
ALTER TABLE public.dm_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_stores_select ON public.dm_stores FOR SELECT TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY dm_stores_write ON public.dm_stores FOR ALL TO authenticated
  USING (app_auth.dm_manager(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.dm_manager(company_id) AND app_auth.has_unit_access(unit_id));

CREATE POLICY dm_items_select ON public.dm_items FOR SELECT TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY dm_items_write ON public.dm_items FOR ALL TO authenticated
  USING (app_auth.dm_manager(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.dm_manager(company_id) AND app_auth.has_unit_access(unit_id));
-- Esgotado/disponível: qualquer pessoa da equipe (a cozinha avisa que acabou).
CREATE POLICY dm_items_available ON public.dm_items FOR UPDATE TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));

CREATE POLICY dm_tabs_select ON public.dm_tabs FOR SELECT TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY dm_orders_select ON public.dm_orders FOR SELECT TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY dm_orders_update ON public.dm_orders FOR UPDATE TO authenticated
  USING (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.dm_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY dm_order_items_select ON public.dm_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dm_orders o WHERE o.id = order_id));

REVOKE ALL ON public.dm_stores, public.dm_items, public.dm_tabs, public.dm_orders, public.dm_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dm_stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_items TO authenticated;
GRANT SELECT ON public.dm_tabs, public.dm_order_items TO authenticated;
GRANT SELECT ON public.dm_orders TO authenticated;
GRANT UPDATE (status) ON public.dm_orders TO authenticated;
GRANT ALL ON public.dm_stores, public.dm_items, public.dm_tabs, public.dm_orders, public.dm_order_items TO service_role;

-- Quem não é gestão só pode mudar "esgotado/disponível" (as outras colunas exigem gestão).
CREATE OR REPLACE FUNCTION public.dm_items_member_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_auth AS $$
BEGIN
  IF app_auth.dm_manager(OLD.company_id) OR current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF (NEW.name, NEW.description, NEW.category, NEW.price, NEW.photo_path, NEW.active, NEW.sort_order, NEW.unit_id)
     IS DISTINCT FROM (OLD.name, OLD.description, OLD.category, OLD.price, OLD.photo_path, OLD.active, OLD.sort_order, OLD.unit_id) THEN
    RAISE EXCEPTION 'Só a gestão altera o cardápio; a equipe marca esgotado/disponível.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dm_items_member_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS dm_items_member_guard ON public.dm_items;
CREATE TRIGGER dm_items_member_guard BEFORE UPDATE ON public.dm_items FOR EACH ROW EXECUTE FUNCTION public.dm_items_member_guard();

-- 10. Fotos: leitura pública; envio só pela gestão, na pasta da própria empresa ------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-photos', 'menu-photos', true, 1048576, ARRAY['image/jpeg', 'image/webp', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 1048576, allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png'];

DROP POLICY IF EXISTS menu_photos_write ON storage.objects;
CREATE POLICY menu_photos_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-photos' AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
              AND app_auth.dm_manager(app_auth.current_company_id()));
DROP POLICY IF EXISTS menu_photos_update ON storage.objects;
CREATE POLICY menu_photos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-photos' AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
         AND app_auth.dm_manager(app_auth.current_company_id()));
DROP POLICY IF EXISTS menu_photos_delete ON storage.objects;
CREATE POLICY menu_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'menu-photos' AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
         AND app_auth.dm_manager(app_auth.current_company_id()));
-- Apagar/trocar a foto passa por uma leitura do objeto: a gestão lê só a pasta da própria empresa
-- (o cliente vê as fotos pelo endereço público do bucket, que não depende desta regra).
DROP POLICY IF EXISTS menu_photos_select ON storage.objects;
CREATE POLICY menu_photos_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'menu-photos' AND (storage.foldername(name))[1] = app_auth.current_company_id()::text
         AND app_auth.dm_manager(app_auth.current_company_id()));
