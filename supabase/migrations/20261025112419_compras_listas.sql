-- MyFoods Compras como listas (decisão de 2026-10-25): listas de ingredientes que faltam, por loja,
-- no estilo de "Notas"; exportar em PDF e enviar para quem faz as compras. Sem fornecedores, preços ou estoque.
-- Aditiva: as tabelas de pedidos/recebimentos da versão anterior ficam no banco, sem uso.
-- Acesso: app Compras contratado + qualquer papel da empresa (funcionários com login) + unidade.
-- Apagar uma lista e definir quem faz as compras: dono, admin, gerente.

-- 1. Permissões ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.shopping_member(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_compras')
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','stock_manager','supervisor','staff','cashier','finance']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION app_auth.shopping_manager(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.shopping_member(_company_id) AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager']::public.app_role[]);
$$;
REVOKE ALL ON FUNCTION app_auth.shopping_member(uuid), app_auth.shopping_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.shopping_member(uuid), app_auth.shopping_manager(uuid) TO authenticated, service_role;

-- 2. Listas e itens -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Lista de compras' CHECK (length(trim(title)) > 0),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'enviada', 'concluida')),
  created_by uuid DEFAULT auth.uid(),
  sent_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_lists_unit_idx ON public.shopping_lists (unit_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  quantity text CHECK (quantity IS NULL OR length(quantity) <= 40),
  checked boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_list_items_list_idx ON public.shopping_list_items (list_id, position, created_at);

-- Quem faz as compras de cada loja (para onde vai o PDF/WhatsApp).
CREATE TABLE IF NOT EXISTS public.shopping_buyers (
  unit_id uuid PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A lista sobe para o topo quando alguém mexe nos itens.
CREATE OR REPLACE FUNCTION public.shopping_touch_list()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shopping_lists SET updated_at = now() WHERE id = coalesce(NEW.list_id, OLD.list_id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.shopping_touch_list() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shopping_touch_list ON public.shopping_list_items;
CREATE TRIGGER shopping_touch_list AFTER INSERT OR UPDATE OR DELETE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.shopping_touch_list();

-- Empresa da lista vem da unidade (não do navegador).
CREATE OR REPLACE FUNCTION public.shopping_list_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM public.units WHERE id = NEW.unit_id;
  IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'Unidade inválida.' USING ERRCODE = '22023'; END IF;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'enviada' AND OLD.status <> 'enviada' THEN NEW.sent_at := now(); END IF;
    IF NEW.status = 'concluida' AND OLD.status <> 'concluida' THEN NEW.done_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopping_list_defaults() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shopping_list_defaults ON public.shopping_lists;
CREATE TRIGGER shopping_list_defaults BEFORE INSERT OR UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.shopping_list_defaults();

CREATE OR REPLACE FUNCTION public.shopping_buyer_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM public.units WHERE id = NEW.unit_id;
  IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'Unidade inválida.' USING ERRCODE = '22023'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shopping_buyer_defaults() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shopping_buyer_defaults ON public.shopping_buyers;
CREATE TRIGGER shopping_buyer_defaults BEFORE INSERT OR UPDATE ON public.shopping_buyers
  FOR EACH ROW EXECUTE FUNCTION public.shopping_buyer_defaults();

-- 3. Regras de acesso ----------------------------------------------------------------------------
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopping_lists_select ON public.shopping_lists FOR SELECT TO authenticated
  USING (app_auth.shopping_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY shopping_lists_insert ON public.shopping_lists FOR INSERT TO authenticated
  WITH CHECK (app_auth.shopping_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY shopping_lists_update ON public.shopping_lists FOR UPDATE TO authenticated
  USING (app_auth.shopping_member(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.shopping_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY shopping_lists_delete ON public.shopping_lists FOR DELETE TO authenticated
  USING (app_auth.shopping_manager(company_id) AND app_auth.has_unit_access(unit_id));

CREATE POLICY shopping_list_items_all ON public.shopping_list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id
                 AND app_auth.shopping_member(l.company_id) AND app_auth.has_unit_access(l.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id
                 AND app_auth.shopping_member(l.company_id) AND app_auth.has_unit_access(l.unit_id)));

CREATE POLICY shopping_buyers_select ON public.shopping_buyers FOR SELECT TO authenticated
  USING (app_auth.shopping_member(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY shopping_buyers_write ON public.shopping_buyers FOR ALL TO authenticated
  USING (app_auth.shopping_manager(company_id) AND app_auth.has_unit_access(unit_id))
  WITH CHECK (app_auth.shopping_manager(company_id) AND app_auth.has_unit_access(unit_id));

REVOKE ALL ON public.shopping_lists, public.shopping_list_items, public.shopping_buyers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.shopping_lists TO authenticated;
GRANT UPDATE (title, status) ON public.shopping_lists TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.shopping_list_items TO authenticated;
GRANT UPDATE (name, quantity, checked, position) ON public.shopping_list_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_buyers TO authenticated;
GRANT ALL ON public.shopping_lists, public.shopping_list_items, public.shopping_buyers TO service_role;
