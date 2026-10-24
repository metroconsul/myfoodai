-- Testes da fundação (F1): papéis novos e acesso por aplicativo. Contêiner DESCARTÁVEL.
CREATE SCHEMA IF NOT EXISTS f;
CREATE TABLE IF NOT EXISTS f.results (id serial PRIMARY KEY, name text, passed boolean, detail text);

CREATE OR REPLACE FUNCTION f.apps(_company uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(feature_code || CASE WHEN enabled THEN '' ELSE '(off)' END, ',' ORDER BY feature_code), '-')
  FROM public.feature_entitlements WHERE company_id = _company AND feature_code LIKE 'app\_%';
$$;
CREATE OR REPLACE FUNCTION f.on(_company uuid, _code text) RETURNS boolean LANGUAGE sql AS $$
  SELECT coalesce((SELECT enabled FROM public.feature_entitlements WHERE company_id = _company AND feature_code = _code), false);
$$;
CREATE OR REPLACE FUNCTION f.rec(_name text, _ok boolean, _detail text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO f.results(name, passed, detail) VALUES (_name, _ok, _detail);
$$;

DO $t$
DECLARE
  cA constant uuid := 'a1000000-0000-0000-0000-000000000001';
  cB constant uuid := 'b1000000-0000-0000-0000-000000000001';
  cC constant uuid := 'c1000000-0000-0000-0000-000000000001';
  cN constant uuid := 'd1000000-0000-0000-0000-000000000001';
  op constant uuid := 'a1000000-0000-0000-0000-0000000000aa';
  r text;
BEGIN
  r := (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype);
  PERFORM f.rec('F01 enum app_role tem cashier e finance', r LIKE '%cashier%' AND r LIKE '%finance%', r);

  PERFORM f.rec('F02 Começo: Ponto e Documentos, sem Estoque (backfill)',
    f.on(cA,'app_ponto') AND f.on(cA,'app_documentos') AND NOT f.on(cA,'app_estoque'), f.apps(cA));
  PERFORM f.rec('F03 Essencial e Equipe: Ponto, Documentos e Estoque (backfill)',
    f.on(cB,'app_estoque') AND f.on(cC,'app_estoque') AND f.on(cB,'app_ponto') AND f.on(cC,'app_documentos'),
    f.apps(cB) || ' | ' || f.apps(cC));
  PERFORM f.rec('F04 Ninguém recebe Compras nem Caixa & Financeiro automaticamente',
    NOT (f.on(cA,'app_compras') OR f.on(cB,'app_compras') OR f.on(cC,'app_caixa_financeiro') OR f.on(cB,'app_caixa_financeiro')),
    f.apps(cC));

  PERFORM f.rec('F05 has_feature enxerga o app contratado e nega o não contratado',
    app_auth.has_feature(cA,'app_ponto') AND NOT app_auth.has_feature(cA,'app_estoque'),
    app_auth.has_feature(cA,'app_ponto')::text || '/' || app_auth.has_feature(cA,'app_estoque')::text);

  UPDATE public.companies SET plan_code = 'essencial' WHERE id = cA;
  PERFORM f.rec('F06 Upgrade Começo→Essencial acrescenta Estoque e o recurso inventory',
    f.on(cA,'app_estoque') AND f.on(cA,'inventory'), f.apps(cA));

  UPDATE public.companies SET plan_code = 'comeco' WHERE id = cB;
  PERFORM f.rec('F07 Downgrade Essencial→Começo NÃO desliga apps (só os recursos do plano)',
    f.on(cB,'app_estoque') AND f.on(cB,'app_ponto') AND NOT f.on(cB,'inventory'), f.apps(cB));

  UPDATE public.feature_entitlements SET enabled = false WHERE company_id = cC AND feature_code = 'app_ponto';
  UPDATE public.companies SET plan_code = 'essencial' WHERE id = cC;
  PERFORM f.rec('F08 App desligado de propósito continua desligado após troca de plano',
    NOT f.on(cC,'app_ponto') AND f.on(cC,'app_documentos'), f.apps(cC));

  INSERT INTO public.companies (id, name, plan_code, access_source, subscription_status)
  VALUES (cN, 'Empresa Nova (fictícia)', 'essencial', 'admin_grant', 'admin_grant');
  PERFORM f.rec('F09 Empresa nova recebe os apps do plano no cadastro',
    f.on(cN,'app_ponto') AND f.on(cN,'app_documentos') AND f.on(cN,'app_estoque'), f.apps(cN));

  BEGIN
    INSERT INTO public.user_roles (user_id, company_id, role) VALUES (op, cA, 'cashier');
    INSERT INTO public.user_roles (user_id, company_id, role) VALUES (op, cA, 'finance');
    PERFORM f.rec('F10 Papéis cashier e finance podem ser atribuídos (perfil da mesma empresa)', true, 'ok');
  EXCEPTION WHEN OTHERS THEN
    PERFORM f.rec('F10 Papéis cashier e finance podem ser atribuídos (perfil da mesma empresa)', false, SQLERRM);
  END;

  PERFORM f.rec('F11 cashier/finance não viram admin nem folha',
    NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = op AND role IN ('owner','admin','hr')), 'ok');
END
$t$;

SELECT count(*) FILTER (WHERE passed) AS passou, count(*) FILTER (WHERE NOT passed) AS falhou FROM f.results;
SELECT name, passed, detail FROM f.results ORDER BY id;
