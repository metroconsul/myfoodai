import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { planFromPriceId } from "@/config/billing";
import { getStripe } from "@/lib/stripe.server";

type Metadata = Record<string, string>;

function metadata(value: Stripe.Metadata | null | undefined): Metadata {
  return value ?? {};
}

function iso(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionId(value: string | Stripe.Subscription | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Configuração ausente", { status: 500 });

        const rawBody = await request.text();
        let event: Stripe.Event;
        try {
          event = getStripe().webhooks.constructEvent(rawBody, request.headers.get("stripe-signature") ?? "", secret);
        } catch {
          return new Response("Assinatura inválida", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const syncSubscription = async (
          subscription: Stripe.Subscription,
          fallback: { userId?: string | null; companyId?: string | null; checkoutSessionId?: string | null } = {},
        ) => {
          const meta = metadata(subscription.metadata);
          const priceId = subscription.items.data[0]?.price.id ?? null;
          const item = subscription.items.data[0];
          const plan = planFromPriceId(priceId);
          let userId = meta["supabase_user_id"] ?? fallback.userId ?? null;
          let companyId = meta["company_id"] ?? fallback.companyId ?? null;

          if (!userId || !companyId) {
            const { data: existing } = await supabaseAdmin
              .from("subscriptions")
              .select("user_id, company_id")
              .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${subscription.customer}`)
              .limit(1)
              .maybeSingle();
            userId ??= existing?.user_id ?? null;
            companyId ??= existing?.company_id ?? null;
          }
          if (!userId || !companyId) throw new Error("Assinatura Stripe sem vínculo MyFood.");

          const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              company_id: companyId,
              stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
              stripe_subscription_id: subscription.id,
              stripe_product_id: plan?.productId ?? null,
              stripe_price_id: priceId,
              plan: plan?.planKey ?? null,
              billing_cycle: plan?.interval ?? null,
              status: subscription.status,
              current_period_start: iso(item?.current_period_start),
              current_period_end: iso(item?.current_period_end),
              cancel_at_period_end: subscription.cancel_at_period_end,
              checkout_session_id: fallback.checkoutSessionId ?? null,
            },
            { onConflict: "user_id" },
          );
          if (subscriptionError) throw subscriptionError;

          const { error: companyError } = await supabaseAdmin
            .from("companies")
            .update({
              access_source: "subscription",
              subscription_status: plan ? subscription.status : "incomplete",
              ...(plan ? { plan_code: plan.planKey, billing_cycle: plan.interval === "yearly" ? "anual" : "mensal" } : {}),
            })
            .eq("id", companyId);
          if (companyError) throw companyError;
        };

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              const id = subscriptionId(session.subscription);
              if (!id) throw new Error("Checkout concluído sem assinatura.");
              const sessionMeta = metadata(session.metadata);
              await syncSubscription(await getStripe().subscriptions.retrieve(id), {
                userId: sessionMeta["supabase_user_id"] ?? session.client_reference_id,
                companyId: sessionMeta["company_id"] ?? null,
                checkoutSessionId: session.id,
              });
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
              await syncSubscription(event.data.object as Stripe.Subscription);
              break;
            case "invoice.paid":
            case "invoice.payment_failed": {
              const invoice = event.data.object as Stripe.Invoice;
              const id = subscriptionId((invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription);
              if (id) await syncSubscription(await getStripe().subscriptions.retrieve(id));
              break;
            }
            default:
              break;
          }
        } catch (error) {
          console.error("Falha ao sincronizar webhook Stripe", error instanceof Error ? error.message : error);
          return new Response("Erro de sincronização", { status: 500 });
        }

        // Só registra depois de sincronizar: em caso de falha, a Stripe reenviará o evento.
        const { error: idempotencyError } = await supabaseAdmin
          .from("stripe_webhook_events")
          .insert({ event_id: event.id, event_type: event.type });
        if (idempotencyError && idempotencyError.code !== "23505") {
          console.error("Falha ao registrar evento Stripe", idempotencyError.message);
          return new Response("Erro de persistência", { status: 500 });
        }
        return Response.json({ received: true, duplicate: idempotencyError?.code === "23505" });
      },
    },
  },
});
