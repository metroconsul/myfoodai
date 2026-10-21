import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priceForPlan } from "@/config/billing";
import { appUrl, getStripe } from "./stripe.server";
import { inputSchema } from "./billing.functions.schemas";

async function subscriptionForCheckout(userId: string, companyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .or(`user_id.eq.${userId},company_id.eq.${companyId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a assinatura existente.");
  return data;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Crie sua empresa antes de contratar um plano.");

    const price = priceForPlan(data.planId, data.cycle);
    const existing = await subscriptionForCheckout(context.userId, profile.company_id);
    if (existing?.status && ["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
      throw new Error("Já existe uma assinatura para esta empresa. Gerencie-a pelo portal de cobrança.");
    }

    const metadata = {
      supabase_user_id: context.userId,
      company_id: profile.company_id,
      plan_key: price.planKey,
      billing_interval: price.interval,
    };
    const email = (context.claims as { email?: string }).email;
    const customer = existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : email
        ? { customer_email: email }
        : {};
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.priceId, quantity: 1 }],
      success_url: `${appUrl()}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/#planos`,
      client_reference_id: context.userId,
      metadata,
      subscription_data: { metadata },
      ...customer,
    });
    if (!session.url) throw new Error("A Stripe não retornou a URL do checkout.");
    return { url: session.url };
  });

export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !subscription?.stripe_customer_id) throw new Error("Nenhum cliente Stripe encontrado para esta conta.");
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl()}/app`,
    });
    return { url: session.url };
  });
