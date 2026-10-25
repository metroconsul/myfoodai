-- Dados FICTÍCIOS (contêiner descartável). A e B têm o app Compras; C não tem.
INSERT INTO public.feature_entitlements (company_id, feature_code, enabled, source) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'app_compras', true, 'app_contract'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'app_compras', true, 'app_contract'),
  ('cccccccc-0000-0000-0000-00000000000c', 'app_compras', false, 'app_contract')
ON CONFLICT (company_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;
