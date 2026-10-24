import { createFileRoute } from "@tanstack/react-router";

/**
 * Volta do Mercado Pago depois que o dono aprova o acesso.
 * Confere o state (uso único, 10 min), troca o código por tokens (PKCE), grava a conexão e importa os últimos 30 dias.
 */
export const Route = createFileRoute("/api/public/mercado-pago/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { appUrl } = await import("@/lib/stripe.server");
        const back = (result: string) =>
          Response.redirect(`${appUrl()}/caixa-financeiro/vendas?mp=${encodeURIComponent(result)}`, 302);

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!state) return back("erro");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const srv = await import("@/lib/mercado-pago.server");
        const { MP_PROVIDER } = await import("@/lib/mercado-pago.shared");

        // Uso único: apaga e devolve o estado na mesma operação.
        const { data: saved } = await srv.mpAdmin
          .from("provider_oauth_states")
          .delete()
          .eq("state", state)
          .eq("provider", MP_PROVIDER)
          .select("*")
          .maybeSingle();
        if (!saved || new Date(saved.expires_at).getTime() < Date.now()) return back("expirado");
        if (!code) return back("cancelado");

        let tokens;
        try {
          tokens = await srv.exchangeCode(code, saved.code_verifier);
        } catch {
          return back("erro");
        }

        // A mesma conta Mercado Pago não pode ficar ligada a duas empresas.
        const other = await srv.connectionByProviderUser(String(tokens.user_id));
        if (other && other.company_id !== saved.company_id) return back("conta_em_uso");

        // Uma conexão Mercado Pago por empresa (índice parcial): reaproveita a existente ao reconectar.
        const values = {
          unit_id: saved.unit_id,
          adapter_type: "oauth",
          status: "conectado",
          active: true,
          last_sync_error: null,
          config: { account: String(tokens.user_id) },
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabaseAdmin
          .from("sales_connections")
          .select("id")
          .eq("company_id", saved.company_id)
          .eq("provider", MP_PROVIDER)
          .maybeSingle();
        const { data: conn, error } = existing
          ? await supabaseAdmin
              .from("sales_connections")
              .update(values)
              .eq("id", existing.id)
              .select("id, company_id, unit_id")
              .single()
          : await supabaseAdmin
              .from("sales_connections")
              .insert({ ...values, company_id: saved.company_id, provider: MP_PROVIDER })
              .select("id, company_id, unit_id")
              .single();
        if (error || !conn) return back("erro");

        try {
          await srv.saveTokens(conn.id, conn.company_id, tokens);
        } catch {
          return back("erro");
        }

        await supabaseAdmin.from("audit_logs").insert({
          company_id: saved.company_id,
          user_id: saved.user_id,
          action: "mercado_pago_conectado",
          entity: "sales_connections",
          metadata: { connection_id: conn.id },
        });

        try {
          await srv.syncConnection(conn);
        } catch {
          // A conexão fica salva; o erro aparece na tela e o dono pode sincronizar de novo.
        }
        return back("conectado");
      },
    },
  },
});
