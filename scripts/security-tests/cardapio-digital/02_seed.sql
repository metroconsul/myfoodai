-- Dados FICTÍCIOS (contêiner descartável). A tem o Cardápio Digital; C não tem (mas tem loja cadastrada).
INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_cardapio', true, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_cardapio', false, 'app_contract')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;
-- Loja de C (sem o app) criada direto, como se tivesse sido desativada depois.
INSERT INTO public.dm_stores (unit_id, company_id, slug, display_name, is_open) VALUES
  ('cccccccc-1000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-00000000000c', 'padaria-c', 'Padaria C', true);
