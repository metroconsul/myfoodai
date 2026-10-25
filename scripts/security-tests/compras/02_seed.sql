-- Dados FICTÍCIOS do compras (contêiner descartável), executado como superusuário depois do seed do Caixa.
-- A tem Compras e Estoque; B tem só Compras; C não tem Compras.
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-0000000000a7', 'estoquista.a@teste.invalid');
UPDATE public.profiles SET company_id = 'aaaaaaaa-0000-0000-0000-00000000000a' WHERE id::text LIKE 'a0000000%';
INSERT INTO public.user_roles (user_id, company_id, role) VALUES
  ('a0000000-0000-0000-0000-0000000000a7', 'aaaaaaaa-0000-0000-0000-00000000000a', 'stock_manager');
INSERT INTO public.user_units (user_id, unit_id) VALUES
  ('a0000000-0000-0000-0000-0000000000a7', 'aaaaaaaa-1000-0000-0000-0000000000a1');

INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_compras', true, 'app_contract'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_estoque', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_compras', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_estoque', false, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_compras', false, 'app_contract')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.suppliers (id, company_id, name, phone) VALUES
  ('5a000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Laticínios A', '12999990000'),
  ('5a000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Atacado B', NULL),
  ('5a000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'Fornecedor C', NULL);
INSERT INTO public.catalog_items (id, company_id, name, item_type, unit_of_measure, minimum_stock) VALUES
  ('ca000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Leite', 'ingrediente', 'L', 10),
  ('ca000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Café', 'ingrediente', 'kg', 2),
  ('ca000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Farinha B', 'ingrediente', 'kg', 0),
  ('ca000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'Açúcar C', 'ingrediente', 'kg', 0);
INSERT INTO public.inventory_items (id, company_id, unit_id, catalog_item_id, name, item_type, unit_of_measure, quantity, minimum_stock) VALUES
  ('11000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-1000-0000-0000-0000000000a1',
   'ca000000-0000-0000-0000-0000000000a1', 'Leite', 'ingrediente', 'L', 4, 10);
