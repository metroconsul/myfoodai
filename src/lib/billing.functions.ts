import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_PRICES } from "@/config/billing";
import { inputSchema } from "./billing.functions.schemas";

/**
 * Cria uma sessão de Checkout da Stripe para assinatura do plano escolhido.
 * Roda apenas no servidor: a chave secreta nunca chega ao navegador.
 * O user_id vai em metadata para o webhook vincular a assinatura ao usuário.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_TEST_API_KEY"] ?? process.env["STRIPE_API_KEY"];
    if (!secretKey) {
      throw new Error("Chave secreta da Stripe não configurada no servidor.");
    }

    const price = PLAN_PRICES[data.planId]?.[data.cycle];
    if (!price) throw new Error("Plano inválido.");

    // A empresa vem da sessão autenticada — o frontend não escolhe preço nem empresa.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const companyId = profile?.company_id ?? "";

    const interval = data.cycle === "yearly" ? "year" : "month";
    const params = new URLSearchParams({
      mode: "subscription",
      success_url: `${data.origin}/app?checkout=sucesso`,
      cancel_url: `${data.origin}/?checkout=cancelado#planos`,
      "line_items[0][quantity]": "1",
      client_reference_id: companyId || context.userId,
      "metadata[user_id]": context.userId,
      "metadata[company_id]": companyId,
      "metadata[plan_id]": data.planId,
      "metadata[cycle]": data.cycle,
      "subscription_data[metadata][user_id]": context.userId,
      "subscription_data[metadata][company_id]": companyId,
      "subscription_data[metadata][plan_id]": data.planId,
      "subscription_data[metadata][cycle]": data.cycle,
    });

    if (price.priceId) {
      params.set("line_items[0][price]", price.priceId);
    } else {
      params.set("line_items[0][price_data][currency]", "brl");
      params.set("line_items[0][price_data][unit_amount]", String(price.unitAmount));
      params.set("line_items[0][price_data][recurring][interval]", interval);
      params.set("line_items[0][price_data][product_data][name]", price.productName);
    }

    const email = (context as { claims?: { email?: string } }).claims?.email;
    if (email) params.set("customer_email", email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const payload = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !payload.url) {
      throw new Error(payload.error?.message ?? "Falha ao criar sessão de checkout.");
    }

    return { url: payload.url };
  });
