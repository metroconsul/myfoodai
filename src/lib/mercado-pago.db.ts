/**
 * Tipos das tabelas da conexão Mercado Pago (migration 20261024185611).
 * Ficam aqui até a próxima regeneração de src/integrations/supabase/types.ts.
 */
type Ts = string;

export type ProviderToken = {
  connection_id: string; company_id: string; provider: string; provider_user_id: string;
  access_token_enc: string; refresh_token_enc: string | null; expires_at: Ts; created_at: Ts; updated_at: Ts;
};
export type ProviderOauthState = {
  state: string; company_id: string; unit_id: string; user_id: string; provider: string;
  code_verifier: string; expires_at: Ts; created_at: Ts;
};

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type MpDatabase = {
  public: {
    Tables: {
      provider_tokens: Table<ProviderToken>;
      provider_oauth_states: Table<ProviderOauthState>;
    };
    Views: Record<string, never>;
    Functions: { mp_manage_company: { Args: Record<string, never>; Returns: string | null } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
