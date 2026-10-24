-- Conectar Mercado Pago (somente leitura de vendas). Aditivo.
-- A conexão reaproveita sales_connections (provider 'mercado_pago', sem segredo em config) e as vendas
-- caem em sales_orders. Tokens e o estado do OAuth ficam em tabelas que só o servidor (service_role) lê.

-- 1. Uma conta Mercado Pago por empresa -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS sales_connections_one_mercado_pago
  ON public.sales_connections (company_id) WHERE provider = 'mercado_pago';

-- 2. Tokens (criptografados no servidor com AES-256-GCM) --------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_tokens (
  connection_id uuid PRIMARY KEY REFERENCES public.sales_connections(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Uma conta Mercado Pago fica ligada a uma única empresa (o aviso do MP identifica a conta pelo user_id).
CREATE UNIQUE INDEX IF NOT EXISTS provider_tokens_provider_user ON public.provider_tokens (provider, provider_user_id);

-- 3. Estado do OAuth (state + PKCE), uso único, 10 minutos ------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_oauth_states (
  state text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS ligada e nenhuma política: navegador (anon/authenticated) não lê nem grava.
ALTER TABLE public.provider_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_tokens, public.provider_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.provider_tokens, public.provider_oauth_states TO service_role;

-- 4. Quem pode conectar: dono/admin/financeiro, com o app Caixa & Financeiro ativo ------------
-- Devolve a empresa atual quando o usuário pode gerenciar a conexão; NULL caso contrário.
CREATE OR REPLACE FUNCTION public.mp_manage_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT c FROM (SELECT app_auth.current_company_id() AS c) x
  WHERE c IS NOT NULL AND app_auth.cf_enabled(c) AND app_auth.can_manage_finance();
$$;
REVOKE ALL ON FUNCTION public.mp_manage_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mp_manage_company() TO authenticated, service_role;
