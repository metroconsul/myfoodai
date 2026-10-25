-- Dados FICTÍCIOS do estoque (contêiner descartável), executado como superusuário depois do seed do Caixa.
-- A tem Estoque e Documentos; B tem Estoque; C não tem Estoque.
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-0000000000a7', 'estoquista.a@teste.invalid'),
  ('a0000000-0000-0000-0000-0000000000a8', 'rh.a@teste.invalid');
UPDATE public.profiles SET company_id = 'aaaaaaaa-0000-0000-0000-00000000000a' WHERE id::text LIKE 'a0000000%';
INSERT INTO public.user_roles (user_id, company_id, role) VALUES
  ('a0000000-0000-0000-0000-0000000000a7', 'aaaaaaaa-0000-0000-0000-00000000000a', 'stock_manager'),
  ('a0000000-0000-0000-0000-0000000000a8', 'aaaaaaaa-0000-0000-0000-00000000000a', 'hr');
INSERT INTO public.user_units (user_id, unit_id) VALUES
  ('a0000000-0000-0000-0000-0000000000a7', 'aaaaaaaa-1000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a8', 'aaaaaaaa-1000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a8', 'aaaaaaaa-1000-0000-0000-0000000000a2');

INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_estoque', true, 'app_contract'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_documentos', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_estoque', true, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_estoque', false, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_documentos', false, 'app_contract')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Produto e saldo da empresa C (sem o app), criados como servidor.
INSERT INTO public.catalog_items (id, company_id, name, item_type, unit_of_measure)
VALUES ('ca000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'Farinha C', 'ingrediente', 'kg');
INSERT INTO public.inventory_items (id, company_id, unit_id, catalog_item_id, name, item_type, unit_of_measure, quantity)
VALUES ('11000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'cccccccc-1000-0000-0000-0000000000c1',
        'ca000000-0000-0000-0000-0000000000c1', 'Farinha C', 'ingrediente', 'kg', 5);
